# Talking-voice profile

<!-- inkling-ignore-file hedges, contrast, vague-majority, negation: the invented examples are talk on purpose -->

This page measures how the founder writes when he explains something in chat, how the agent replies he accepted read, and how two versions of the lesson script read, so a spoken script has numbers to aim at. `inkling voice <file>` reports a script against these targets, and `script/voice-profile` warns when three or more of them miss. Every target is a default to use with judgement.

## The data

The founder's lines come from ten chat exports and one page of spoken-style feedback, about 44,000 words in 2,900 sentences. The accepted agent replies are the 330 replies that got no pushback in the message after them, about 31,000 words. The scripts are lesson versions 11 and 12, about 1,400 and 1,100 words.

Quoted text, pasted posts, code and links were removed before counting. Only these totals leave the raw data; the analysis script and its output stay outside the repository.

| Measure | Founder | Accepted replies | Script v11 | Script v12 |
| --- | --- | --- | --- | --- |
| words per sentence, mean | 15.0 | 14.4 | 13.5 | 21.2 |
| words per sentence, spread (sd) | 14.6 | 8.7 | 9.2 | 10.2 |
| contractions per 100 words | 2.1 | 2.6 | 1.2 | 2.4 |
| written-only words per 1,000 | 1.0 | 0.2 | 0.7 | 0.0 |
| share of words in the 2,000 most common | 0.80 | 0.76 | 0.80 | 0.83 |
| "then" among step words (then, next, after that) | 0.86 | 0.57 | 0.71 | 0.89 |
| sentences over 30 words with 3 or more connectives | 0.05 | 0.02 | 0.03 | 0.15 |
| I and we per 100 words | 4.7 | 1.8 | 1.2 | 1.6 |
| you per 100 words | 1.7 | 2.2 | 1.5 | 2.3 |
| questions per 100 sentences | 35 | 1.7 | 2.9 | 1.9 |
| asides (brackets, "by the way") per 100 words | 0.5 | 0.8 | 0 | 0 |
| fillers and self-corrections per 100 words | 3.8 | 0.4 | 0.6 | 1.7 |
| share of 4-sentence windows with more than one name for the model | 0 | 0 | 0 | 0.25 |

## What the founder does differently

- He says "I" and "we" about three times as often as the scripts: what he tried, what he thinks, what we built.
- His sentence lengths swing widely. Short reactions sit next to long sentences that run on with "and", "so" and "because", where the scripts keep an even middle length.
- He asks questions all the time and answers them himself, and he adds asides in brackets. The scripts almost never do either.
- He repeats the plain word. "Then" makes up most of his step words, and he keeps one name for a thing instead of rotating synonyms.
- He corrects himself as he goes ("I mean", "or rather") and marks a guess as a guess.
- His vocabulary is not simpler than the scripts': the share of common words is the same. The difference is in how the sentences join, not in the words.

The last point matters for the fix. Swapping long words for short ones would not have changed v12; joining sentences the way a person talks would.

## Targets for a spoken script

The targets sit between the founder's chat and the accepted replies, since a script is cleaner than chat but still talk. Fillers, typos and swearing are left out on purpose: they belong to chat, not to a recorded lesson.

| Measure | Target | When it misses |
| --- | --- | --- |
| words per sentence, mean | 10 to 18 | split the longest sentences or join the shortest |
| spread | at least 7 | mix short and long sentences |
| contractions per 100 words | at least 2 | say it's, don't, you're, that's |
| written-only words per 1,000 | at most 1 | say so, then, to |
| share of common words | at least 0.75 | prefer the everyday word |
| -tion, -ity and -ment words | at most 3% | prefer the everyday word |
| connectives per 100 words | 3.5 to 8 | join the steps with and, so, because, but, then |
| run-on sentences | at most 6% | break a 30-word sentence with 3 connectives where the topic turns |
| questions per 100 sentences | at least 3 | ask the question the listener would ask, then answer it |
| I and we per 100 words | at least 1.5 | say what you did, saw or think |
| you per 100 words | at least 1.5 | talk to the listener |
| "then" among step words | at least half | say "then" again |
| rotated names for one thing | at most 0.15 | pick one name and repeat it |

Under 150 spoken words the measures are noisy, so `script/voice-profile` stays quiet and `inkling voice` marks the numbers as hints.

## In his style

These sentences are invented, written to show the measures at work:

> So I tried the judge on our own posts, and it agreed with me most of the time, which was weird. Why would it? Because it was grading text that looked like its own.

> Then you write the tests. Then you write the draft. And then, and this is the part people skip, you let someone who's never seen it read it.

> I mean, the model isn't wrong, it's just safe. And safe copy doesn't make anyone click.

## Sources

The common-word list in `data/top2000.txt` is the top 2,000 English words from [wordfreq](https://github.com/rspeer/wordfreq) (data CC BY-SA 4.0). The [reference voice](reference.md) holds real excerpts, cleared for the repository.
