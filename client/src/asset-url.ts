declare const __ASSET_VERSION__: string;

/**
 * URL of a model or texture under public/assets/abraxas.
 * The query carries a hash of those files (see vite.config.ts), so the hosting rules can let browsers keep them for a
 * year: a changed file gets a new URL, an unchanged one is never requested again.
 */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}?v=${__ASSET_VERSION__}`;
}
