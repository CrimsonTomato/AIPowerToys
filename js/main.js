import '@fontsource/material-icons';
import { setModules, setGpuSupported, setUseGpu } from './state.js';
import { renderApp } from './ui/main_component.js';
import { renderFolderConnectionStatus } from './ui/sidebar.js';
import { renderGpuStatus } from './ui/components/gpuStatus.js';
import { renderWorkbench } from './ui/workbench.js';
import { initWorker } from './_controllers/modelController.js';
import { loadDirectoryHandle } from './_controllers/fileSystemController.js';
import {
    initWorkbenchEvents,
    initGlobalEvents,
} from './_events/workbenchEvents.js';

async function loadAllModules() {
    try {
        const configResponse = await fetch('/modules.config.json');
        if (!configResponse.ok)
            throw new Error('Could not fetch module config.');

        const { official_modules } = await configResponse.json();

        const manifestPromises = official_modules.map(path =>
            fetch(path).then(res => res.json())
        );

        return await Promise.all(manifestPromises);
    } catch (error) {
        console.error('Failed to load modules:', error);
        alert(
            'Error: Could not load the application module configuration. The app may not function correctly.'
        );
        return [];
    }
}

async function main() {
    const isGpuSupported = 'gpu' in navigator;
    setGpuSupported(isGpuSupported);
    setUseGpu(isGpuSupported);

    const allModules = await loadAllModules();
    setModules(allModules);

    await renderApp();
    renderGpuStatus();

    await loadDirectoryHandle();
    renderFolderConnectionStatus();

    renderGpuStatus();

    initWorker();
    initGlobalEvents();
    initWorkbenchEvents();

    await renderWorkbench();
}

main();
