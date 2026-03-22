# End-to-End Provider Parity Tests

## Problem

The Phase 3 roadmap calls for "same query, both providers, assert output parity" tests. Currently, LocalProvider and RemoteProvider are tested independently. There's no automated verification that the same call returns the same shape from both providers.

## What to do

- Create a test suite that runs the same set of queries against both LocalProvider (using fixtures) and RemoteProvider (using recorded responses or a mock HTTP layer)
- Assert that the response shapes are structurally identical: same keys present, same types, same connection/edge/pageInfo patterns
- This is not about value equality (local data differs from remote) — it's about structural parity
- Consider using msw or a similar tool to record Shopify API responses for the RemoteProvider side

### Queries to cover
- `products.get()` — single product shape
- `products.list()` — connection with pagination
- `collections.getProducts()` — nested connection
- `cart.create()` + `cart.addLines()` — cart mutation response shape
- `search.predictive()` — multi-type response shape

## Acceptance criteria

- A single test file that exercises both providers with the same calls
- Structural assertions (key presence, type checks) pass for all covered namespaces
- Runs in CI without needing a live Shopify store
