import '@fontsource/material-icons';
import { setModules, setGpuSupported, setUseGpu } from './state.js';
import { renderApp } from './ui/main_component.js';
import { loadDirectoryHandle } from './_controllers/fileSystemController.js';
import { initEventListeners } from './_events/workbenchEvents.js';
import { initWorker } from './_controllers/modelController.js';

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
    // Initialize system state
    const isGpuSupported = 'gpu' in navigator;
    setGpuSupported(isGpuSupported);
    setUseGpu(isGpuSupported); // Default to on if supported

    // Load module configs
    const allModules = await loadAllModules();
    setModules(allModules);

    // Initial render of the app structure
    await renderApp();

    // Load persistent state (this will trigger initial render events)
    await loadDirectoryHandle();

    // Initialize worker and all event listeners/subscriptions
    initWorker();
    initEventListeners();
}

main();
