import './style.css';

import { Capacitor } from '@capacitor/core';
import { AssetCache } from '@capgo/capacitor-asset-cache';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

const output = document.getElementById('plugin-output');
const pathInput = document.getElementById('asset-path');
const showButton = document.getElementById('show-asset');
const listButton = document.getElementById('list-assets');
const clearButton = document.getElementById('clear-cache');
const preview = document.getElementById('asset-preview');

let activeBinding;

AssetCache.configure({
  cdnUrl: 'https://picsum.photos/seed/capgo-asset-cache/',
  revalidate: {
    strategy: 'ttl',
    maxAgeSeconds: 3600,
  },
});

const setOutput = (value) => {
  output.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
};

if (Capacitor.isNativePlatform()) {
  void CapacitorUpdater.notifyAppReady().catch((error) => {
    console.error('CapacitorUpdater.notifyAppReady failed', error);
  });
}

showButton.addEventListener('click', async () => {
  activeBinding?.cancel();
  preview.removeAttribute('src');
  setOutput('Loading local asset...');

  try {
    activeBinding = AssetCache.bind(preview, pathInput.value, {
      key: 'demo-image.jpg',
    });
    setOutput(await activeBinding.promise);
  } catch (error) {
    setOutput(`Error: ${error?.message ?? error}`);
  }
});

listButton.addEventListener('click', async () => {
  try {
    setOutput(await AssetCache.list());
  } catch (error) {
    setOutput(`Error: ${error?.message ?? error}`);
  }
});

clearButton.addEventListener('click', async () => {
  activeBinding?.cancel();
  activeBinding = undefined;

  try {
    preview.removeAttribute('src');
    preview.removeAttribute('data-asset-cache-state');
    setOutput(await AssetCache.clear());
  } catch (error) {
    setOutput(`Error: ${error?.message ?? error}`);
  }
});
