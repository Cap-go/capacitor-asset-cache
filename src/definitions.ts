/**
 * Revalidation mode used when an asset already exists in persistent storage.
 */
export type AssetCacheRevalidateStrategy = 'never' | 'ttl' | 'always' | 'etag' | 'last-modified';

/**
 * Revalidation options for cached assets.
 */
export interface AssetCacheRevalidateOptions {
  /**
   * `never` returns the local file when present.
   * `ttl` re-downloads after `maxAgeSeconds`.
   * `always` revalidates on every call and sends known validators.
   * `etag` and `last-modified` use the matching HTTP validator when present.
   *
   * @default 'never'
   */
  strategy?: AssetCacheRevalidateStrategy;

  /**
   * Freshness window in seconds for the `ttl` strategy.
   */
  maxAgeSeconds?: number;
}

/**
 * Shared defaults used by `AssetCache.src(...)` and `AssetCache.resolve(...)`.
 */
export interface AssetCacheConfigOptions {
  /**
   * Base CDN URL used when `path` is relative.
   */
  cdnUrl?: string;

  /**
   * Default revalidation behavior for resolved assets.
   */
  revalidate?: AssetCacheRevalidateOptions;
}

/**
 * Per-asset options used by `AssetCache.src(...)` and `AssetCache.resolve(...)`.
 */
export interface AssetCacheSourceOptions extends AssetCacheConfigOptions {
  /**
   * Stable cache key. Include a file extension when the URL path does not have one.
   */
  key?: string;

  /**
   * HTTP headers sent while fetching or revalidating the asset.
   */
  headers?: { [key: string]: string };
}

/**
 * Loading state written by `AssetCache.bind(...)`.
 */
export type AssetCacheBindState = 'loading' | 'ready' | 'error';

/**
 * Element supported by `AssetCache.bind(...)`.
 */
export type AssetCacheBindableElement = HTMLImageElement | HTMLVideoElement;

/**
 * Options used by `AssetCache.bind(...)`.
 */
export interface AssetCacheBindOptions extends AssetCacheSourceOptions {
  /**
   * Attribute updated with `loading`, `ready`, or `error`.
   *
   * @default 'data-asset-cache-state'
   */
  stateAttribute?: string;

  /**
   * Class added while the local file is being fetched.
   */
  loadingClass?: string;

  /**
   * Class added after the local file is assigned to the element.
   */
  readyClass?: string;

  /**
   * Class added when local resolution fails.
   */
  errorClass?: string;
}

/**
 * Binding returned by `AssetCache.bind(...)`.
 */
export interface AssetCacheBinding {
  /**
   * Resolves with the local source metadata after the element is updated.
   */
  promise: Promise<ResolvedAssetSource>;

  /**
   * Prevents this binding from updating the element after it resolves.
   */
  cancel(): void;
}

/**
 * Input used by `AssetCache.src(...)` and `AssetCache.resolve(...)`.
 */
export interface ResolveAssetSourceOptions extends AssetCacheSourceOptions {
  /**
   * CDN-relative path or absolute remote URL for an image, video, or other media asset.
   */
  path: string;
}

/**
 * Convenience input accepted by `AssetCache.src(...)` and `AssetCache.resolve(...)`.
 */
export type AssetCacheSourceInput = string | ResolveAssetSourceOptions;

/**
 * Options used to resolve a remote asset into a local persistent file.
 */
export interface GetAssetOptions {
  /**
   * Remote asset URL.
   */
  url: string;

  /**
   * Stable cache key. If omitted, the plugin uses a SHA-256 hash of `url`.
   * Include a file extension when the asset will be used directly in an
   * `<img>` or `<video>` tag.
   */
  key?: string;

  /**
   * HTTP headers sent while fetching or revalidating the asset.
   */
  headers?: { [key: string]: string };

  /**
   * Controls when an existing persistent file should be checked again.
   */
  revalidate?: AssetCacheRevalidateOptions;
}

/**
 * A cached asset stored in app-owned persistent storage.
 */
export interface CachedAsset {
  /**
   * Stable cache key used by the plugin.
   */
  key: string;

  /**
   * Original remote URL.
   */
  url: string;

  /**
   * Absolute native filesystem path.
   */
  path: string;

  /**
   * File URI that can be passed to `Capacitor.convertFileSrc`.
   */
  uri: string;

  /**
   * Best known MIME type from the HTTP response.
   */
  mimeType?: string;

  /**
   * Last known HTTP ETag validator.
   */
  etag?: string;

  /**
   * Last known HTTP Last-Modified validator.
   */
  lastModified?: string;

  /**
   * File size in bytes.
   */
  size: number;

  /**
   * Unix timestamp in milliseconds for the last successful download.
   */
  updatedAt: number;

  /**
   * Unix timestamp in milliseconds for the last cache check.
   */
  checkedAt: number;

  /**
   * True when the returned asset came from local persistent storage.
   */
  fromCache: boolean;

  /**
   * Result of the cache lookup.
   */
  status: 'hit' | 'downloaded' | 'notModified';
}

/**
 * Result returned by `AssetCache.resolve(...)`.
 */
export interface ResolvedAssetSource {
  /**
   * Local URL ready to assign to `HTMLImageElement.src`, `HTMLVideoElement.src`, or framework bindings.
   */
  src: string;

  /**
   * Original path passed by the caller.
   */
  path: string;

  /**
   * Fully resolved remote URL used by the native fetch.
   */
  remoteUrl: string;

  /**
   * Stable cache key used when one is known.
   */
  key?: string;

  /**
   * Always true for successful `resolve(...)` calls.
   */
  local: true;

  /**
   * True when the persistent local copy already existed before this call.
   */
  fromCache: boolean;

  /**
   * Result of the local source resolution.
   */
  status: 'hit' | 'downloaded' | 'notModified';

  /**
   * Native cached asset payload for the local file.
   */
  asset: CachedAsset;
}

/**
 * Identifies an asset by cache key or by URL. `key` wins when both are set.
 */
export interface AssetCacheKeyOptions {
  /**
   * Stable cache key.
   */
  key?: string;

  /**
   * Remote asset URL used to derive the default key.
   */
  url?: string;
}

/**
 * Remove result.
 */
export interface RemoveAssetResult {
  /**
   * True when a cached file or its metadata was removed.
   */
  removed: boolean;
}

/**
 * Clear result.
 */
export interface ClearCacheResult {
  /**
   * Number of cached assets removed.
   */
  removed: number;
}

/**
 * List result.
 */
export interface AssetCacheListResult {
  /**
   * Cached assets that still have files on disk.
   */
  assets: CachedAsset[];
}

/**
 * Cache size result.
 */
export interface AssetCacheSizeResult {
  /**
   * Total cached asset size in bytes.
   */
  size: number;
}

/**
 * Plugin version payload.
 */
export interface PluginVersionResult {
  /**
   * Version identifier returned by the platform implementation.
   */
  version: string;
}

/**
 * Native persistent asset cache for large Capacitor images, videos, and other media.
 */
export interface AssetCacheNativePlugin {
  /**
   * Resolve an asset URL into a local persistent file.
   */
  get(options: GetAssetOptions): Promise<CachedAsset>;

  /**
   * Remove one cached asset by key or URL.
   */
  remove(options: AssetCacheKeyOptions): Promise<RemoveAssetResult>;

  /**
   * Remove every cached asset managed by this plugin.
   */
  clear(): Promise<ClearCacheResult>;

  /**
   * List cached assets that still exist on disk.
   */
  list(): Promise<AssetCacheListResult>;

  /**
   * Return total cached asset bytes.
   */
  getCacheSize(): Promise<AssetCacheSizeResult>;

  /**
   * Returns the platform implementation version marker.
   */
  getPluginVersion(): Promise<PluginVersionResult>;
}

/**
 * Persistent asset cache for large Capacitor images, videos, and other media.
 */
export interface AssetCachePlugin {
  /**
   * Set defaults for future `src(...)`, `resolve(...)`, and `bind(...)` calls.
   */
  configure(options: AssetCacheConfigOptions): void;

  /**
   * Resolve a CDN path or remote URL into a local display-ready source URL.
   */
  resolve(path: AssetCacheSourceInput, options?: AssetCacheSourceOptions): Promise<ResolvedAssetSource>;

  /**
   * Resolve a CDN path or remote URL into a local string ready for `img.src` or `video.src`.
   */
  src(path: AssetCacheSourceInput, options?: AssetCacheSourceOptions): Promise<string>;

  /**
   * Bind an image or video element to a local asset and update it when ready.
   */
  bind(
    element: AssetCacheBindableElement,
    path: AssetCacheSourceInput,
    options?: AssetCacheBindOptions,
  ): AssetCacheBinding;

  /**
   * Resolve an asset URL into a local persistent file.
   */
  get(options: GetAssetOptions): Promise<CachedAsset>;

  /**
   * Remove one cached asset by key or URL.
   */
  remove(options: AssetCacheKeyOptions): Promise<RemoveAssetResult>;

  /**
   * Remove every cached asset managed by this plugin.
   */
  clear(): Promise<ClearCacheResult>;

  /**
   * List cached assets that still exist on disk.
   */
  list(): Promise<AssetCacheListResult>;

  /**
   * Return total cached asset bytes.
   */
  getCacheSize(): Promise<AssetCacheSizeResult>;

  /**
   * Returns the platform implementation version marker.
   */
  getPluginVersion(): Promise<PluginVersionResult>;
}
