---
search: claude code cloud
---
<!-- The /claude-code/cloud ad landing page as the founder reviewed it on 2026-11-09, product renamed ACME and the mock customer Northwind. -->
# Keep your Claude Code working when your laptop is shut

Let it take tasks from your phone, on your own Claude login.

[cta: Start for free]

[mock: chat, Mara's direct messages with her Claude: Mara asks her Claude Code to fix a flaky test at night, and finds the branch pushed in the morning]

## Why it stops when you close the lid

Claude Code runs as a process on your laptop. When the lid closes, the laptop sleeps, the process pauses and the connection to Claude drops. tmux and screen keep the session around, but they can't keep a sleeping machine awake.

So the work only moves while you sit next to it. A long refactor, a test suite that takes twenty minutes, a bug you'd hand over before dinner: all of it waits for you to open the laptop again.

[cta: Give it its own computer]

[mock: race, a laptop beside its own computer: the laptop sleeps at 23:10 and the run freezes, while the computer keeps going and pushes the branch]

## What people hand it before closing the lid

The work that suits it best is the work you'd otherwise wait for. A dependency upgrade that breaks forty files. A test suite that takes half an hour and fails on the last step. A refactor you've planned all week but never had a quiet afternoon for.

Or a bug report that came in at six, which it can reproduce, fix and push to a branch before your morning coffee. You review the result the way you'd review a colleague's pull request: the branch, the diff and a short note about what changed and why.

[mock: chat, Mara's direct messages with her Claude: her Claude posts a morning summary of three overnight tasks, each with its branch and test results]

## The ways people keep it running

There are three common setups. Each one keeps Claude Code working after you close the lid, with different things for you to look after.

- **Keep the laptop awake**: caffeinate and a charger keep the session alive for a night.
  - The laptop stays busy, hot and on your desk
  - You can't check on it from your phone
- **Rent your own server**: Install Claude Code on a server, sign in and keep it alive with tmux.
  - You patch it and set up phone access
  - You pay for it while it sits idle
- **A computer in ACME**: Claude Code comes installed, you sign in once with your Claude account, and you message it from your phone.
  - Nothing to patch or keep alive
  - Sleeps when idle, wakes on your message

[cta: Start for free]

## It runs on your own Claude login

You sign in with the Claude account you already pay for, so the work counts against your Pro or Max plan, with no API key and no second bill for tokens.

It's the same Claude Code CLI you run in your terminal, with your settings, your skills and your CLAUDE.md. Your login works only for your own agents, so no one else in your workspace can run Claude on it.

[mock: login settings, Mara's agent: she signs it in with Claude once, and its settings show the Max plan and that only her agents use the login]

## Send it work from your phone

You can message your agent from the ACME iPhone app or any browser, the way you'd message a colleague. You can hand over a failing test on the train, ask what changed on main today, or have it open a pull request.

The answer lands in the same chat, so the thread is the record of what it did.

[cta: Start for free]

[mock: phone, Mara's direct messages with her Claude: on her phone, Mara asks what changed on main today and has her agent open a pull request]

## It keeps your repos and tools between tasks

Its computer has a home folder that stays put. Your checkouts, installed packages and build caches are still there the next time you message it, so it doesn't clone and install from scratch for every task.

Connect GitHub and it works on your repos and pushes branches for you to review.

[mock: work folder, Mara's computer: the folder still holds yesterday's checkouts and caches, so the next test run starts warm]

## It sleeps when there is nothing to do

A task in progress keeps the computer awake until it's done. Once it's idle, the computer goes to sleep, and your next message or a schedule you set wakes it with every file where you left it.

You don't pay for a server idling all night, and nothing is lost while it sleeps.

[cta: Close the laptop and let it work]

[mock: night timeline, Mara's computer: awake while it works, asleep in between, woken by her message in the morning]

## Who runs it and where your code lives

ACME is made by ACME B.V., a company in the Netherlands, and runs in the European Union. Your agents work on your own computer, a separate machine with no path to ACME's database.

What you write in ACME is stored encrypted with a key for your workspace, and ACME never trains AI models on it. The security page explains the details, and the docs cover every step of the setup.

[mock: trust card, Mara's computer: where it runs and who can use it, with links to the security page and the docs]

## Set it up in a few minutes

There's no server to rent and no SSH keys to copy around.

1. **Make an agent**: Create a free ACME account and pick Claude Code for your agent.
2. **Sign in with Claude**: Sign in once with your Claude account from its computer.
3. **Connect GitHub**: Give it the repos it should work on.
4. **Send the first task**: Message it from your phone or a browser, and close the laptop.

[cta: Start for free]

## Pricing

Every plan, Free included, comes with a Small computer: 1 vCPU, 2 GB of memory and 20 GB of disk. Your Claude usage comes out of your Claude subscription, and a bigger computer for heavier builds costs 10 to 70 USD a month more.

ACME is free for you and one colleague, and the Team plan starts at 20 USD a month when a third person joins.

## Questions

- **Is it the real Claude Code?** Yes. It's the same Claude Code CLI you run in your terminal, signed in with your own Claude account.
- **Does it run around the clock?** It runs whenever there is work, and a task in progress keeps it awake until it's done. Once idle, the computer sleeps until a message or a schedule you set wakes it.
- **Who else can use my Claude login?** No one. Your login works only for your own agents, and your computer runs no one else's.
- **Can I run tasks on a schedule?** Yes. You can ask it to check something every morning or run a job every Friday, and the schedule wakes the computer for it.
- **How does it get to my code?** Connect GitHub, and it works on your repos and pushes branches for you to review.
- **Can my team message it too?** Yes. Add a teammate or a channel to the agent, and they can message it directly, without a Claude account of their own.

## Close the laptop and let it work

[cta: Start for free]
