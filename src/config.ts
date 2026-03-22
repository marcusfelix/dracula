export interface DraculaSiphonConfig {
  metafieldNamespaces?: string[];
  metaobjectTypes?: string[];
  excludeCollections?: string[];
  productLimit?: number;
  includeArticleBody?: boolean;
}

export interface DraculaLocalProviderConfig {
  artificialDelay?: number;
  strictMode?: boolean;
}

export interface DraculaConfig {
  shop: string;
  storefrontAccessToken: string;
  apiVersion?: string;
  localDataDir?: string;
  locale?: string;
  currency?: string;
  siphon?: DraculaSiphonConfig;
  localProvider?: DraculaLocalProviderConfig;
}

export function defineConfig(config: DraculaConfig): DraculaConfig {
  return {
    apiVersion: "2025-04",
    localDataDir: ".dracula/blood-bank",
    locale: "en-US",
    ...config,
  };
}
