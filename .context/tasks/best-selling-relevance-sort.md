# BEST_SELLING and RELEVANCE Sort Keys in LocalProvider

## Problem

The LocalProvider silently falls back to title sort when `BEST_SELLING` or `RELEVANCE` sort keys are used. These are common sort keys in collection pages and search results. The README documents this gap but there's no warning at runtime.

## What to do

### BEST_SELLING
- Shopify determines best-selling by order volume, which we don't have locally
- Option A: Add a `salesRank` or `bestSellingRank` field to siphoned product data (requires Admin API or a heuristic)
- Option B: Use a deterministic proxy — e.g. sort by `totalInventory` descending as an approximation, or by product position in the collection's product list (since Shopify's default collection sort is often best-selling)
- At minimum: warn when `BEST_SELLING` is used so developers know the sort is approximate

### RELEVANCE
- Only meaningful for search queries — Shopify ranks by text match quality
- Implement a basic relevance scorer: exact title match > title contains > tag match > description match
- Weight matches in title higher than description

## Acceptance criteria

- `BEST_SELLING` sort returns a deterministic, reasonable order (not just title fallback) with a warning that it's approximate
- `RELEVANCE` sort in search results returns better-matching products first
