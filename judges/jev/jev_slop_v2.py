#!/usr/bin/env python3
"""jev_slop v2: flag writing the founder rejects, paragraph by paragraph, with named checks.

v1 (jev_slop.py) is kept as is. v2 changes (2026-10-13, after he rejected v1's verdict on the
"Which Jev is the best Jev?" video script):
  - The headline is no longer Jev's generic `ai_sounding`, which scored his own raw draft 0.89 (worst) and the
    agent draft he rejected 0.59 (best). ai_sounding is still computed per paragraph but only shown with --show-ai.
  - Named checks, reported by name and per paragraph:
      numbers_no_takeaway          number-heavy line with no takeaway said in plain words
      overprecise_number           precise figure where a round one or plain words would do
      results_list_no_perspective  a list of results/picks with no view, surprise, example or conclusion
      tells_what_visuals_show      narration recites what the screen shows (scripts only: --script, [motion]/[face]
                                   cues, or a script.json with scenes)
      written_register             narration in written-only phrasing (scripts only, Jev backend)
      weak_opening                 first paragraph only (a title-only first line is read with the next one)
      weak_ending                  last paragraph only, including a weak product close
    The named checks run on Claude (`--checks claude`, default) because Jev failed them on the labelled check set
    (see README.md). `--checks jev` keeps the Jev version for comparison.
  - v1's tic questions (negation_reframe, staccato, ...) and regex bans still run on Jev, unchanged.
  - Headline `v2_score` (0-10) = 10 minus penalties for named-check hits and tic flags, per paragraph
    (weights in SCORE_WEIGHTS, chosen on the train pairs, checked on held-out val pairs; README.md).
  - Copy checks (2026-11-07, one per point of "Why LLM copy fails" on Nexus writing-rules), for titles, headlines,
    ads and short copy, on Jev by default (threshold 0.7), a reason per flag. --audience describes the reader in free
    text (who reads, from where, knowing what, deciding what); every check is judged against it.
      unsurprising          1-2  accurate but expected for this reader
      concedes_or_hedges    3    grants the other option's case or hedges
      writer_side           4    starts from our side or the middle of our thread, not where the reader starts
      formula_shape         5    "X does A. Y does B.", "not X but Y", number openers (also regexes)
      crammed_claims        6    more than one claim in one line
      wrong_register        7    not the mind(s) this audience needs (only with --audience)
  - Optional `--xar --task "..."`: also score with the XAR rubric judge (tmp/xar-judge/judge.py, meta-prompt v2).

Usage:
  python3 jev_slop_v2.py draft.md                          # tics (Jev) + named checks (Claude) + v2_score
  python3 jev_slop_v2.py script.json                       # avatar-twin script: scenes are paragraphs, script mode on
  python3 jev_slop_v2.py draft.md --script                 # treat as video narration
  python3 jev_slop_v2.py draft.md --json                   # machine-readable
  python3 jev_slop_v2.py titles.txt --copy                 # titles, headlines, ads, hooks: one line each, on Jev
  python3 jev_slop_v2.py titles.txt --copy --copy-backend claude   # same on claude -p, written reasons + rewrites
  python3 jev_slop_v2.py lines.txt --copy --audience "engineers on Hacker News, know Firecracker, deciding to try it"
                                                           # (also on when every unit is a short line, <= 25 words)
  python3 jev_slop_v2.py draft.md --no-jev                 # named checks + regex only (no TypeSafe key needed)
  python3 jev_slop_v2.py draft.md --checks jev             # named checks on Jev instead of Claude
  python3 jev_slop_v2.py draft.md --xar --task "LinkedIn post from the founder about X; facts: ..."
  cat draft.md | python3 jev_slop_v2.py -

Keys: Jev reads TYPESAFE_API_KEY or ~/.config/typesafe.key. Claude runs through `claude -p` on the Max
subscription (tmp/xar-judge/llm.py), no key needed; VOICE_LLM_BACKEND=api with ANTHROPIC_API_KEY to use the API.
Named checks cost one Claude call per document (~20-40 s); Jev is ~$0.0003 per paragraph.
"""
import argparse, importlib.util, json, math, os, re, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
XAR = os.path.normpath(os.path.join(HERE, "..", "..", "tmp", "xar-judge"))
_spec = importlib.util.spec_from_file_location("jev_slop_v1", os.path.join(HERE, "jev_slop.py"))
v1 = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(v1)

CHECK_MODEL = os.environ.get("JEV_SLOP_CHECK_MODEL", "claude-opus-5-5")
TICS = {k: q for k, q in v1.QUESTIONS.items() if k != "ai_sounding"}
NAMED = ["numbers_no_takeaway", "overprecise_number", "results_list_no_perspective", "tells_what_visuals_show",
         "written_register", "weak_opening", "weak_ending"]
# Penalty per hit on the 0-10 headline. Named checks weigh more than tics: they are what he rejects drafts for.
SCORE_WEIGHTS = {"numbers_no_takeaway": 2.0, "overprecise_number": 1.0, "results_list_no_perspective": 2.0,
                 "tells_what_visuals_show": 1.0, "written_register": 1.0, "weak_opening": 2.0, "weak_ending": 2.0, "tic": 0.5, "regex": 0.5,
                 "unsurprising": 2.0, "concedes_or_hedges": 2.0, "writer_side": 2.0, "formula_shape": 2.0,
                 "crammed_claims": 2.0, "wrong_register": 2.0, "dramatic_never": 1.0,
                 "invented_scene": 1.0, "unnamed_source": 1.0, "undefined_subject": 1.0,
                 **{k: 1.0 for k in ("mirrored_pair", "rule_of_three", "negative_quantity", "modal_hedge",
                    "signpost", "fake_epiphany", "closer", "engagement_bait", "vague_group", "personified_abstraction",
                    "training_tense", "concession", "clipped_condition", "stating_priors", "slogan_equation", "instruction_register")}}

# ---- definitions shared by both backends. His rules in his words, with made-up examples: no text from the
# validation sets (tmp/xar-judge/v2/checkset.jsonl) is quoted here.
DEFS = {
    "numbers_no_takeaway": "Number-heavy line with no takeaway. Two or more figures (percentages, scores, counts, "
        "prices, durations, ranks) are recited and the reader has to hold them in their head and work out what they "
        "mean, or whether a figure is good or bad. His rule: 'people don't like hearing numbers, they like the "
        "takeaways'. NOT a hit when the line says the meaning in plain words: a verdict ('way cheaper', "
        "'a big gap', 'not worth it'), a comparison the reader can feel (what the same money buys with each "
        "option), or one big proof number that carries its own point.",
    "overprecise_number": "Precise figure where a round one or plain words would make the same point: odd "
        "percentages or decimals (71.3%), exact ranges or counts (17 to 22 runs, 341 a week), exact ranks "
        "(seventh, twelfth). He rewrites these as round numbers or plain words ('about 5x', 'over 70%', "
        "'all of their runs'). NOT a hit for a single headline number that is the point, round numbers (75%, 100x, 10k), "
        "or a figure the same sentence turns into a takeaway.",
    "results_list_no_perspective": "A list of results or picks (X wins here, Y wins there, Z scores this) with no "
        "view of the writer: no surprise, no concrete example, no 'so what', no conclusion. He prefers one finding "
        "told with a concrete example over a catalogue. NOT a hit when the list carries an opinion, a surprise or "
        "a recommendation the reader can act on.",
    "tells_what_visuals_show": "Video narration that recites what the screen already shows: how many things were "
        "tested, positions in a ranking, chart values, a list of names. His rule: 'show don't tell, the motion "
        "graphics will show'. The voice should say what it means instead. NOT a hit for a single number said as part "
        "of a takeaway.",
    "written_register": "Video narration with phrasing people only write and never say when they talk: 'left alone', "
        "'thus', 'hence', 'whereby', 'one might', 'moreover', 'in order to', 'it is worth noting', or a clause order "
        "no speaker would use. NOT a hit for plain spoken words, even long or loose sentences.",
    "weak_opening": "Weak opening. It does not hook with the writer's angle or with something the reader cares about. "
        "Typical: opens on a count of what was done or a method summary, hedges, signposts what is coming instead "
        "of saying it, gives away the conclusion in a flat way, or clears its throat. A plain question the piece "
        "will answer, or the writer's own point of view and why he is talking about it, is a good opening.",
    "weak_ending": "Weak ending. Generic advice the reader could get anywhere, a flat mention of the product with no "
        "reason to care, a summary of what was already said, or a tidy moral. A product close should tell the "
        "reader what they can do with it and what it gets them, said with confidence. A specific, confident next "
        "step is a good ending.",
}
JEV_Q = {k: f"Answer yes only if this paragraph has this problem. {d}" for k, d in DEFS.items()}

# "never" as drama: only sentences that contain the word go to Jev, one question each, in every mode.
NEVER_THRESHOLD = 0.5  # 26 labelled lines, 2026-11-13: precision 1.0, recall 0.75
NEVER = {"en": re.compile(r"\bnever\b", re.I), "pt": re.compile(r"\b(?:never|nunca|jamais)\b", re.I)}
NEVER_Q = ("Answer yes only if this sentence uses 'never' for dramatic emphasis, where plain past tense or a plain "
           "'not' says the same thing. Yes: 'Langy also runs the evals on cases it never looked at' (it means 'didn't "
           "look at'); 'The agent never saw the trace'; 'We never asked for that'. No when 'never' states a real, "
           "lasting rule or guarantee: 'the key never leaves the vault'; 'never commit secrets'; 'the proxy never "
           "logs request bodies'. In Portuguese, 'nunca' and 'jamais' are 'never': yes for 'casos que ele nunca viu' "
           "(it means 'não viu'), no for 'a chave nunca sai do cofre'.")


def never_checks(units, key, lang="en"):
    word = NEVER.get(lang, NEVER["en"])
    jobs = [(i, s.strip()) for i, u in enumerate(units) for s in re.split(r"(?<=[.!?])\s+", u["text"]) if word.search(s)]
    def one(job):
        r = v1.ask_jev(job[1], {"dramatic_never": NEVER_Q}, key)
        return job, round(r["answers"]["dramatic_never"].get("noul", 0.0), 3), r.get("usage", {}).get("input_tokens", 0)
    out = [dict() for _ in units]
    tokens = 0
    with ThreadPoolExecutor(4) as ex:
        for (i, sent), pr, t in ex.map(one, jobs):
            tokens += t
            if pr > out[i].get("dramatic_never", {}).get("p", -1):
                out[i]["dramatic_never"] = {"p": pr, "quote": sent, "fix": ""}
    return out, tokens

# Narrator questions: one Jev call per sentence, the sentence before it as context, so each flag carries its quote.
# Every mode but legal (inkling judge leaves --narrator off there). Thresholds from calibration/jev-narrator.jsonl.
NARRATOR_DEFS = {
    "invented_scene": "The sentence invents a scene to dramatise a point: a made-up moment, told as if it happened or "
        "will happen, with an unnamed person or a stock time of the week. Yes: 'Picture this: the deploy is red and "
        "support is calling'; 'On Tuesday your team ships a new agent, and by Friday someone from finance asks why "
        "the bill doubled'; 'Your CTO pings you about the bill'; 'Sooner or later a director stops by with a "
        "screenshot'. No when the event is real and dated with the person named ('On 4 November Priya, our billing "
        "lead, asked why the bill doubled'); when the reader is asked to try something themselves ('Ask your agent "
        "for its last ten failures and read them'); for a plain question, a condition ('If the bill doubles, the "
        "alert fires') or a general statement.",
    "unnamed_source": "The sentence backs a claim with what an unnamed person or organisation said, told, wrote or "
        "found, so the reader can't check it: a testimonial or a finding with no name. A product, an agent, a model "
        "or a judge saying something is not a source, and neither is someone asking a question in a story. Yes: 'A customer told his team the dashboards were useless'; 'One of our users said "
        "the export broke'; 'A firm that certifies AI systems told us the audit takes a week'; 'An engineer at a big "
        "bank once said...'; 'Studies show...'. No when the source is named and public ('Meta's 2025 paper found "
        "that judges prefer model text'; 'In its public case study, the support lead at Northwind said...'); when "
        "the writer states the claim himself ('We think the export is too slow'); or when 'we' report our own run.",
    "undefined_subject": "The sentence's subject is an unnamed person or group of people doing something, and the "
        "text never says who: 'a founder', 'someone', 'a customer', 'an engineer at a bank', or a bare plural group "
        "stated as a habit ('Companies switch...', 'Marketers write...', 'Enterprises buy...'). Yes: 'A founder "
        "rejected this title'; 'A customer told his team the dashboards were useless'; 'Someone asked us for a dark "
        "mode'; 'Teams ship faster when they review traces'; 'A developer connects the agent once'. No for a definition ('A developer "
        "is anyone with a project key'); a role in a rule or a condition ('If a user asks for a refund, the agent "
        "hands off'); the reader, the writer or the product as the subject; or a person the text before already "
        "introduced ('We met a founder at the conference. The founder rejected the title').",
}
NARRATOR_THRESHOLDS = {"invented_scene": 0.4, "unnamed_source": 0.8, "undefined_subject": 0.8}
NARRATOR_Q = {k: "The text has the context before, then the sentence to judge. Judge only the sentence after "
              f"'Sentence:'. Answer yes only if it has this problem. {d}" for k, d in NARRATOR_DEFS.items()}
SENTENCE = re.compile(r"(?<=[.!?])\s+(?=[\"'(A-Z0-9])")


def narrator_state(before, sentence):
    return (f"Context before: {before[-600:]}\n\n" if before else "") + f"Sentence: {sentence}"


def narrator_checks(units, key, questions=None):
    """Per unit: {flag: {"p": max score, "quote": the sentence}} plus "_narrator": every sentence's scores."""
    qs = questions or NARRATOR_Q
    jobs, before = [], ""
    for i, u in enumerate(units):
        for s in SENTENCE.split(u["text"].replace("\n", " ").strip()):
            s = s.strip()
            if len(s.split()) >= 3: jobs.append((i, s, before))
            before = (before + " " + s).strip()
    def one(job):
        r = v1.ask_jev(narrator_state(job[2], job[1]), qs, key)
        return job, {k: round(v.get("noul", 0.0), 3) for k, v in r["answers"].items()}, r.get("usage", {}).get("input_tokens", 0)
    out = [{"_narrator": []} for _ in units]
    tokens = 0
    with ThreadPoolExecutor(4) as ex:
        for (i, sent, _), probs, t in ex.map(one, jobs):
            tokens += t
            out[i]["_narrator"].append({"quote": sent, "probs": probs})
            for k, pr in probs.items():
                if pr > out[i].get(k, {}).get("p", -1): out[i][k] = {"p": pr, "quote": sent, "fix": ""}
    return out, tokens

# Construct questions: meaning-level shapes a regex only approximates (docs/research/rule-audit.md). All of them go
# to Jev in one call per paragraph (--constructs). Examples here are made up; none comes from the labelled set.
CONSTRUCT_DEFS = {
    "mirrored_pair": "Two short clauses or sentences built as mirror images, one idea dressed as two: 'Logs record. "
        "Traces explain.', a swap of the same words ('ship the docs, document the ship'), or 'the more X, the more Y'. "
        "Not a hit for two different facts that happen to share a structure in a longer sentence.",
    "rule_of_three": "A rhythmic list of three parallel fragments or clauses used as a punchline: 'Less toil, less "
        "noise, less burnout', 'No forms. No calls. No waiting.' Not a hit for a plain list of three facts (languages, "
        "steps, spans).",
    "negative_quantity": "A claim defined by how little something does or how much it does not do ('it touches "
        "nothing', 'barely any of the work', 'never stores anything') instead of saying what it does.",
    "modal_hedge": "A modal or soft promise in place of a claim: 'can help', 'may improve', 'could potentially', "
        "'is designed to help'. Not a hit for a real possibility with a condition ('the run may take a minute on large "
        "projects') or for 'you can' describing what the reader is able to do.",
    "signpost": "A sentence about the text instead of the subject: it announces that a point, a story, a question or a "
        "surprise is coming ('here's what happened', 'let me walk you through', 'the funny thing is', 'that raises the "
        "obvious question') instead of making it.",
    "fake_epiphany": "A marker that labels a revelation instead of showing what flipped it: 'that's when it clicked', "
        "'it suddenly made sense', 'the real lesson', 'what became clear'. Not a hit for a plain finding with its evidence.",
    "closer": "The paragraph ends on a short line that exists for weight, not information: a two-to-five word punch "
        "('Ours remembers.', 'Not anymore.'), a line naming what was just described ('That's the loop.'), or a "
        "summing-up of the example ('It just never asks.'). Not a hit for a short closing fact ('The ticket closed an "
        "hour later.').",
    "engagement_bait": "An influencer sign-off: asks the reader to comment, agree or share ('Thoughts?', 'tell me "
        "below'), or a 'Stop X. Start Y.' imperative pair. Not a hit for a concrete next step or a real request.",
    "vague_group": "A vague, uncounted claim about a group: 'most teams', 'the majority of companies', 'plenty of "
        "engineers', 'lots of people', 'everyone knows'. Not a hit for a real count ('31 of the 40 teams'), for 'most' "
        "as in 'the most common', or for a named group.",
    "personified_abstraction": "An abstract thing, a budget, a document or a data record does a human action as a "
        "clever phrasing: 'the spend answers to no one', 'the log knows', 'the trace tells a story', 'the budget "
        "decides'. Not a hit for software that really acts (an agent decides which tool to call).",
    "training_tense": "Present tense for a model's finished training, as if it were still being trained: 'models are "
        "rewarded for', 'RLHF teaches', 'training pushes it to'. Not a hit for the past tense ('was trained', "
        "'training rewarded') or for what the model does now ('the model hedges').",
    "concession": "Concedes the other option's case before taking a side: 'X is great, but', 'sure, X works, though', "
        "'nothing wrong with X'. Not a hit when the line only states our side.",
    "clipped_condition": "A condition said as an ad: a bare imperative, then 'and', then the result in the timeless "
        "present ('Show it the logs and it finds the bug'). Not a hit with 'if' or 'when', a real past event, or two "
        "separate steps.",
    "stating_priors": "The writer states what he expected before the result ('I went in sure that...', 'my bet "
        "was...') instead of the finding.",
    "slogan_equation": "'The X is the Y' equation tagline that sounds deep and states nothing checkable: 'the "
        "reader is the product', 'your logs become your roadmap'. Not a hit for a plain definition or a fact.",
    "instruction_register": "Explaining prose says a step as an order to the reader ('Next, open the file', 'You "
        "paste it in'), outside a numbered how-to list. Not a hit for 'you can...', 'I usually...', a condition, a "
        "short call to action ('Try it.') or a numbered list of steps.",
}
CONSTRUCT_Q = {k: f"Answer yes only if this paragraph has this problem. {d}" for k, d in CONSTRUCT_DEFS.items()}
CONSTRUCT_THRESHOLDS = {
    "mirrored_pair": 0.45,
    "rule_of_three": 0.7,
    "negative_quantity": 0.9,
    "modal_hedge": 0.5,
    "signpost": 0.9,
    "fake_epiphany": 0.35,
    "closer": 0.5,
    "engagement_bait": 0.95,
    "vague_group": 0.95,
    "personified_abstraction": 0.7,
    "training_tense": 0.45,
    "concession": 0.9,
    "clipped_condition": 0.75,
    "stating_priors": 0.85,
    "slogan_equation": 0.65,
    "instruction_register": 0.8,
}


# The second batch reads each paragraph with the one before it, and some of its questions belong to some modes only.
ALL_PROSE = ("docs", "post", "ads", "landing", "proposal", "deck", "investor", "script", "message", "x")
CONSTRUCT2_DEFS = {
    "tense_mismatch": ("A tense that doesn't fit the claim: a general, lasting claim told in the past ('readers trusted "
        "posts that people wrote', 'judges prefer text a model produced' is fine, 'judges preferred text models wrote' as "
        "a general rule is a hit), or one specific dated event narrated in the present ('on 8 November the writer drafts "
        "it and the judge flags two lines'). Not a hit for a finding with its source in the past or a routine in the present.", ALL_PROSE),
    "lecture_turn": ("The paragraph before talks to the reader, and this paragraph opens on a general law about AI, models "
        "or agents with no link back to the reader ('LLMs regress to the mean, so...'). Not a hit when the sentence ties "
        "the law to the reader or to us, or follows our own story.", ("post", "script")),
    "overclaim": ("Names one definite cause ('the root cause', 'the real reason', 'what it all comes down to') and then "
        "lists other causes, so the reader hears one cause and meets several. Not a hit for one cause alone, for 'one "
        "reason' or 'the first reason', or for a list with no claim of a single cause.", ALL_PROSE),
    "shorthand_heading": ("A section heading that squeezes a claim into a verbless phrase: 'X without Y', 'X over Y', "
        "'X, not Y', 'from X to Y', 'X beyond Y'. Not a hit for a heading with a verb, a plain topic label ('Pricing', "
        "'How it works') or a question.", ("post", "docs", "proposal")),
    "dramatic_heading": ("A heading that dramatises instead of naming the topic: 'The X you could not Y', 'the bill "
        "nobody saw coming', a contest ('which model won', 'the showdown', 'where each one broke'), or what other people "
        "do ('how teams keep it running'). Not a hit for a plain topic or a heading that says what the reader can do.", ALL_PROSE),
    "narrated_flow": ("Walks the reader through using the product as a little story: 'you type..., and what comes back "
        "is...', 'you open the app, pick a project, and there it is'. Not a hit for saying what the product does.", ("post", "ads", "deck")),
    "guide_preamble": ("A docs opening that announces instead of answering: 'in this guide we will explore', 'learn how "
        "to', 'welcome! here you will discover', 'below we take a closer look'. Not a hit for a sentence that says what "
        "the page builds or what the thing does.", ("docs",)),
    "category_headline": ("A headline that names a product category ('the agent platform for teams', 'X in the cloud', "
        "'the all-in-one suite') instead of what the reader gets. Not a hit for a headline about the reader's outcome.", ("ads", "landing")),
    "writer_side_line": ("A headline or line told from our side: what we built, launched or rebuilt, or a fact about our "
        "own material ('our engine keeps context', 'introducing X', 'the rules fit on one screen', 'the method is four "
        "files') with nothing about why the reader should care. Not a hit when the reader or their outcome is the point.", ALL_PROSE),
    "crammed_headline": ("A headline that crams two or more claims or features into one line ('trace, evaluate and "
        "monitor', 'agents that run for weeks, share memory and ask first'). Not a hit for one claim.", ("ads", "deck", "landing")),
    "lede_shape": ("A title with a subtitle under it, where the subtitle is a bare fact about someone else ('Your "
        "colleagues message it', 'the agent keeps running somewhere') or setup steps ('sign in, then message it'), "
        "instead of what the reader can do or gets. Not a hit when the subtitle says what the reader can do.", ("ads", "landing")),
    "number_no_meaning": ("A number with no measure or comparison, so the reader can't tell what it means: '300% growth', "
        "'40% better', 'both score 99%', 'up 4x'. Not a hit when the line says of what and against what ('costs 82% less "
        "per email', 'from 60k to 180k').", ALL_PROSE),
    "dangling_reference": ("The paragraph opens by pointing back ('this', 'that', 'a smaller version', 'the same thing', "
        "'the second case') at something the paragraph before never clearly said, so a listener can't tell what it "
        "refers to. Not a hit when the paragraph before names the thing.", ("script", "deck")),
    "elegant_variation": ("One thing or one step word rotated through synonyms within a few sentences (the model, the AI, "
        "the system; next, after that, subsequently; customers, users, clients). Not a hit when the same word repeats "
        "or the words name different things.", ("script",)),
    "colon_list": ("A colon followed by a list of parallel items as a flourish ('three things: a claim, a reader and a "
        "surprise', 'it comes down to this: context, contrast and craft'). Not a hit for a colon that gives one answer "
        "or a list of real events.", ("script",)),
    "aside_jump": ("A new term dropped in as an aside at the end of a sentence ('..., which statisticians call X', '..., "
        "a bias psychologists named X', 'known in the field as X'). Not a hit when the name gets its own sentence or "
        "the clause adds a reason.", ("script",)),
    "docs_scene_opener": ("A docs sentence that narrates a scene with an anonymous actor ('A developer connects the "
        "agent', 'an engineer opens the dashboard', 'someone creates the key') instead of telling the reader what to do "
        "or what the product does. Not a hit for a definition or 'an admin can'.", ("docs",)),
    "timeline_when": ("Docs narrate an event on a timeline the reader doesn't control ('when the policy drops content, "
        "...', 'once the window passes, traces disappear', 'after the nightly job runs'). Not a hit for telling the "
        "reader what to set, or a condition on the reader's own action.", ("docs",)),
    "fragment_tagline": ("A tagline of clipped fragments with no verb or only imperatives ('Less noise. More signal.', "
        "'Draft. Test. Ship.', 'Zero setup, full insight.'). Not a hit for a full sentence or a plain label heading.", ALL_PROSE),
    "staged_experiment": ("Frames the piece as a staged contest or experiment ('we gave three models the same', 'we "
        "pitted', 'head to head', 'one winner') instead of explaining how the system works. Not a hit for describing "
        "what a model did in our system.", ("post",)),
    "known_mechanism": ("A landing page section that explains why the reader's problem happens (the mechanism behind "
        "it) to a visitor who already lives with it, instead of what changes for them. Not a hit for a section about "
        "the reader's outcome.", ("landing",)),
}
CONSTRUCT2_Q = {k: "The text has the paragraph before, then the paragraph to judge. Judge only the paragraph after "
                f"'Paragraph:'. Answer yes only if it has this problem. {d}" for k, (d, _) in CONSTRUCT2_DEFS.items()}
CONSTRUCT2_THRESHOLDS = {
    "tense_mismatch": 0.4,
    "lecture_turn": 0.85,
    "overclaim": 0.85,
    "shorthand_heading": 0.6,
    "dramatic_heading": 0.85,
    "narrated_flow": 0.65,
    "guide_preamble": 0.95,
    "category_headline": 0.45,
    "writer_side_line": 0.75,
    "crammed_headline": 0.9,
    "lede_shape": 0.75,
    "number_no_meaning": 0.9,
    "dangling_reference": 0.85,
    "elegant_variation": 0.75,
    "colon_list": 0.9,
    "aside_jump": 0.4,
    "docs_scene_opener": 0.85,
    "timeline_when": 0.8,
    "fragment_tagline": 0.65,
    "staged_experiment": 0.55,
    "known_mechanism": 0.85,
}


def construct2_state(before, text):
    return (f"Paragraph before: {before[-800:]}\n\n" if before else "") + f"Paragraph: {text}"


# An experiment write-up (page: experiment) is meant to stage its contest.
PAGE_OFF = {"staged_experiment": lambda page: page not in (None, "article")}

def construct_checks(units, key, questions=None, mode=None, page=None):
    qs = questions or CONSTRUCT_Q
    qs2 = {k: q for k, q in CONSTRUCT2_Q.items() if (mode is None or mode in CONSTRUCT2_DEFS[k][1]) and not PAGE_OFF.get(k, lambda p: False)(page)}
    def one(i):
        u = units[i]
        r = v1.ask_jev(u["text"], qs, key)
        probs = {k: round(v.get("noul", 0.0), 3) for k, v in r["answers"].items()}
        t = r.get("usage", {}).get("input_tokens", 0)
        if qs2:
            r2 = v1.ask_jev(construct2_state(units[i - 1]["text"] if i else "", u["text"]), qs2, key)
            probs.update({k: round(v.get("noul", 0.0), 3) for k, v in r2["answers"].items()})
            t += r2.get("usage", {}).get("input_tokens", 0)
        return probs, t
    with ThreadPoolExecutor(4) as ex:
        res = list(ex.map(one, range(len(units))))
    return [{k: {"p": p, "quote": units[i]["text"], "fix": ""} for k, p in r[0].items()} for i, r in enumerate(res)], sum(r[1] for r in res)

CLAUDE_SYS = ("You are the founder's line editor at LangWatch. He likes casual, spoken, opinionated writing: "
              "his own drafts are loose, with typos and long run-on sentences, and that is fine. You do not rate "
              "style. You read each paragraph as a listener hearing it once and note, precisely, what is on the "
              "page. Reply with JSON only.")
# Claude extracts facts about each paragraph; the verdict per named check is a fixed rule in rules_from_extract().
# Extraction is steadier than asking for a verdict, which swung between missing B's lines and flagging his.
CLAUDE_TMPL = """Read this {genre} paragraph by paragraph and fill in the fields below for each paragraph. Quote exact words.

What the named problems mean (his rules):
{defs}

Fields for EVERY paragraph:
- "figures": every number or ranking the listener has to weigh (percentages, scores, counts, prices, durations,
  positions like "ninth"). Leave out big proof numbers that make their own point (thousands, millions, 100x),
  durations of the work ("three weeks") and dates.
- "takeaway": the words that tell the listener what the figures or results MEAN in plain language: which is better
  and whether by a lot, whether something is good or bad, what to do about it ("way cheaper", "a big gap",
  "that's the top model for this"). It must be a judgement about THESE figures, not one more result (what a
  model scored, caught or missed is a result, not a takeaway). A hedge ("it depends", "depends on what you
  need"), a caveat or excuse, a transition or topic line ("that's where X comes in"), a bare "only", or one more
  figure is not a takeaway. null if none.
- "results_list": true if the paragraph is mainly a catalogue of results or picks from a test, benchmark or analysis
  (X wins here, Y there, Z scores this), two or more items. Plans, features and roadmaps are not results.
- "perspective": the words where the writer steps back from the list: his own view, a surprise, a concrete example
  told as a finding, or a conclusion about the results as a whole. A pick for one item of the list is part of the
  list, and a hedge is not a perspective. null if none.
- "overprecise": figures that would make the same point said round or in words (odd percentages, decimals, exact
  ranges, exact ranks, exact small counts). Not round numbers (75%, 10k, 100x), not a single headline figure.
- "visual_recital": {visual_rule}
Extra fields for the OPENING unit ({opening}) only:
- "hook": the words that give the writer's angle, a question the piece will answer, or why he is talking about it.
  null if none.
- "opening_flaws": quotes of an exact count of how many things were tested or done, a hedge, a signpost of what
  is coming ("let me show you"), or a flat spoiler of the answer. Saying who we are and why we looked into it is
  not a flaw. [] if none.
Extra fields for the ENDING unit ({ending}) only:
- "ending_kind": one of "confident recommendation", "product call to action with a reason", "generic advice",
  "summary", "moral", "product aside". "product aside" = the product comes up as an afterthought ("we built this
  with X") after advice, not as the thing to go do.
- "reader_benefit": the words saying what the reader gets by acting. null if none.

TEXT (paragraphs numbered)
{numbered}

Reply with JSON only:
{{"paragraphs": [{{"n": 1, "figures": [], "takeaway": null, "results_list": false, "perspective": null,
"overprecise": [], "visual_recital": [], "hook": null, "opening_flaws": [], "ending_kind": null,
"reader_benefit": null, "fix": "one short fix in his spirit for the worst problem, or null"}}]}}"""
VISUAL_RULE_ON = ("this is video narration with motion graphics: quotes where the voice reads out what the screen "
                  "will show anyway: counts of how much work was done (how many models, tests or checks) and names, "
                  "positions or values read off a chart. Pointing at the chart ('if we look at the chart') is fine. "
                  "[] if none.")
VISUAL_RULE_OFF = "not video narration: always []."

# ---- copy checks: titles, headlines, ads, hooks, short copy. One flag per point of "Why LLM copy fails"
# (Nexus writing-rules); points 1 and 2 (no judge, likely words) both show up as an unsurprising line.
COPY = ["unsurprising", "concedes_or_hedges", "writer_side", "formula_shape", "crammed_claims", "wrong_register"]
COPY_POINT = {"unsurprising": "1-2", "concedes_or_hedges": "3", "writer_side": "4", "formula_shape": "5",
              "crammed_claims": "6", "wrong_register": "7"}
COPY_DEFS = {
    "unsurprising": "Accurate but expected: the reader would nod and scroll. It restates the category, a generic "
        "benefit any rival could claim, or what the reader already believes. NOT a hit when the line says one thing "
        "this reader did not expect, or takes a clear stance that reframes their work.",
    "concedes_or_hedges": "Concedes: grants that the competitor, a rival category or the default option works or has "
        "value ('a sandbox runs your agent', 'X is great, but'), adds balance, or hedges ('can', 'may', 'helps', "
        "'in many cases'). Copy takes a side. NOT a hit for a plain flat claim.",
    "writer_side": "Starts from the writer's side instead of where this reader starts: what we built, our product, "
        "category or features as the subject, or written from the middle of our thread (references, internal "
        "names or terms this reader does not know, no answer to 'where am I and why should I care'). NOT a hit "
        "for terms this reader already knows, or when the reader's situation is the subject.",
    "formula_shape": "A stock 'punchy' shape: 'X does A. Y does B.', 'not X, but Y', 'X isn't A, it's B', "
        "'doesn't need X. It needs Y.', two-beat aphorism pairs, or opening with a number or count ('77 ready-made "
        "questions'). NOT a hit for one flat negative claim with no second beat ('You don't need an agent sandbox').",
    "crammed_claims": "More than one claim or benefit packed into one line (two sentences making two points, a list "
        "of features, 'and' joining two promises). One claim per line. NOT a hit for a question plus its answer to "
        "the same point.",
    "wrong_register": "The voice is clearly wrong for this reader: a voice they distrust or that puts them off, "
        "because the audience needs a different mind (often more than one). Examples: hype or selling words to "
        "engineers who want an engineer writing with real detail; an internal memo or limitations first to someone "
        "deciding to buy; loose promises to a lawyer who needs precise terms; implementation internals to an investor "
        "deciding on a meeting. NOT a hit when the line sounds the way this reader would want it, even if short.",
}
COPY_SYS = ("You are the founder's copy editor. He rejects copy written from the writer's side, hedged, built "
            "from stock shapes, crammed with claims, merely accurate, or in a voice the audience does not need. He "
            "approves lines that say one thing the reader did not expect, from where the reader starts. You are "
            "strict. Reply with JSON only.")
COPY_TMPL = """{audience}Judge each numbered line below as copy for that audience. For each problem, decide hit or not
and give the reason in one short sentence quoting the words. Be strict: a hit needs a quote.

Problems:
{defs}

Examples he judged:
- REJECTED "A sandbox runs your agent. ACME puts it to work for your team": concedes the competitor's category works,
  "X does A. Y does B." shape, product as hero, vague outcome.
- REJECTED "Your agent doesn't need a sandbox. It needs a team.": "doesn't need X, needs Y" shape.
- REJECTED "Dashboards come with 77 ready-made questions": opens with a count.
- REJECTED first security docs: written to ourselves, leading with limitations, for readers deciding to trust us.
- APPROVED "You don't need an agent sandbox": one claim the searcher did not expect, in their words.
- APPROVED "Laptop shut? It still works": the reader's moment, one surprising claim.
- APPROVED "Running an AI native company is a team sport": a stance that reframes the reader's work.

LINES
{numbered}

Reply with JSON only:
{{"lines": [{{"n": 1, "flags": {{"<problem>": "reason quoting the words"}}, "fix": "one rewrite in his spirit, or null"}}]}}
Put only the problems that are hits in "flags"; {{}} when the line is clean."""
NUM_START = re.compile(r"^\W*(\d[\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|dozens?|hundreds?|thousands?)\b", re.I)
SHAPE_RES = [
    (re.compile(r"\b(doesn'?t|don'?t|does not|do not)\s+need\b[^.?!]*[.?!,;:]\s*(it|they|you|he|she|we)\s+needs?\b", re.I),
     "'doesn't need X, needs Y' shape"),
    (re.compile(r"\bnot\b[^.?!]{1,40},?\s+but\b", re.I), "'not X, but Y' shape"),
    (re.compile(r"\b(isn'?t|is not|aren'?t|are not)\b[^.?!]{1,40}[.,;:]\s*(it'?s|it is|they'?re|they are)\b", re.I),
     "'X isn't A, it's B' shape"),
]


def copy_regex(text):
    m = NUM_START.match(text)
    if m: return {"formula_shape": f"opens with a number: \"{m.group(0).strip()}\""}
    for rx, why in SHAPE_RES:
        m = rx.search(text)
        if m: return {"formula_shape": f"{why}: \"{m.group(0)}\""}
    return {}


def is_copy(units):
    """Short units, or one block of short lines (a list of titles with no blank lines between them)."""
    if not units: return False
    if all(len(u["text"].split()) <= 25 for u in units): return True
    lines = [l for l in units[0]["text"].splitlines() if l.strip()] if len(units) == 1 else []
    return len(lines) >= 2 and all(len(l.split()) <= 25 for l in lines)


def _claude_json(prompt, system):
    """tmp/xar-judge/llm.py when the workspace has it, else plain `claude -p` (hosted computers lack xar-judge)."""
    sys.path.insert(0, XAR)
    try:
        import llm
        return llm.parse_json(llm.claude(prompt, system=system, model=CHECK_MODEL, effort="low", max_tokens=4000))
    except ImportError:
        import subprocess
        env = {k: v for k, v in os.environ.items() if "ANTHROPIC_API_KEY" not in k}
        r = subprocess.run(["claude", "-p", "--model", CHECK_MODEL, "--tools", "", "--append-system-prompt", system],
                           input=prompt, capture_output=True, text=True, timeout=240, env=env)
        if r.returncode: raise RuntimeError(f"claude -p failed: {r.stderr[-300:]}")
        t = r.stdout
        return json.loads(t[t.index("{"):t.rindex("}") + 1])


COPY_THRESHOLD = 0.7
# Set on his approved and rejected lines across four audiences (README): approved titles reach 0.71 on
# unsurprising and 0.69 on writer_side and wrong_register; the rejected ones and wrong-voice lines sit above these.
COPY_THRESHOLDS = {"unsurprising": 0.75, "writer_side": 0.75, "wrong_register": 0.8}
COPY_REASONS = {
    "unsurprising": "accurate but expected; says nothing this reader did not already believe",
    "concedes_or_hedges": "grants the other option's case or hedges instead of taking a side",
    "writer_side": "starts from our side or the middle of our thread, not where this reader starts",
    "formula_shape": "stock punchy shape ('X does A. Y does B.', 'not X but Y', number opener)",
    "crammed_claims": "more than one claim in one line",
    "wrong_register": "voice is not the mind this audience needs",
}


def _audience_line(audience):
    return f"Audience: {audience}.\n" if audience else ""


# Checks whose answer depends on who reads open with the audience; the shape checks (formula, cram) do not,
# and conceding gets the audience last (a caveat a lawyer needs is not a hedge). Leading with it diluted them.
READER_CHECKS = ("unsurprising", "writer_side", "wrong_register")


def checks_copy_jev(units, key, audience=None):
    base = "This is a title, headline, ad or short piece of copy. Answer yes only if it has this problem. "
    qs = {}
    for k in COPY:
        if k == "wrong_register" and not audience: continue  # register is only judgeable against a described reader
        if audience and k in READER_CHECKS:
            qs[k] = (f"This is copy for this reader: {audience}. Judge it as that reader would. "
                     f"Answer yes only if it has this problem. {COPY_DEFS[k]}")
        elif audience and k == "concedes_or_hedges":
            qs[k] = f"{base}{COPY_DEFS[k]} The reader: {audience}. A caveat this reader needs to decide is not a hit."
        else:
            qs[k] = base + COPY_DEFS[k]
    def one(u):
        r = v1.ask_jev(u["text"], qs, key)
        return {k: round(v.get("noul", 0.0), 3) for k, v in r["answers"].items()}, r.get("usage", {}).get("input_tokens", 0)
    with ThreadPoolExecutor(4) as ex:
        res = list(ex.map(one, units))
    out = [dict() for _ in units]
    for i, u in enumerate(units):
        out[i]["_probs"] = res[i][0]  # raw probabilities, so a caller can rerun lines near a threshold
        for k, pr in res[i][0].items():
            if pr >= COPY_THRESHOLDS.get(k, COPY_THRESHOLD):
                out[i][k] = {"p": 1.0, "quote": f"point {COPY_POINT[k]}: {COPY_REASONS[k]} (Jev {pr:.2f})", "fix": ""}
        for k, why in copy_regex(u["text"]).items():
            out[i][k] = {"p": 1.0, "quote": f"point {COPY_POINT[k]}: {why}", "fix": ""}
    return out, sum(r[1] for r in res)


def checks_copy(units, audience=None):
    numbered = "\n".join(f"[{i+1}] {u['text']}" for i, u in enumerate(units))
    names = [k for k in COPY if audience or k != "wrong_register"]
    prompt = COPY_TMPL.format(audience=_audience_line(audience) + ("\n" if audience else ""),
                              defs="\n".join(f"- {k}: {COPY_DEFS[k]}" for k in names), numbered=numbered)
    last = None
    for _ in range(3):
        try:
            j = _claude_json(prompt, COPY_SYS)
            break
        except Exception as e:
            last = e
    else:
        raise SystemExit(f"copy checks failed: {last}")
    out = [dict() for _ in units]
    for ln in j.get("lines", []):
        i = int(ln.get("n", 0)) - 1
        if not 0 <= i < len(units): continue
        for k, why in (ln.get("flags") or {}).items():
            if k in names and isinstance(why, str) and why.strip():
                out[i][k] = {"p": 1.0, "quote": f"point {COPY_POINT[k]}: {why.strip()}", "fix": ln.get("fix") or ""}
    for i, u in enumerate(units):
        for k, why in copy_regex(u["text"]).items():
            out[i].setdefault(k, {"p": 1.0, "quote": f"point {COPY_POINT[k]}: {why}", "fix": ""})
    return out


WEAK_ENDINGS = {"generic advice", "summary", "moral", "product aside"}


def rules_from_extract(p, i, op, end, script):
    """Named-check verdicts from Claude's extraction (fixed rules, no model judgement here)."""
    q = lambda x: x if isinstance(x, str) else "; ".join(map(str, x or []))
    figs, hits = p.get("figures") or [], {}
    tk = (p.get("takeaway") or "").lower()
    # "one more figure is not a takeaway": a takeaway that just repeats one of the figures does not count
    takeaway = bool(tk) and not any(str(f).lower() in tk for f in figs if str(f).strip())
    if len(figs) >= 2 and not takeaway:
        hits["numbers_no_takeaway"] = q(figs)
    if p.get("overprecise") and not takeaway:  # a precise figure the line turns into a takeaway is fine
        hits["overprecise_number"] = q(p["overprecise"])
    if p.get("results_list") and not p.get("perspective"):
        hits["results_list_no_perspective"] = "results listed with no view or conclusion"
    if script and p.get("visual_recital") and not takeaway:  # a recital that lands a takeaway is fine
        hits["tells_what_visuals_show"] = q(p["visual_recital"])
    if op and i == op[0] and (p.get("opening_flaws") or not p.get("hook")):
        hits["weak_opening"] = q(p.get("opening_flaws")) or "no angle or hook"
    if end is not None and i == end and p.get("ending_kind") in WEAK_ENDINGS:
        hits["weak_ending"] = f"{p.get('ending_kind')}" + ("" if p.get("reader_benefit") else ", no reader benefit")
    return hits


# ---- input
def load_units(path, force_script=False):
    """Return (units, script). Each unit: {"text", "cue", "visual"}."""
    raw = sys.stdin.read() if path == "-" else open(path).read()
    if path.endswith(".json"):
        d = json.loads(raw)
        if "scenes" in d:
            units = [{"text": s["text"].strip(), "cue": s.get("kind"), "visual": s.get("visual", "")}
                     for s in d["scenes"] if s.get("text", "").strip()]
            return units, True
    units, script = [], force_script
    for p in v1.paragraphs(raw):
        m = re.match(r"^\[(motion|face|visual|b-roll|broll|screen)[^\]]*\]\s*", p, re.I)
        cue = m.group(1).lower() if m else None
        if m: script = True; p = p[m.end():].strip()
        if p: units.append({"text": p, "cue": cue, "visual": ""})
    return units, script


def opening_ending(units):
    """Indices of the opening unit(s) and the ending unit. A title-only first line (< 12 words) is read with the next."""
    if not units: return [], None
    op = [0, 1] if len(units[0]["text"].split()) < 12 and len(units) > 1 else [0]
    return op, len(units) - 1


# ---- named checks: Claude backend
def checks_claude(units, script, op, end):
    sys.path.insert(0, XAR)
    import llm
    numbered = "\n\n".join(f"[{i+1}]{' (' + u['cue'] + ')' if u['cue'] else ''} {u['text']}" for i, u in enumerate(units))
    # written_register is a Jev-only question: the Claude extract has no field for it
    names = [k for k in NAMED if k != "written_register" and (script or k != "tells_what_visuals_show")]
    # an opening that is merged from two units is extracted as one: tell Claude both numbers
    prompt = CLAUDE_TMPL.format(
        genre="video narration script" if script else "piece of writing",
        defs="\n".join(f"- {k}: {DEFS[k]}" for k in names),
        opening=("paragraphs " + " and ".join(str(i + 1) for i in op) + ", read together; put the fields on the first")
        if op else "none in this text, skip",
        ending=f"paragraph {end + 1}" if end is not None else "none in this text, skip",
        visual_rule=VISUAL_RULE_ON if script else VISUAL_RULE_OFF, numbered=numbered)
    last = None
    for _ in range(3):
        try:
            j = llm.parse_json(llm.claude(prompt, system=CLAUDE_SYS, model=CHECK_MODEL, effort="low", max_tokens=8000))
            break
        except Exception as e:
            last = e
    else:
        raise SystemExit(f"named checks failed: {last}")
    out = [dict() for _ in units]
    for p in j.get("paragraphs", []):
        i = int(p.get("n", 0)) - 1
        if not 0 <= i < len(units): continue
        for k, quote in rules_from_extract(p, i, op, end, script).items():
            out[i][k] = {"p": 1.0, "quote": quote, "fix": p.get("fix") or ""}
        out[i]["_extract"] = p
    return out


# ---- named checks: Jev backend
def checks_jev(units, script, op, end, key):
    def one(i):
        qs = {k: JEV_Q[k] for k in ("numbers_no_takeaway", "overprecise_number", "results_list_no_perspective")}
        if script:
            qs["tells_what_visuals_show"] = JEV_Q["tells_what_visuals_show"]
            qs["written_register"] = JEV_Q["written_register"]
        state = units[i]["text"]
        if op and i == op[0]:
            qs["weak_opening"] = JEV_Q["weak_opening"].replace("this paragraph", "this opening")
            state = "\n\n".join(units[k]["text"] for k in op)
        if i == end: qs["weak_ending"] = JEV_Q["weak_ending"].replace("this paragraph", "this last paragraph")
        r = v1.ask_jev(state, qs, key)
        return {k: {"p": round(v.get("noul", 0.0), 3)} for k, v in r["answers"].items()}, r.get("usage", {}).get("input_tokens", 0)
    with ThreadPoolExecutor(4) as ex:
        res = list(ex.map(one, range(len(units))))
    return [r[0] for r in res], sum(r[1] for r in res)


def jev_tics(units, key, with_ai):
    qs = dict(TICS)
    if with_ai: qs["ai_sounding"] = v1.QUESTIONS["ai_sounding"]
    def one(u):
        r = v1.ask_jev(u["text"], qs, key)
        return {k: round(v.get("noul", 0.0), 3) for k, v in r["answers"].items()}, r.get("usage", {}).get("input_tokens", 0)
    with ThreadPoolExecutor(4) as ex:
        res = list(ex.map(one, units))
    return [r[0] for r in res], sum(r[1] for r in res)


def v2_score(report, threshold):
    pen = 0.0
    for it in report:
        pen += sum(SCORE_WEIGHTS.get(k, 1.0) for k, v in it["checks"].items() if v["p"] >= threshold)
        pen += SCORE_WEIGHTS["tic"] * sum(1 for k, v in it["tics"].items() if k != "ai_sounding" and v >= threshold)
        pen += SCORE_WEIGHTS["regex"] * len(it["regex"])
    # normalise by length (6 paragraphs = 1 unit) and map smoothly to 0-10, so two bad drafts still get ordered
    return round(10.0 * math.exp(-pen * 6.0 / max(6, len(report)) / 10.0), 2)


def run(path, script=False, checks="claude", jev=True, threshold=0.5, with_ai=False, xar_task=None, docs=False,
        copy=None, copy_backend="jev", audience=None, lang="en", narrator=False, constructs=False, mode=None, page=None):
    units, script = load_units(path, script)
    copy = is_copy(units) and not script if copy is None else copy
    if copy:  # titles and ad lines: one per line, even without blank lines between them
        units = [{"text": l.strip(), "cue": None, "visual": ""} for u in units for l in u["text"].splitlines() if l.strip()]
    op, end = opening_ending(units)
    key = os.environ.get("TYPESAFE_API_KEY", "")
    kp = os.path.expanduser("~/.config/typesafe.key")
    if not key and os.path.exists(kp): key = open(kp).read().strip()
    if ((jev and not copy) or checks == "jev" or (copy and copy_backend == "jev")) and not key: raise SystemExit("TYPESAFE_API_KEY not set (use --no-jev with --checks claude)")
    tokens = 0
    if docs: TICS.update(v1.DOCS_QUESTIONS)
    with ThreadPoolExecutor(2) as ex:
        fc = ((ex.submit(checks_copy_jev, units, key, audience) if copy_backend == "jev" else ex.submit(checks_copy, units, audience)) if copy else
              ex.submit(checks_claude, units, script, op, end) if checks == "claude" else
              ex.submit(checks_jev, units, script, op, end, key))
        # Jev's prose tics (gravitas_closer, rhetorical_question_hook...) misfire on one-line titles: off in copy mode
        ft = ex.submit(jev_tics, units, key, with_ai) if jev and not copy else None
        fn = ex.submit(never_checks, units, key, lang) if key else None
        fr = ex.submit(narrator_checks, units, key) if key and narrator else None
        fk = ex.submit(construct_checks, units, key, None, mode, page) if key and constructs else None
        named = fc.result()
        if isinstance(named, tuple): named, t = named; tokens += t
        if fn:
            nevers, t = fn.result(); tokens += t
            for i, n in enumerate(nevers):
                if n and copy:  # copy flags carry p 1.0 once over threshold; the raw score goes with the others
                    named[i].setdefault("_probs", {})["dramatic_never"] = n["dramatic_never"]["p"]
                    if n["dramatic_never"]["p"] >= NEVER_THRESHOLD: named[i]["dramatic_never"] = {**n["dramatic_never"], "p": 1.0}
                else: named[i].update(n)
        tics = [{} for _ in units]
        if ft: tics, t = ft.result(); tokens += t
        if fr:
            found, t = fr.result(); tokens += t
            for i, n in enumerate(found):
                if copy:
                    named[i].setdefault("_probs", {}).update({k: v["p"] for k, v in n.items() if not k.startswith("_")})
                    named[i].update({k: {**v, "p": 1.0} for k, v in n.items() if not k.startswith("_") and v["p"] >= NARRATOR_THRESHOLDS[k]})
                else: named[i].update({k: v for k, v in n.items() if not k.startswith("_")})
                named[i]["_narrator"] = n["_narrator"]
        if fk:
            found, t = fk.result(); tokens += t
            for i, n in enumerate(found):
                if copy:
                    named[i].setdefault("_probs", {}).update({k: v["p"] for k, v in n.items()})
                    named[i].update({k: {**v, "p": 1.0} for k, v in n.items() if v["p"] >= {**CONSTRUCT_THRESHOLDS, **CONSTRUCT2_THRESHOLDS}[k]})
                else: named[i].update(n)
    report = []
    for i, u in enumerate(units):
        report.append({"n": i + 1, "text": u["text"], "cue": u["cue"],
                       "role": "copy" if copy else "opening" if i in op else "ending" if i == end else "body",
                       "checks": {k: v for k, v in named[i].items() if not k.startswith("_")},
                       "extract": named[i].get("_extract"), "probs": named[i].get("_probs"), "narrator": named[i].get("_narrator"),
                       "tics": tics[i], "regex": v1.regex_hits(u["text"])})
    names = (COPY if copy else NAMED) + ["dramatic_never"] + (list(NARRATOR_DEFS) if narrator else []) + (list(CONSTRUCT_DEFS) + list(CONSTRUCT2_DEFS) if constructs else [])
    if copy:  # per line: 10 minus 2 per copy flag, so lines can be ranked against each other
        for it in report:
            it["line_score"] = max(0.0, 10.0 - sum(SCORE_WEIGHTS.get(k, 1.0) for k in it["checks"]) - 0.5 * len(it["regex"]))
    out = {"version": 2, "script": script, "copy": copy, "audience": audience if copy else None, "checks_backend": checks, "threshold": threshold,
           "v2_score": v2_score(report, threshold), "input_tokens": tokens,
           "named_hits": {k: [it["n"] for it in report if k in it["checks"] and it["checks"][k]["p"] >= threshold] for k in names},
           "paragraphs": report}
    if xar_task:
        sys.path.insert(0, XAR)
        import judge
        r = judge.judge("\n\n".join(u["text"] for u in units), xar_task, os.path.join(XAR, "best_metaprompt_v2.md"))
        out["xar"] = {"score": r["score"], "reasons": r["reasons"]}
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", help="text/markdown file, script.json, or - for stdin")
    ap.add_argument("--script", action="store_true", help="video narration (enables tells_what_visuals_show)")
    ap.add_argument("--copy", action="store_true", default=None, help="titles, headlines, ads, hooks: one per line "
                    "(on by default when every unit is <= 25 words; --no-copy turns it off)")
    ap.add_argument("--no-copy", dest="copy", action="store_false")
    ap.add_argument("--audience", help="copy mode: who reads this, from where, knowing what, deciding what "
                    "(free text). Every copy check is judged against it; wrong_register runs only with it")
    ap.add_argument("--copy-backend", choices=["jev", "claude"], default="jev",
                    help="copy checks on Jev (default, TYPESAFE_API_KEY; reason = the rule broken + Jev's probability) "
                    "or on Claude via claude -p (a written reason and a rewrite per flag)")
    ap.add_argument("--checks", choices=["claude", "jev"], default="claude", help="backend for the named checks")
    ap.add_argument("--no-jev", action="store_true", help="skip the Jev tic questions")
    ap.add_argument("--docs", action="store_true", help="add v1's docs-writing-rules tic questions")
    ap.add_argument("--threshold", type=float, default=0.5)
    ap.add_argument("--show-ai", action="store_true", help="also ask v1's generic ai_sounding (not used in the score)")
    ap.add_argument("--xar", action="store_true", help="also score with the XAR rubric judge (needs --task)")
    ap.add_argument("--task", help="for --xar: genre, sender, reader and the facts the text must carry")
    ap.add_argument("--lang", default="en", help="text language base code (en, pt): picks the word the dramatic_never prefilter looks for")
    ap.add_argument("--narrator", action="store_true", help="ask the narrator questions (invented scene, unnamed source, undefined subject) per sentence, with the quote")
    ap.add_argument("--constructs", action="store_true", help="ask the construct questions (contrast formulas, closers, hedges...) per paragraph, in one Jev call")
    ap.add_argument("--mode", help="inkling mode: picks the construct questions that belong to it")
    ap.add_argument("--page", help="inkling page kind (article, experiment...): an experiment write-up skips staged_experiment")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    if a.xar and not a.task: ap.error("--xar needs --task")
    r = run(a.file, a.script, a.checks, not a.no_jev, a.threshold, a.show_ai, a.task if a.xar else None, a.docs, a.copy, a.copy_backend, a.audience, a.lang, a.narrator, a.constructs, a.mode, a.page)
    if a.json:
        print(json.dumps(r, indent=1, ensure_ascii=False)); return
    clean = 0
    for it in r["paragraphs"]:
        hits = [(k, v) for k, v in it["checks"].items() if v["p"] >= a.threshold]
        tics = [(k, v) for k, v in it["tics"].items() if v >= a.threshold and k != "ai_sounding"]
        s = it["text"].replace("\n", " ")
        if not hits and not tics and not it["regex"]:
            clean += 1
            if r.get("copy"): print(f"\n[{it['n']} copy 10.0/10] {s}\n    clean")
            continue
        tag = f" copy {it['line_score']:.1f}/10" if r.get("copy") else (' ' + it['role'] if it['role'] != 'body' else '')
        print(f"\n[{it['n']}{tag}] {s[:160]}{'...' if len(s) > 160 else ''}")
        for k, v in hits:
            extra = (f": \"{v['quote']}\"" + (f" -> {v['fix']}" if v.get("fix") else "")) if v.get("quote") else f" {v['p']:.2f}"
            print(f"    CHECK  {k}{extra}")
        for pat, why in it["regex"]:
            print(f"    regex  {why}: \"{pat}\"")
        for k, v in sorted(tics, key=lambda kv: -kv[1]):
            print(f"    tic    {k} {v:.2f}")
        if a.show_ai and "ai_sounding" in it["tics"]:
            print(f"    (ai_sounding {it['tics']['ai_sounding']:.2f}, not scored)")
    hits = ", ".join(f"{k} {v}" for k, v in r["named_hits"].items() if v) or "none"
    if r.get("copy") and not r.get("audience"):
        print("\n(point 7 wrong_register not checked: pass --audience \"who reads, from where, knowing what, deciding what\")")
    print(f"\nv2_score {r['v2_score']}/10 | {clean}/{len(r['paragraphs'])} paragraphs clean | named hits: {hits}"
          + (f" | XAR {r['xar']['score']}/10" if "xar" in r else ""))


if __name__ == "__main__":
    main()
