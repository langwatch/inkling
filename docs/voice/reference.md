# The reference voice

<!-- inkling-ignore-file hedges, contrast, negation, vague-majority: the excerpts are kept as said -->

This page collects explanations people gave each other in chat while building Inkling, written the way they would have said them. Some come from the founder, some from the agent replying to him, and two are points of the analysis that started Inkling. They are what a draft in [step 5](../process/5-draft.md) should sound like before anyone trims it: a person explaining something to someone who asked.

Read them before you draft. Then explain your topic the same way. Names of companies and people are replaced with ACME or removed, swearing is dropped, and typos are fixed. Everything else is as said.

## What the excerpts do

The same few moves come back in all of them:

- **A case first.** They start from something the listener has seen or done ("when you ask an AI to write a text, you pass it your whole reasoning"), and the general point comes after.
- **Chains of "so" and "because".** Each sentence leads into the next one, so the listener follows a cause instead of a list of facts.
- **I and you.** The speaker says what they did, saw or think, and talks to the listener directly.
- **A question, then its answer.** "Is it working? No."
- **The hard part, said plainly.** A guess is called a guess ("maybe the model is biased towards..."), a mistake is corrected first ("Correction to what I said earlier").
- **Quotes of how it sounds.** They say the bad line, then what it sounds like to a listener, then the better line.

What you won't find in them: headings, verbless labels such as "The second problem.", definitions such as "X is about Y", or proof words such as "it follows that".

## Excerpts

### Why the model stops at "accurate"

> Code has a judge, copy doesn't. Coding got good through training on verifiable rewards: the tests pass or they don't. Copy has no such reward, so how I write is a side effect of the rest of training. It's the same at work time: a test fails, a screenshot looks wrong, and I fix it on my own. A title has no failing test, so I stop at "accurate and complete", which is not the same as "a stranger would click".

First person, and every sentence hands a reason to the next with "so". The case ("a test fails, a screenshot looks wrong") makes the abstract point something you can picture, and the last line ends on the gap.

### Why the model hedges

> Training rewarded being fair and safe. So I concede ("a sandbox runs your agent"), add balance and hedge. An ad has to take a side, and that cuts against the habit.

Cause, then the behaviour with a real example of it, then the clash between the habit and the job, said as a clash in one plain clause.

### Why the model crams

> When you ask an AI to write a text, you pass it your whole reasoning, and then it's too eager to put all of it in there, instead of letting the reader read between the lines. Maybe the model is biased towards not losing anything you said, so it ends up cramming. But for people that's terrible: it doesn't hook, it doesn't grab attention. We need single ideas, so they come out stronger, and that goes against the model's training on code, where it can't lose any requirement.

It starts from what the listener does instead of from a term. The cause is offered as a guess ("maybe"), the harm is said from the reader's side, and the end ties it to a cause the listener already knows.

### Why simulated readers nitpick

> I think you're reading into it too much. You're imagining someone cared so much about our post that they'd judge it at that level, and that only happens if you're a giant company that faces scrutiny. Most people are simple: one real source is already a lot of trust, when everyone else is making things up. The readers in the test should know the context they're in and the one we're in. Otherwise, of course, if you ask them to look for a problem they'll keep finding one, your tests will never pass, and we go from the sweet spot back into slop because of all the nitpicking.

It disagrees first and then gives the because. The "otherwise, of course, if... they'll..." chain is one the listener can predict before it ends, which is why it convinces.

### The same point, from the agent's side

> Agreed. The test was the problem: I asked readers to hunt for doubts, so they always found some, and I imagined a reader giving a small company's post the scrutiny of an expert forum. Real readers are busy and generous; one real source puts us ahead of most posts.

It owns the mistake in the first line, then says what was done and what it caused, with "so" in the middle.

### Why a bridge pointed the wrong way

> Then the "so why is AI copy weak" line is a weird connection, because it sounds like "even though you're using this framework, why is it still bad?" And no, it's the opposite: the copy is weak because it isn't using a framework. It should be more like "but first, let's take a step back: why do we need a writing framework in the first place? Why is AI copy so weak?"

It quotes the line, says what it sounds like to a listener, says what was meant, and then gives the better line in the speaker's own words.

### Why the first name was wrong

> I don't like the name. It feels like what people are doing nowadays with formal verification, and it's not that. And the intro goes technical first, who cares about regexes? It feels like a testing framework. But it's not a testing framework, it's a writing framework! It's the whole process, beginning to end. It just turns out that deciding the audience, the tests you should have, the panel rounds and the linting are how the writing gets done.

A reaction, the reason for it, a question the listener might have asked, and a correction of the misreading. The "it's not a testing framework, it's a writing framework" turn corrects a real misreading, which is why it doesn't sound like a slogan.

### Why the thresholds stay loose

> It doesn't matter, you captured the feeling right. Those tests are more qualitative feedback than anything. If I reply to you to make it stricter, "no, it has to be a skip, not only 2x", "no, it has to be 3 to fail, not 2", that will only cause problems down the line. Use your best judgement. Like I said, the framework isn't strict, it's agent driven, a framework in the human sense: we found a gap, we put something in place for it, and now we use it with judgement, stricter or looser as we see fit.

It acts out the replies it warns against, in quotes, so the listener hears why they would go wrong instead of being told.

### How to reply to posts without writing badly

> Completely different strategy: keep collecting the posts and hot takes around our audience, open the few comments that worked, and really understand what landed, the jokes too. Then plug one into the other. If there's a viral post about A, where a very upvoted comment said B, and then a post about B shows up, you post A, reworded, but just barely, one small step, because every edit you make makes it worse.

A concrete mechanism with placeholders the listener can hold ("a post about A, a comment that said B"), and it ends on the because that makes an odd rule make sense.

### Why there should be a time budget

> Sometimes I just want a quick post, not the whole afternoon burning tokens in loops. And when you write a second post on the same topic with the lessons from the first, it'll be faster. So I think there should be a budget: I want the framework to tell me how much time to put in and what that gets us, 15 minutes, 30 minutes, how many rounds. At some point we just cut and it's good enough, because that's how any art or writing works.

It starts from what the speaker wants, takes one "so" to the proposal, and ends with a "because" that anyone who has made something will recognise.

### Who the email is really for

> Those people don't care. They don't care about the quality of their list; they're using AI too, like us, and they're in the business of link building. So just say it straight: hello, could you add us to this post, and we can give you a free account back for using it. Make it as easy as possible for them.

It says who the reader really is, and the advice follows from that with one "so". The example line is said the way it would be sent.

### Is it working

> Is it working? No. Across 12 posts we have about 70 views in total, no link clicks and no replies to us, so there's nothing to answer. The copy isn't the problem: a reply from an account with 2 followers gets ranked at the bottom of the thread, so almost no one sees it.

The question the listener asked, answered in one word, then the numbers, then the cause, joined with "so" both times.

### A correction

> Correction to what I said earlier: splitting the video into segments won't work. The 10 MB limit applies to a whole app version, not to each file, and the app's security policy blocks media from outside the app. So a video inside an app can never be more than about 9.5 MB, which is why it looks soft.

The mistake is corrected before anything else. It gives two facts, then "so", then a "which is why" that ties the cause back to what the listener saw on screen.

### Why the old tests missed it

> It had no mode for spoken scripts. The script was tested as a blog post: readers saw all the text at once, headings included, and could reread. Losing the thread and the jumps between sentences only show up when you listen, so nothing could catch them.

What happened, then why that hid the problem, with the "so" at the end carrying the conclusion.

### A video that won't play on a phone

> Thanks, the detail about the phone app helps. The new storage lets the app page load, but the video request probably goes out without your sign-in inside the app's embedded view, so it gets turned away. My tests only covered a normal browser tab.

It thanks the listener for the clue, gives the likely cause marked as likely, and admits the gap in its own testing.

### What ACME's extra check does

> A normal permission check says who may act. ACME adds a second check on every action: does this fit what the user asked, and the whole session so far? Their own conclusion is that the strongest control was the plain one: tight rules per agent.

It starts from the thing the listener already knows, then adds one step, and the new check is said as the question it asks.
