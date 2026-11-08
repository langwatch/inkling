# Writing a spoken script

A script for a narrated lesson or video is heard once, in order. Your listener cannot see the headings, cannot look back a paragraph, and decides every half minute whether to keep listening. Text that reads well on a page can lose them. Run the eight steps as usual with `--mode script`, and add the points below.

The limits below are defaults. A listen run tells you where a viewer drifted, not whether the script passed, so use it with judgement and write down why when you move a limit for one script.

## Set the time budget first

Decide the length before the first line: `minutes: 3` in the front matter, or `--minutes 3` on the command line. At about 150 spoken words a minute, three minutes is 450 words. `script/over-time` fails a script more than 10% over its budget. When it fails, cut a whole part or a whole example.

## Say the agenda

In the first 15% of the script, say what the parts are: "We'll look at three things: why AI writing fails, why an AI judge can't fix it, and what we learned from testing." If you give a count of parts, it has to match the parts that follow.

## Open each part with one line tied to the agenda

The listener never hears a heading, so the first sentence of each part says the topic and where it sits in the agenda: "Let's start with why the writing fails." or "That brings us to the second part: why not ask another AI to judge the writing?"

## Put a transition at every switch

Every new paragraph starts with a connective or with words that point back to the last one: so, but, because, another, next, that is why, let's. A paragraph that opens on a bare label such as "Trained to concede." reads as a bold label on a page and as a jump when spoken. Say "Another issue is that AI is trained to concede." instead.

Name what an opener refers to. "A smaller version is..." leaves the listener asking "of what?". Say "A smaller version of the same problem is..." or join it to the paragraph it belongs to.

## Talk like a teacher

Talk to the listener. Use "we", "you" and "let's" at least every few sentences: six sentences in a row without them sound like a lecture about a third party. Skip lines about your own material, such as "the rules fit on one screen": say why the next part matters to the listener.

## Use staccato only on purpose

A run of fragments such as "Fast. Cheap. Local." sounds like a list of full stops when read aloud. `script/staccato-overuse` allows two per 300 spoken words. When a pause is the point, keep it and mark the script with `<!-- staccato: on purpose -->`.

## Use examples the listener understands, and state the cause

Pick examples your listener already knows, and say what each one proved, with the cause in the same sentence: "The judges picked the model's text most of the time, because to a model, model text is the most familiar text there is."

## Check it by ear

`inkling check script.md --mode script` runs the rules on [script rules](../tools/script-rules.md). Then `inkling readers listen script.md` plays the script to simulated busy viewers in chunks of about 30 seconds and fails on a skip, a listener who lost the thread, or an example they could not explain. See [listen](../tools/listen.md).
