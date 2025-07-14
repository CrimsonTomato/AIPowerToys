import { setModules, setActiveModuleId, state } from './state.js';
import {
    renderApp,
    renderModelsList,
    renderWorkbench,
    renderFolderConnectionStatus,
} from './ui.js';
import { initWorker } from './_controllers/modelController.js';
import { loadDirectoryHandle } from './_controllers/fileSystemController.js';
import {
    initWorkbenchEvents,
    initGlobalEvents,
} from './_events/workbenchEvents.js'; // MODIFIED: Import initGlobalEvents

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
    const allModules = await loadAllModules();
    setModules(allModules);

    await renderApp();

    // MODIFIED: Removed default active module setting.
    // If you need to pre-select a module, do it here conditionally.
    // if (state.modules.length > 0) {
    //     setActiveModuleId(state.modules[0].id);
    // }
    renderModelsList(); // Renders models list, but none will be active initially

    await loadDirectoryHandle();
    renderFolderConnectionStatus(); // <-- NEW: Call on initial load

    initWorker();
    initWorkbenchEvents();
    initGlobalEvents(); // NEW: Initialize global theme events

    renderWorkbench(); // Will hide workbench if no active module
}

main();
