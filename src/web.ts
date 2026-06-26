import { WebPlugin } from '@capacitor/core';

import type {
  AssetCacheKeyOptions,
  AssetCacheListResult,
  AssetCacheNativePlugin,
  AssetCacheSizeResult,
  CachedAsset,
  ClearCacheResult,
  GetAssetOptions,
  PluginVersionResult,
  RemoveAssetResult,
} from './definitions';

const CACHE_NAME = 'capgo-asset-cache-v1';
const METADATA_PREFIX = 'capgo-asset-cache:';

export class AssetCacheWeb extends WebPlugin implements AssetCacheNativePlugin {
  async get(options: GetAssetOptions): Promise<CachedAsset> {
    if (!options.url) {
      throw new Error('url is required');
    }

    const key = await this.resolveKey(options);
    const metadata = this.readMetadata(key);
    const strategy = options.revalidate?.strategy ?? 'never';
    const now = Date.now();

    if (
      metadata &&
      (await this.hasCachedResponse(metadata.url)) &&
      this.isFresh(metadata, strategy, options.revalidate?.maxAgeSeconds)
    ) {
      return this.withCachedResponse(metadata, true, 'hit');
    }

    const headers = new Headers(options.headers ?? {});
    if (
      metadata &&
      (strategy === 'always' || strategy === 'etag' || strategy === 'ttl') &&
      metadata.etag &&
      !headers.has('If-None-Match')
    ) {
      headers.set('If-None-Match', metadata.etag);
    }
    if (
      metadata &&
      (strategy === 'always' || strategy === 'last-modified' || strategy === 'ttl') &&
      metadata.lastModified &&
      !headers.has('If-Modified-Since')
    ) {
      headers.set('If-Modified-Since', metadata.lastModified);
    }

    const response = await fetch(options.url, { headers });
    if (response.status === 304 && metadata) {
      const checked = { ...metadata, checkedAt: now };
      this.writeMetadata(checked);
      return this.withCachedResponse(checked, true, 'notModified');
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch asset: HTTP ${response.status}`);
    }

    const cache = await this.openCache();
    const responseForCache = response.clone();
    const blob = await response.blob();
    await cache.put(options.url, responseForCache);

    const next: CachedAsset = {
      key,
      url: options.url,
      path: options.url,
      uri: URL.createObjectURL(blob),
      mimeType: response.headers.get('Content-Type')?.split(';')[0] ?? undefined,
      etag: response.headers.get('ETag') ?? undefined,
      lastModified: response.headers.get('Last-Modified') ?? undefined,
      size: blob.size,
      updatedAt: now,
      checkedAt: now,
      fromCache: false,
      status: 'downloaded',
    };
    this.writeMetadata(next);
    return next;
  }

  async remove(options: AssetCacheKeyOptions): Promise<RemoveAssetResult> {
    const key = await this.resolveKey(options);
    const metadata = this.readMetadata(key);
    if (metadata) {
      const cache = await this.openCache();
      await cache.delete(metadata.url);
      localStorage.removeItem(this.metadataKey(key));
      return { removed: true };
    }

    return { removed: false };
  }

  async clear(): Promise<ClearCacheResult> {
    const keys = this.metadataKeys();
    for (const key of keys) {
      localStorage.removeItem(key);
    }
    await caches.delete(CACHE_NAME);
    return { removed: keys.length };
  }

  async list(): Promise<AssetCacheListResult> {
    const assets: CachedAsset[] = [];
    for (const key of this.metadataKeys()) {
      const metadata = this.readMetadata(key.slice(METADATA_PREFIX.length));
      if (metadata && (await this.hasCachedResponse(metadata.url))) {
        assets.push(await this.withCachedResponse(metadata, true, 'hit'));
      }
    }
    return { assets };
  }

  async getCacheSize(): Promise<AssetCacheSizeResult> {
    const { assets } = await this.list();
    return {
      size: assets.reduce((total, asset) => total + asset.size, 0),
    };
  }

  async getPluginVersion(): Promise<PluginVersionResult> {
    return {
      version: 'web',
    };
  }

  private async resolveKey(options: AssetCacheKeyOptions): Promise<string> {
    const source = options.key || options.url;
    if (!source) {
      throw new Error('key or url is required');
    }
    return this.sanitizeKey(options.key || (await this.sha256(source)));
  }

  private isFresh(asset: CachedAsset, strategy: string, maxAgeSeconds?: number): boolean {
    if (strategy === 'never') {
      return true;
    }
    if (strategy === 'ttl') {
      const ttl = Math.max(0, maxAgeSeconds ?? 0) * 1000;
      return ttl > 0 && Date.now() - asset.updatedAt < ttl;
    }
    return false;
  }

  private async withCachedResponse(
    asset: CachedAsset,
    fromCache: boolean,
    status: CachedAsset['status'],
  ): Promise<CachedAsset> {
    const cache = await this.openCache();
    const response = await cache.match(asset.url);
    if (!response) {
      return this.withStatus(asset, fromCache, status);
    }

    return {
      ...asset,
      uri: URL.createObjectURL(await response.blob()),
      fromCache,
      status,
    };
  }

  private withStatus(asset: CachedAsset, fromCache: boolean, status: CachedAsset['status']): CachedAsset {
    return {
      ...asset,
      fromCache,
      status,
    };
  }

  private async hasCachedResponse(url: string): Promise<boolean> {
    const cache = await this.openCache();
    return Boolean(await cache.match(url));
  }

  private async openCache(): Promise<Cache> {
    if (!('caches' in window)) {
      throw new Error('Cache API is not available in this browser');
    }
    return caches.open(CACHE_NAME);
  }

  private readMetadata(key: string): CachedAsset | undefined {
    const raw = localStorage.getItem(this.metadataKey(key));
    if (!raw) {
      return undefined;
    }
    return JSON.parse(raw) as CachedAsset;
  }

  private writeMetadata(asset: CachedAsset): void {
    localStorage.setItem(this.metadataKey(asset.key), JSON.stringify(asset));
  }

  private metadataKeys(): string[] {
    return Object.keys(localStorage).filter((key) => key.startsWith(METADATA_PREFIX));
  }

  private metadataKey(key: string): string {
    return `${METADATA_PREFIX}${key}`;
  }

  private sanitizeKey(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]/g, '_') || 'asset';
  }

  private async sha256(value: string): Promise<string> {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
}
