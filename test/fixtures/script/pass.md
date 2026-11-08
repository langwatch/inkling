---
minutes: 2
---

# Why your agent writes weak copy

## Start

This is a short lesson on why AI agents write weak copy, and what you can do about it. We'll look at three parts: why the writing fails, why an AI judge can't fix it, and what we learned from testing with readers.

## Why the writing fails

Let's start with why the writing fails. Our research traced the problem back to one cause: when an agent writes code, a test tells it when it got something wrong, but when it writes copy, nothing does. So it stops as soon as the text is accurate, even when no reader would care.

Another issue is that the model is trained to concede. It was rewarded for being fair and safe, so you get balance and hedges in places where an ad has to take a side.

## Why a judge can't fix it

That brings us to the second part: why not ask another AI to judge the writing? A team at Meta tested exactly that. Their AI judges picked the model's text over the expert's text most of the time, because to a model, model text is the most familiar text there is. So a judge only helps you once you tune it on lines a human approved and rejected.

## What we learned

The last part is what we learned when we tested our copy with readers. We wrote the reader's questions before the draft, the same way you write a test before the code. Then we gave the draft to a fresh reader with no context and checked whether they could answer them. When they could not, we knew which line to fix.

## Recap

So, to sum up: your agent writes weak copy because nothing tells it when it failed. You can give it that signal with tests written before the draft, a judge you calibrated yourself, and readers who start with no context.
