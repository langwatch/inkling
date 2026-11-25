# CI notes (raw)

- we're 9 engineers, Postgres + Node monorepo, ~4,100 integration tests
- CI was 40 min p50 in August, people stopped waiting for it and merged on yellow
- biggest cost: every test file ran migrations on a fresh database, 380 migrations, ~6 s each time, 700 test files
- fix 1: build one template database per CI run after migrations, then each test file does CREATE DATABASE x TEMPLATE ci_template, ~40 ms instead of ~6 s
- needs no open connections to the template or Postgres refuses the copy, we hit that for a day (a leaked pool in a global setup file)
- fix 2: split by timing data instead of file count, 8 shards, slowest shard went from 19 min to 11
- fix 3: cached node_modules keyed by lockfile hash, saves ~90 s
- result: 12 min p50 in October, merges on yellow went from "most days" to almost never
- tried running tests in transactions and rolling back, broke ~300 tests that open their own connections, dropped it
- template DB trick works on any Postgres >= 9, nothing special
- side story: Jonas spent a weekend on a Rust test runner rewrite, abandoned
