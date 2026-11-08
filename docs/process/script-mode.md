# Writing a spoken script

A script for a narrated lesson or video is heard once, in order. Your listener cannot see the headings, cannot look back a paragraph, and decides every half minute whether to keep listening. Text that reads well on a page can lose them. Run the eight steps as usual with `--mode script`, and add the points below.

The limits below are defaults. A listen run shows where a viewer drifted. Use it with judgement and write down why when you move a limit for one script.

## Set the time budget first

Decide the length before the first line: `minutes: 3` in the front matter, or `--minutes 3` on the command line. At about 150 spoken words a minute, three minutes is 450 words. `script/over-time` warns on a script more than 10% over its budget. When it warns, cut a whole part or a whole example.

The budget is still the target, but followability beats length: previews, signposts and recaps are worth some extra time. Cut whole parts or examples before you cut any of them.

## Say the agenda

In the first 15% of the script, say what the parts are: "We'll look at three things: why AI writing fails, why an AI judge can't fix it, and what we learned from testing." If you give a count of parts, it has to match the parts that follow.

The same holds inside a part. Before walking through three tools, problems or steps, name them in one short line: "four steps: decide who reads it, write the tests, draft and check, and let readers try it." `script/list-no-preview` warns on a "The first..., The second..." walk with no such line before it.

## Open each part with one line tied to the agenda

The listener never hears a heading, so the first sentence of each part says the topic and where it sits in the agenda: "Let's start with why the writing fails." or "That brings us to the second part: why not ask another AI to judge the writing?"

## Put a transition at every switch

Every new paragraph starts with a connective or with words that point back to the last one: so, but, because, another, next, that is why, let's. A paragraph that opens on a bare label such as "Trained to concede." reads as a bold label on a page and as a jump when spoken. Say "Another issue is that AI was trained to concede." instead.

Name what an opener refers to. "A smaller version is..." leaves the listener asking "of what?". Say "A smaller version of the same problem is..." or join it to the paragraph it belongs to.

Each connective claims a relation. "So why is AI copy weak?" right after the framework intro reads as "even with the framework, why does it still fail?", while the intent was "let's step back: why do we need a framework at all?". Declare the intended relation as a bridge in the readers file and let [listen](../tools/listen.md#bridges) viewers say what they heard.

## Talk like a teacher

Talk to the listener. Use "we", "you" and "let's" at least every few sentences: six sentences in a row without them sound like a lecture about a third party. Skip lines about your own material, such as "the rules fit on one screen": say why the next part matters to the listener.

Use spoken words. "Left alone", "thus", "hence", "in order to" and "it is worth noting" sound read off a page; say "on its own", "so" and "to". `script/written-register` warns on them, and the last listen question asks viewers to quote any phrase a person would not say.

## Use staccato only on purpose

A run of fragments such as "Fast. Cheap. Local." sounds like a list of full stops when read aloud. `script/staccato-overuse` allows two per 300 spoken words,.

`script/fragment` fails each verbless fragment, such as "Beige soup.", on its own. Join it to the sentence before: "...every marketing line it has read: beige soup." When a pause is the point, keep one per script and mark it with `<!-- fragment: on purpose -->` on the line above. Quoted titles and items in an on-screen list are exempt.

## Use examples the listener understands, and state the cause

Pick examples your listener already knows, and say what each one proved, with the cause in the same sentence: "The judges picked the model's text most of the time, because to a model, model text is the most familiar text there is."

When a part lists several causes, call each one "one reason" or "the first reason". "The root cause" among six makes the other five sound like a contradiction; if one is the root of the others, say so and show how (`narrator/overclaim`). Describe training in the past tense, since it is over: "the model was trained to concede", "training rewarded passing tests". What the model does now stays in the present (`narrator/training-tense`).

## Check it by ear

`inkling check script.md --mode script` runs the rules on [script rules](../tools/script-rules.md). Then `inkling readers listen script.md` plays the script to simulated busy viewers in chunks of about 30 seconds and fails on a skip, a listener who lost the thread, or an example they could not explain. See [listen](../tools/listen.md).
