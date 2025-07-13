import { setModules } from './state.js';
import { renderApp } from './ui.js';
import { initWorker } from './_controllers/modelController.js';
import { loadDirectoryHandle } from './_controllers/fileSystemController.js';
import { initWorkbenchEvents } from './_events/workbenchEvents.js';

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
        return []; // Return an empty array on failure
    }
}

async function main() {
    // 1. Load all available module manifests dynamically
    const allModules = await loadAllModules();
    setModules(allModules);

    // 2. Render the basic app structure
    await renderApp();

    // 3. Try to load saved directory handle and check model statuses
    await loadDirectoryHandle();

    // 4. Initialize worker and events
    initWorker();
    initWorkbenchEvents();
}

main();
