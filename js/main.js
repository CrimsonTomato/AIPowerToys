import { setModules, setGpuSupported, setUseGpu } from './state.js';
import {
    renderApp,
    renderFolderConnectionStatus,
    renderGpuStatus,
} from './ui/main.js';
import { renderModelsList } from './ui/models.js';
import { renderWorkbench } from './ui/workbench.js';
import { initWorker } from './_controllers/modelController.js';
import { loadDirectoryHandle } from './_controllers/fileSystemController.js';
import {
    initWorkbenchEvents,
    initGlobalEvents,
} from './_events/workbenchEvents.js';

/**
 * Fetches all official module manifests defined in the central config file.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of module manifest objects.
 */
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
    // Check for GPU support first and set the default state.
    const isGpuSupported = 'gpu' in navigator;
    setGpuSupported(isGpuSupported);
    setUseGpu(isGpuSupported); // Default to ON if supported

    const allModules = await loadAllModules();
    setModules(allModules);

    await renderApp(); // Renders the main shell and models list

    // This needs to be called after renderApp() so the elements exist.
    renderGpuStatus();

    // This loads saved state (like theme/sidebar/useGpu) and re-checks models
    await loadDirectoryHandle();
    renderFolderConnectionStatus();

    // Re-render GPU status in case the loaded state changed the preference
    renderGpuStatus();

    initWorker();
    initWorkbenchEvents();
    initGlobalEvents();

    await renderWorkbench(); // Renders the initial (empty) workbench
}

main();
