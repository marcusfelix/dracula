# Shopify Filter String Parser for LocalProvider

## Problem

The `filterByQuery()` function in `src/providers/local.ts` only does plain keyword matching. Shopify's structured filter syntax — `product_type:Apparel`, `tag:sale`, `available_for_sale:true`, `price:>50` — is not parsed. A console warning was added in PR #1 to make this gap visible, but the actual parser is unbuilt.

This is the core remaining gap between LocalProvider and RemoteProvider behavior.

## What to do

Build a filter string parser and evaluator that handles the subset of Shopify's query syntax used in Storefront API `products` and `collections` queries:

### Minimum viable surface
- `product_type:VALUE` — exact match on productType
- `tag:VALUE` — match against tags array
- `vendor:VALUE` — exact match on vendor
- `available_for_sale:true|false` — boolean filter on availableForSale
- `price:>N`, `price:<N`, `price:N` — numeric comparison on minVariantPrice
- `title:VALUE` — substring or exact match on title
- `created_at:>DATE`, `updated_at:>DATE` — date comparisons

### Parser behavior
- Multiple filters are AND-joined: `product_type:Apparel tag:sale` means both must match
- Quoted values: `tag:"free shipping"` should work
- Unstructured terms (no colon) fall back to current keyword matching behavior
- Unknown filter keys should warn but not throw

### Where it lives
- Extract into its own module (e.g. `src/providers/filter-parser.ts`) since it will grow
- Replace the current `filterByQuery()` with the new parser
- Remove the structured filter warning once the parser covers its surface

## Acceptance criteria

- `products.list({ query: 'product_type:Backpack tag:outdoor' })` returns only products matching both filters
- `products.list({ query: 'price:>50' })` filters by price correctly
- Mixed queries like `backpack tag:sale` use keyword matching for `backpack` and structured filtering for `tag:sale`
- Results match what Shopify's API would return for the same query on the same data
