import './style.css';

import { Capacitor } from '@capacitor/core';
import { PluginTemplate } from '@capgo/capacitor-plugin-template';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

const output = document.getElementById('plugin-output');
const echoInput = document.getElementById('echo-value');
const echoButton = document.getElementById('run-echo');
const versionButton = document.getElementById('get-version');

const setOutput = (value) => {
  output.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
};

if (Capacitor.isNativePlatform()) {
  void CapacitorUpdater.notifyAppReady().catch((error) => {
    console.error('CapacitorUpdater.notifyAppReady failed', error);
  });
}

echoButton.addEventListener('click', async () => {
  try {
    const result = await PluginTemplate.echo({ value: echoInput.value });
    setOutput(result);
  } catch (error) {
    setOutput(`Error: ${error?.message ?? error}`);
  }
});

versionButton.addEventListener('click', async () => {
  try {
    const result = await PluginTemplate.getPluginVersion();
    setOutput(result);
  } catch (error) {
    setOutput(`Error: ${error?.message ?? error}`);
  }
});
