# dracula diff CLI Command

## Problem

The Phase 2 roadmap lists `dracula diff` as a deliverable but it's unbuilt. The stale snapshot warning (PR #2) tells developers their data is old, but not *what* changed. A developer who sees "snapshot is 14 days old" has no way to know if the drift matters for what they're working on without re-siphoning blindly.

## What to do

Add `npx dracula diff` that re-siphons to a temp directory and compares against the current blood-bank:

### Output format
- List added/removed/modified resources by type (products, collections, pages, etc.)
- For modified resources, show which top-level fields changed (e.g. "nomad-backpack: title, priceRange, variants")
- Summary line: `3 products changed, 1 collection added, 2 pages unchanged`

### Behavior
- Fetches live data to a temp directory (does not overwrite current blood-bank)
- Compares JSON files by handle — new files = added, missing files = removed, content diff = modified
- Should not require a full deep-diff of every nested field — top-level key comparison is enough for the summary
- Optional `--apply` flag to replace current blood-bank with the fresh data after reviewing the diff
- Exit code: 0 if no changes, 1 if changes detected (useful in CI)

### CLI integration
- Add to the switch statement in `src/cli/index.ts`
- Add to the help text

## Acceptance criteria

- `npx dracula diff` shows a human-readable summary of what changed since last siphon
- `npx dracula diff --apply` replaces blood-bank with fresh data
- Works without modifying the existing blood-bank until `--apply` is used
