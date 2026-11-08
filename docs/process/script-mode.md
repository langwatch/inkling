# Writing a spoken script

A script for a narrated lesson or video is heard once, in order. Your listener cannot see the headings, cannot look back a paragraph, and decides every half minute whether to keep listening. Text that reads well on a page can lose them. Run the eight steps as usual with `--mode script`, and add the points below.

The limits below are defaults. A listen run shows where a viewer drifted. Use it with judgement and write down why when you move a limit for one script.

## Set the time budget first

Decide the length before the first line: `minutes: 3` in the front matter, or `--minutes 3` on the command line. At about 150 spoken words a minute, three minutes is 450 words. Use the budget to decide how many parts and examples fit, before you draft: a part that explains something takes 45 to 90 seconds, so three minutes holds two or three of them.

`script/over-time` warns on a script more than 10% over its budget. When it warns, cut a whole part or a whole example. Never squeeze the sentences inside a part to fit: a part cut to 40 words keeps its name and its claim and loses the "because" that explained it, and that is how a script turns into notes. Previews, signposts and recaps are worth some extra time too.

## Talk each part first

Draft the way [step 5](5-draft.md) says: explain each part aloud to one listener who asked about it, in the [reference voice](../voice/reference.md), before any agenda, headings or part openers exist. Then add the agenda and the openers below to that talk. A script built from a list of headings, each expanded into a paragraph, comes out as labels and definitions however many times you fix its lines.

## Say the agenda

In the first 15% of the script, say what the parts are: "We'll look at three things: why AI writing fails, why an AI judge can't fix it, and what we learned from testing." If you give a count of parts, it has to match the parts that follow.

The same holds inside a part. Before walking through three tools, problems or steps, name them in one short line: "four steps: decide who reads it, write the tests, draft and check, and let readers try it." `script/list-no-preview` warns on a "The first..., The second..." walk with no such line before it.

## Open each part with a sentence that says what happens

The listener never hears a heading, so the first sentence of each part says the topic and where it sits in the agenda. Say it as a sentence about what happens, the way you would in conversation: "Another thing that goes wrong is that the model hedges every claim." or "That brings us to the second part: why not ask another AI to judge the writing?"

Avoid opening on the name of the part followed by its definition, as in "The second problem is hedging. Hedging is when...". If you name a thing before the listener has heard what it does, you have to define it in the next sentence, and a script full of definitions is a glossary. Describe what happens first; the name can come after, once the listener can picture it.

## Put a transition at every switch

Every new paragraph starts with a connective or with words that point back to the last one: so, but, because, another, next, that is why, let's. A paragraph that opens on a bare label such as "Trained to concede." reads as a bold label on a page and as a jump when spoken. Say "Another issue is that AI was trained to concede." instead.

A script you talked first has these already. The check catches the places you added later.

Name what an opener refers to. "A smaller version is..." leaves the listener asking "of what?". Say "A smaller version of the same problem is..." or join it to the paragraph it belongs to.

Each connective claims a relation. "So why is AI copy weak?" right after the framework intro reads as "even with the framework, why does it still fail?", while the intent was "let's step back: why do we need a framework at all?". Declare the intended relation as a bridge in the readers file and let [listen](../tools/listen.md#bridges) viewers say what they heard.

## Talk like a teacher

Talk to the listener. Use "we", "you" and "let's" at least every few sentences: six sentences in a row without them sound like a lecture about a third party. Skip lines about your own material, such as "the rules fit on one screen": say why the next part matters to the listener.

Use spoken words. "Left alone", "thus", "hence", "in order to" and "it is worth noting" sound read off a page; say "on its own", "so" and "to". `script/written-register` warns on them, and the last listen question asks viewers to quote any phrase a person would not say.

Repeat on purpose. Keep one name for each thing and say it again, because a listener who hears "the model", then "the AI", then "the system" wonders whether those are three things. `script/elegant-variation` warns when a script rotates synonyms within four sentences.

Step labels such as "Next comes the draft", "Subsequently" and "Lastly" are the tutorial voice. Say "then" again: repeating then, so and and is normal when people talk, and no rule flags it. `script/step-label` warns on the labels.

## Use staccato only on purpose

A run of fragments such as "Fast. Cheap. Local." sounds like a list of full stops when read aloud. `script/staccato-overuse` allows two per 300 spoken words.

`script/fragment` fails each verbless fragment, such as "Beige soup.", on its own. Join it to the sentence before with a verb: "...every marketing line it has read, producing something like a beige soup." 

Short replies such as "No." or "Agreed." and imperatives such as "Use your judgement." are speech, and the rule leaves them alone. When a pause is the point, keep one per script and mark it with `<!-- fragment: on purpose -->` on the line above. Quoted titles and items in an on-screen list are exempt.

## Use examples the listener understands, and state the cause

Pick examples your listener already knows, and say what each one proved, with the cause in the same sentence: "The judges picked the model's text most of the time, because to a model, model text is the most familiar text there is."

When a part lists several causes, call each one "one reason" or "the first reason". "The root cause" among six makes the other five sound like a contradiction; if one is the root of the others, say so and show how (`narrator/overclaim`). Describe training in the past tense, since it is over: "the model was trained to concede", "training rewarded passing tests". What the model does now stays in the present (`narrator/training-tense`).

## Check it by ear

`inkling voice script.md` measures the draft against the [talking-voice profile](../voice/profile.md): sentence length and spread, contractions, I, we and you, questions, "then" against "next", and one name per thing. `inkling check script.md --mode script` runs the rules on [script rules](../tools/script-rules.md). Then `inkling readers listen script.md` plays the script to simulated busy viewers in chunks of about 30 seconds and fails on a skip, a listener who lost the thread, or an example they could not explain. See [listen](../tools/listen.md).
