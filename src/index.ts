export { DraculaClient } from "./client.js";
export { defineConfig } from "./config.js";
export type { DraculaConfig, DraculaSiphonConfig, DraculaLocalProviderConfig } from "./config.js";
export {
  DraculaError,
  DraculaNetworkError,
  DraculaNotFoundError,
  DraculaUserError,
  DraculaValidationError,
} from "./errors.js";
export type {
  DraculaProvider,
  ProductsNamespace,
  CollectionsNamespace,
  CartNamespace,
  ContentNamespace,
  MetaobjectsNamespace,
  SEONamespace,
  SearchNamespace,
} from "./providers/provider.js";

// Re-export all types for convenience
export * from "./types.js";
