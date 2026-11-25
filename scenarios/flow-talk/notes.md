flaky bot notes
- bot watches Buildkite, if a test fails then passes on retry with no code change, it counts a flake
- 3 flakes in 7 days = it adds the test to quarantine.yml and opens a PR tagging the owner from CODEOWNERS
- quarantined tests still run but don't fail the build, results go to the #flaky channel
- first two weeks: 23 tests quarantined, 4 were real bugs (race in the payments retry, timezone in reports)
- manual reruns went from ~60 a week to 11
- people still rerun by hand because they don't trust it yet, that's what I want to change
- un-quarantine: fix the test, delete the line, the bot reruns it 20 times before merging
- what I'm not sure about: 3 in 7 days might be too eager for the e2e suite
