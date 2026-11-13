# Notes: traces from Postgres to ClickHouse

Raw notes from the engineer who did the move. All true.

- traces lived in one Postgres table + a jsonb column for spans, worked fine first year
- trouble started around 40M spans: trace list page p95 went from ~300ms to 9s, filter by metadata worst
- tried: GIN index on jsonb (writes slowed a lot, index bigger than table), partitioning by month (helped deletes, not search), read replica (helped load, not latency)
- what actually hurt: every list query scanned spans to compute cost/tokens per trace, aggregations over jsonb
- ClickHouse: columnar, aggregations fast, compression ~10x on spans
- moved in 3 steps: dual write for 3 weeks, backfill old data per project, flip reads behind a flag per project, kept Postgres for users/projects/settings
- surprises: ClickHouse doesn't like updates, we had trace "status" updated after the fact -> switched to append events + take latest at read time (ReplacingMergeTree, argMax)
- surprise 2: small inserts kill it, had to batch inserts (we buffer ~1s or 10k rows)
- surprise 3: deletes for retention are not row deletes, use TTL
- result: trace list p95 back to ~400ms at 10x the data, storage cost down
- if I did it again: start dual write earlier, design for append-only from day one, don't migrate settings tables, they're fine in Postgres
- one regret: we spent 2 months on the GIN index route
