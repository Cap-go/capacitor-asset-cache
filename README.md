# @capgo/capacitor-asset-cache

<a href="https://capgo.app/"><img src="https://capgo.app/readme-banner.svg?repo=Cap-go/capacitor-asset-cache" alt="Capgo - Instant updates for Capacitor" /></a>

<div align="center">
  <h2><a href="https://capgo.app/?ref=plugin_asset_cache">Get instant updates for your app with Capgo</a></h2>
  <h2><a href="https://capgo.app/consulting/?ref=plugin_asset_cache">Missing a feature? We will build the plugin for you</a></h2>
</div>

Transparent persistent media cache for Capacitor images, videos, and other large CDN assets.

## Why Asset Cache?

`@capgo/capacitor-asset-cache` lets app code ask for a media source and bind it directly to an `<img>`, `<video>`, React component, Vue template, or any other web UI.

- Pass a CDN path like `videos/intro.mp4` and get a local display-ready URL back.
- Uses persistent app storage: iOS Application Support and Android internal files.
- `src(...)` and `resolve(...)` only resolve after a local file exists; if the plugin cannot create a local file, the call rejects.
- `bind(...)` updates an image or video element from `loading` to `ready` when the local file is available.
- Supports cache-only, TTL, ETag, Last-Modified, and always-revalidate modes.
- Keeps lower-level `get`, `list`, `remove`, and `clear` helpers for advanced cache management.

The cache is removed when the app is uninstalled, but it is not stored in the platform cache directory that the system may flush under pressure.

## Documentation

The most complete doc is available here: https://capgo.app/docs/plugins/asset-cache/

## Compatibility

| Plugin version | Capacitor compatibility | Maintained |
| -------------- | ----------------------- | ---------- |
| v8.\*.\*       | v8.\*.\*                | Yes        |
| v7.\*.\*       | v7.\*.\*                | On demand  |

## Install

```bash
npm install @capgo/capacitor-asset-cache
npx cap sync
```

## Usage

Configure the CDN once, then bind media elements to CDN paths. The element only receives the local webview URL after the native fetch is done.

```typescript
import { AssetCache } from '@capgo/capacitor-asset-cache';

AssetCache.configure({
  cdnUrl: 'https://cdn.example.com/assets/',
  revalidate: {
    strategy: 'ttl',
    maxAgeSeconds: 86400,
  },
});

const video = document.querySelector('video');
if (video) {
  AssetCache.bind(video, 'videos/intro.mp4');
}
```

```css
video[data-asset-cache-state='loading'],
img[data-asset-cache-state='loading'] {
  opacity: 0.4;
}

video[data-asset-cache-state='ready'],
img[data-asset-cache-state='ready'] {
  opacity: 1;
}
```

### React

```tsx
import { useEffect, useRef } from 'react';
import { AssetCache } from '@capgo/capacitor-asset-cache';

AssetCache.configure({ cdnUrl: 'https://cdn.example.com/assets/' });

export function HeroImage() {
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imageRef.current) return;

    const binding = AssetCache.bind(imageRef.current, 'hero.jpg');
    return () => binding.cancel();
  }, []);

  return <img ref={imageRef} alt="" />;
}
```

### Vue

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { AssetCache, type AssetCacheBinding } from '@capgo/capacitor-asset-cache';

const image = ref<HTMLImageElement | null>(null);
let binding: AssetCacheBinding | undefined;

onMounted(() => {
  if (image.value) {
    binding = AssetCache.bind(image.value, 'hero.jpg', {
      cdnUrl: 'https://cdn.example.com/assets/',
    });
  }
});

onUnmounted(() => binding?.cancel());
</script>

<template>
  <img ref="image" alt="" />
</template>
```

### Direct Source

Use `src(...)` when your framework already manages loading state. It resolves only after the local file is ready.

```typescript
const src = await AssetCache.src('images/hero.jpg');
```

### Protected Assets

Pass headers to the native fetch. The web element receives only the local file URL returned by the plugin.

```typescript
const src = await AssetCache.src('private/videos/intro.mp4', {
  cdnUrl: 'https://cdn.example.com/assets/',
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

### Inspect the Resolution

Use `resolve(...)` when you also want metadata about the local file resolution.

```typescript
const source = await AssetCache.resolve('images/hero.jpg');

console.log(source.src, source.fromCache, source.status);
```

### Advanced Cache Control

Use `get(...)` directly only when you need the raw native file metadata.

```typescript
const asset = await AssetCache.get({
  url: 'https://example.com/videos/intro.mp4',
  key: 'intro.mp4',
  revalidate: { strategy: 'etag' },
});
```

## Platform notes

- iOS stores files under Application Support and excludes the cache root from iCloud backup.
- Android stores files under the app internal files directory.
- Web uses the browser Cache API and localStorage metadata as a development fallback.

## API

<docgen-index>

* [`configure(...)`](#configure)
* [`resolve(...)`](#resolve)
* [`src(...)`](#src)
* [`bind(...)`](#bind)
* [`get(...)`](#get)
* [`remove(...)`](#remove)
* [`clear()`](#clear)
* [`list()`](#list)
* [`getCacheSize()`](#getcachesize)
* [`getPluginVersion()`](#getpluginversion)
* [Interfaces](#interfaces)
* [Type Aliases](#type-aliases)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

Persistent asset cache for large Capacitor images, videos, and other media.

### configure(...)

```typescript
configure(options: AssetCacheConfigOptions) => void
```

Set defaults for future `src(...)`, `resolve(...)`, and `bind(...)` calls.

| Param         | Type                                                                        |
| ------------- | --------------------------------------------------------------------------- |
| **`options`** | <code><a href="#assetcacheconfigoptions">AssetCacheConfigOptions</a></code> |

--------------------


### resolve(...)

```typescript
resolve(path: AssetCacheSourceInput, options?: AssetCacheSourceOptions | undefined) => Promise<ResolvedAssetSource>
```

Resolve a CDN path or remote URL into a local display-ready source URL.

| Param         | Type                                                                        |
| ------------- | --------------------------------------------------------------------------- |
| **`path`**    | <code><a href="#assetcachesourceinput">AssetCacheSourceInput</a></code>     |
| **`options`** | <code><a href="#assetcachesourceoptions">AssetCacheSourceOptions</a></code> |

**Returns:** <code>Promise&lt;<a href="#resolvedassetsource">ResolvedAssetSource</a>&gt;</code>

--------------------


### src(...)

```typescript
src(path: AssetCacheSourceInput, options?: AssetCacheSourceOptions | undefined) => Promise<string>
```

Resolve a CDN path or remote URL into a local string ready for `img.src` or `video.src`.

| Param         | Type                                                                        |
| ------------- | --------------------------------------------------------------------------- |
| **`path`**    | <code><a href="#assetcachesourceinput">AssetCacheSourceInput</a></code>     |
| **`options`** | <code><a href="#assetcachesourceoptions">AssetCacheSourceOptions</a></code> |

**Returns:** <code>Promise&lt;string&gt;</code>

--------------------


### bind(...)

```typescript
bind(element: AssetCacheBindableElement, path: AssetCacheSourceInput, options?: AssetCacheBindOptions | undefined) => AssetCacheBinding
```

Bind an image or video element to a local asset and update it when ready.

| Param         | Type                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| **`element`** | <code>any</code>                                                        |
| **`path`**    | <code><a href="#assetcachesourceinput">AssetCacheSourceInput</a></code> |
| **`options`** | <code><a href="#assetcachebindoptions">AssetCacheBindOptions</a></code> |

**Returns:** <code><a href="#assetcachebinding">AssetCacheBinding</a></code>

--------------------


### get(...)

```typescript
get(options: GetAssetOptions) => Promise<CachedAsset>
```

Resolve an asset URL into a local persistent file.

| Param         | Type                                                        |
| ------------- | ----------------------------------------------------------- |
| **`options`** | <code><a href="#getassetoptions">GetAssetOptions</a></code> |

**Returns:** <code>Promise&lt;<a href="#cachedasset">CachedAsset</a>&gt;</code>

--------------------


### remove(...)

```typescript
remove(options: AssetCacheKeyOptions) => Promise<RemoveAssetResult>
```

Remove one cached asset by key or URL.

| Param         | Type                                                                  |
| ------------- | --------------------------------------------------------------------- |
| **`options`** | <code><a href="#assetcachekeyoptions">AssetCacheKeyOptions</a></code> |

**Returns:** <code>Promise&lt;<a href="#removeassetresult">RemoveAssetResult</a>&gt;</code>

--------------------


### clear()

```typescript
clear() => Promise<ClearCacheResult>
```

Remove every cached asset managed by this plugin.

**Returns:** <code>Promise&lt;<a href="#clearcacheresult">ClearCacheResult</a>&gt;</code>

--------------------


### list()

```typescript
list() => Promise<AssetCacheListResult>
```

List cached assets that still exist on disk.

**Returns:** <code>Promise&lt;<a href="#assetcachelistresult">AssetCacheListResult</a>&gt;</code>

--------------------


### getCacheSize()

```typescript
getCacheSize() => Promise<AssetCacheSizeResult>
```

Return total cached asset bytes.

**Returns:** <code>Promise&lt;<a href="#assetcachesizeresult">AssetCacheSizeResult</a>&gt;</code>

--------------------


### getPluginVersion()

```typescript
getPluginVersion() => Promise<PluginVersionResult>
```

Returns the platform implementation version marker.

**Returns:** <code>Promise&lt;<a href="#pluginversionresult">PluginVersionResult</a>&gt;</code>

--------------------


### Interfaces


#### AssetCacheConfigOptions

Shared defaults used by `AssetCache.src(...)` and `AssetCache.resolve(...)`.

| Prop             | Type                                                                                | Description                                        |
| ---------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| **`cdnUrl`**     | <code>string</code>                                                                 | Base CDN URL used when `path` is relative.         |
| **`revalidate`** | <code><a href="#assetcacherevalidateoptions">AssetCacheRevalidateOptions</a></code> | Default revalidation behavior for resolved assets. |


#### AssetCacheRevalidateOptions

Revalidation options for cached assets.

| Prop                | Type                                                                                  | Description                                                                                                                                                                                                                    | Default              |
| ------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| **`strategy`**      | <code><a href="#assetcacherevalidatestrategy">AssetCacheRevalidateStrategy</a></code> | `never` returns the local file when present. `ttl` re-downloads after `maxAgeSeconds`. `always` revalidates on every call and sends known validators. `etag` and `last-modified` use the matching HTTP validator when present. | <code>'never'</code> |
| **`maxAgeSeconds`** | <code>number</code>                                                                   | Freshness window in seconds for the `ttl` strategy.                                                                                                                                                                            |                      |


#### ResolvedAssetSource

Result returned by `AssetCache.resolve(...)`.

| Prop            | Type                                                | Description                                                                                         |
| --------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **`src`**       | <code>string</code>                                 | Local URL ready to assign to `HTMLImageElement.src`, `HTMLVideoElement.src`, or framework bindings. |
| **`path`**      | <code>string</code>                                 | Original path passed by the caller.                                                                 |
| **`remoteUrl`** | <code>string</code>                                 | Fully resolved remote URL used by the native fetch.                                                 |
| **`key`**       | <code>string</code>                                 | Stable cache key used when one is known.                                                            |
| **`local`**     | <code>true</code>                                   | Always true for successful `resolve(...)` calls.                                                    |
| **`fromCache`** | <code>boolean</code>                                | True when the persistent local copy already existed before this call.                               |
| **`status`**    | <code>'hit' \| 'downloaded' \| 'notModified'</code> | Result of the local source resolution.                                                              |
| **`asset`**     | <code><a href="#cachedasset">CachedAsset</a></code> | Native cached asset payload for the local file.                                                     |


#### CachedAsset

A cached asset stored in app-owned persistent storage.

| Prop               | Type                                                | Description                                                      |
| ------------------ | --------------------------------------------------- | ---------------------------------------------------------------- |
| **`key`**          | <code>string</code>                                 | Stable cache key used by the plugin.                             |
| **`url`**          | <code>string</code>                                 | Original remote URL.                                             |
| **`path`**         | <code>string</code>                                 | Absolute native filesystem path.                                 |
| **`uri`**          | <code>string</code>                                 | File URI that can be passed to `Capacitor.convertFileSrc`.       |
| **`mimeType`**     | <code>string</code>                                 | Best known MIME type from the HTTP response.                     |
| **`etag`**         | <code>string</code>                                 | Last known HTTP ETag validator.                                  |
| **`lastModified`** | <code>string</code>                                 | Last known HTTP Last-Modified validator.                         |
| **`size`**         | <code>number</code>                                 | File size in bytes.                                              |
| **`updatedAt`**    | <code>number</code>                                 | Unix timestamp in milliseconds for the last successful download. |
| **`checkedAt`**    | <code>number</code>                                 | Unix timestamp in milliseconds for the last cache check.         |
| **`fromCache`**    | <code>boolean</code>                                | True when the returned asset came from local persistent storage. |
| **`status`**       | <code>'hit' \| 'downloaded' \| 'notModified'</code> | Result of the cache lookup.                                      |


#### ResolveAssetSourceOptions

Input used by `AssetCache.src(...)` and `AssetCache.resolve(...)`.

| Prop       | Type                | Description                                                                         |
| ---------- | ------------------- | ----------------------------------------------------------------------------------- |
| **`path`** | <code>string</code> | CDN-relative path or absolute remote URL for an image, video, or other media asset. |


#### AssetCacheSourceOptions

Per-asset options used by `AssetCache.src(...)` and `AssetCache.resolve(...)`.

| Prop          | Type                                    | Description                                                                     |
| ------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| **`key`**     | <code>string</code>                     | Stable cache key. Include a file extension when the URL path does not have one. |
| **`headers`** | <code>{ [key: string]: string; }</code> | HTTP headers sent while fetching or revalidating the asset.                     |


#### AssetCacheBinding

Binding returned by `AssetCache.bind(...)`.

| Prop          | Type                                                                               | Description                                                           |
| ------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **`promise`** | <code>Promise&lt;<a href="#resolvedassetsource">ResolvedAssetSource</a>&gt;</code> | Resolves with the local source metadata after the element is updated. |

| Method     | Signature     | Description                                                        |
| ---------- | ------------- | ------------------------------------------------------------------ |
| **cancel** | () =&gt; void | Prevents this binding from updating the element after it resolves. |


#### AssetCacheBindOptions

Options used by `AssetCache.bind(...)`.

| Prop                 | Type                | Description                                                  | Default                               |
| -------------------- | ------------------- | ------------------------------------------------------------ | ------------------------------------- |
| **`stateAttribute`** | <code>string</code> | Attribute updated with `loading`, `ready`, or `error`.       | <code>'data-asset-cache-state'</code> |
| **`loadingClass`**   | <code>string</code> | Class added while the local file is being fetched.           |                                       |
| **`readyClass`**     | <code>string</code> | Class added after the local file is assigned to the element. |                                       |
| **`errorClass`**     | <code>string</code> | Class added when local resolution fails.                     |                                       |


#### GetAssetOptions

Options used to resolve a remote asset into a local persistent file.

| Prop             | Type                                                                                | Description                                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`url`**        | <code>string</code>                                                                 | Remote asset URL.                                                                                                                                                                |
| **`key`**        | <code>string</code>                                                                 | Stable cache key. If omitted, the plugin uses a SHA-256 hash of `url`. Include a file extension when the asset will be used directly in an `&lt;img&gt;` or `&lt;video&gt;` tag. |
| **`headers`**    | <code>{ [key: string]: string; }</code>                                             | HTTP headers sent while fetching or revalidating the asset.                                                                                                                      |
| **`revalidate`** | <code><a href="#assetcacherevalidateoptions">AssetCacheRevalidateOptions</a></code> | Controls when an existing persistent file should be checked again.                                                                                                               |


#### RemoveAssetResult

Remove result.

| Prop          | Type                 | Description                                          |
| ------------- | -------------------- | ---------------------------------------------------- |
| **`removed`** | <code>boolean</code> | True when a cached file or its metadata was removed. |


#### AssetCacheKeyOptions

Identifies an asset by cache key or by URL. `key` wins when both are set.

| Prop      | Type                | Description                                      |
| --------- | ------------------- | ------------------------------------------------ |
| **`key`** | <code>string</code> | Stable cache key.                                |
| **`url`** | <code>string</code> | Remote asset URL used to derive the default key. |


#### ClearCacheResult

Clear result.

| Prop          | Type                | Description                      |
| ------------- | ------------------- | -------------------------------- |
| **`removed`** | <code>number</code> | Number of cached assets removed. |


#### AssetCacheListResult

List result.

| Prop         | Type                       | Description                                  |
| ------------ | -------------------------- | -------------------------------------------- |
| **`assets`** | <code>CachedAsset[]</code> | Cached assets that still have files on disk. |


#### AssetCacheSizeResult

Cache size result.

| Prop       | Type                | Description                       |
| ---------- | ------------------- | --------------------------------- |
| **`size`** | <code>number</code> | Total cached asset size in bytes. |


#### PluginVersionResult

Plugin version payload.

| Prop          | Type                | Description                                                 |
| ------------- | ------------------- | ----------------------------------------------------------- |
| **`version`** | <code>string</code> | Version identifier returned by the platform implementation. |


### Type Aliases


#### AssetCacheRevalidateStrategy

Revalidation mode used when an asset already exists in persistent storage.

<code>'never' | 'ttl' | 'always' | 'etag' | 'last-modified'</code>


#### AssetCacheSourceInput

Convenience input accepted by `AssetCache.src(...)` and `AssetCache.resolve(...)`.

<code>string | <a href="#resolveassetsourceoptions">ResolveAssetSourceOptions</a></code>


#### AssetCacheBindableElement

Element supported by `AssetCache.bind(...)`.

<code>HTMLImageElement | HTMLVideoElement</code>

</docgen-api>
