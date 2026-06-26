import { Capacitor, registerPlugin } from '@capacitor/core';

import type {
  AssetCacheBindableElement,
  AssetCacheBinding,
  AssetCacheBindOptions,
  AssetCacheBindState,
  AssetCacheConfigOptions,
  AssetCacheNativePlugin,
  AssetCachePlugin,
  AssetCacheSourceInput,
  AssetCacheSourceOptions,
  GetAssetOptions,
  ResolveAssetSourceOptions,
  ResolvedAssetSource,
} from './definitions';

const nativePlugin = registerPlugin<AssetCacheNativePlugin>('AssetCache', {
  web: () => import('./web').then((m) => new m.AssetCacheWeb()),
});

let defaults: AssetCacheConfigOptions = {};

const configureAssetCache = (options: AssetCacheConfigOptions): void => {
  defaults = mergeSourceOptions(defaults, options);
};

const resolveAssetSource = async (
  path: AssetCacheSourceInput,
  options: AssetCacheSourceOptions = {},
): Promise<ResolvedAssetSource> => {
  const source = normalizeSourceOptions(path, options);
  const remoteUrl = resolveRemoteUrl(source.path, source.cdnUrl);

  if (!isCacheableRemoteUrl(remoteUrl)) {
    throw new Error(`AssetCache needs an absolute http(s) URL or a cdnUrl for relative paths: ${source.path}`);
  }

  const asset = await nativePlugin.get(toGetOptions(source, remoteUrl));
  return {
    src: Capacitor.convertFileSrc(asset.uri),
    path: source.path,
    remoteUrl,
    key: asset.key,
    local: true,
    fromCache: asset.fromCache,
    status: asset.status,
    asset,
  };
};

const assetSrc = async (path: AssetCacheSourceInput, options: AssetCacheSourceOptions = {}): Promise<string> => {
  const result = await resolveAssetSource(path, options);
  return result.src;
};

const bindAsset = (
  element: AssetCacheBindableElement,
  path: AssetCacheSourceInput,
  options: AssetCacheBindOptions = {},
): AssetCacheBinding => {
  let canceled = false;
  setElementState(element, 'loading', options);

  const promise = resolveAssetSource(path, options)
    .then((result) => {
      if (!canceled) {
        element.src = result.src;
        if (element instanceof HTMLVideoElement) {
          element.load();
        }
        setElementState(element, 'ready', options);
      }
      return result;
    })
    .catch((error) => {
      if (!canceled) {
        setElementState(element, 'error', options);
      }
      throw error;
    });

  return {
    promise,
    cancel: () => {
      canceled = true;
    },
  };
};

const AssetCache: AssetCachePlugin = {
  configure: configureAssetCache,
  resolve: resolveAssetSource,
  src: assetSrc,
  bind: bindAsset,
  get: (options) => nativePlugin.get(options),
  remove: (options) => nativePlugin.remove(options),
  clear: () => nativePlugin.clear(),
  list: () => nativePlugin.list(),
  getCacheSize: () => nativePlugin.getCacheSize(),
  getPluginVersion: () => nativePlugin.getPluginVersion(),
};

const normalizeSourceOptions = (
  path: AssetCacheSourceInput,
  options: AssetCacheSourceOptions,
): ResolveAssetSourceOptions => {
  const source: ResolveAssetSourceOptions =
    typeof path === 'string' ? { ...options, path } : { ...path, ...options, path: path.path };
  const merged = mergeSourceOptions(defaults, source);
  const normalizedPath = merged.path.trim();

  if (!normalizedPath) {
    throw new Error('path is required');
  }

  return {
    ...merged,
    path: normalizedPath,
  };
};

const mergeSourceOptions = <T extends AssetCacheConfigOptions>(
  base: AssetCacheConfigOptions,
  options: T,
): T & AssetCacheConfigOptions => {
  const revalidate =
    base.revalidate || options.revalidate ? { ...(base.revalidate ?? {}), ...(options.revalidate ?? {}) } : undefined;

  return {
    ...base,
    ...options,
    ...(revalidate ? { revalidate } : {}),
  };
};

const toGetOptions = (source: ResolveAssetSourceOptions, remoteUrl: string): GetAssetOptions => ({
  url: remoteUrl,
  key: source.key,
  headers: source.headers,
  revalidate: source.revalidate,
});

const setElementState = (
  element: AssetCacheBindableElement,
  state: AssetCacheBindState,
  options: AssetCacheBindOptions,
): void => {
  element.setAttribute(options.stateAttribute ?? 'data-asset-cache-state', state);
  toggleClass(element, options.loadingClass, state === 'loading');
  toggleClass(element, options.readyClass, state === 'ready');
  toggleClass(element, options.errorClass, state === 'error');
};

const toggleClass = (element: AssetCacheBindableElement, className: string | undefined, force: boolean): void => {
  if (className) {
    element.classList.toggle(className, force);
  }
};

const resolveRemoteUrl = (path: string, cdnUrl?: string): string => {
  if (hasUrlScheme(path) || !cdnUrl) {
    return path;
  }

  const base = cdnUrl.endsWith('/') ? cdnUrl : `${cdnUrl}/`;
  return new URL(path.replace(/^\/+/, ''), base).toString();
};

const hasUrlScheme = (value: string): boolean => /^[a-z][a-z0-9+.-]*:/i.test(value);

const isCacheableRemoteUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export * from './definitions';
export { AssetCache, assetSrc, bindAsset, configureAssetCache, resolveAssetSource };
