import '@fontsource/material-icons';
import { setModules, setGpuSupported, setUseGpu } from './state.js';
import { loadDirectoryHandle } from './_controllers/fileSystemController.js';
import { initEventListeners } from './_events/workbenchEvents.js';
import { initWorker } from './_controllers/modelController.js';
import { initSidebarView } from './ui/views/SidebarView.js';
import { initWorkbenchView } from './ui/views/WorkbenchView.js';
import { dom } from './dom.js';

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

async function renderAppShell() {
    const appContainer = dom.appContainer();
    if (!appContainer) return;

    // Load the main HTML structure
    appContainer.innerHTML = `
        <div id="left-sidebar-container"></div>
        <main class="center-stage" id="center-stage"></main>
    `;

    const sidebarContainer = document.getElementById('left-sidebar-container');
    const centerStage = dom.centerStage();

    const [sidebarHtml, workbenchHtml] = await Promise.all([
        fetch('/components/left_sidebar.html').then(res => res.text()),
        fetch('/components/views/view_workbench.html').then(res => res.text()),
    ]);

    sidebarContainer.innerHTML = sidebarHtml;
    centerStage.innerHTML = workbenchHtml;
}

async function main() {
    // 1. Initialize System State
    const isGpuSupported = 'gpu' in navigator;
    setGpuSupported(isGpuSupported);
    setUseGpu(isGpuSupported);

    // 2. Load Module Configs
    const allModules = await loadAllModules();
    setModules(allModules);

    // 3. Render the main application shell
    await renderAppShell();

    // 4. Initialize Core Logic
    initWorker();
    initEventListeners(); // Event delegation (clicks, etc.)

    // 5. Initialize UI Views (which handle their own rendering and state subscriptions)
    initSidebarView();
    initWorkbenchView();

    // 6. Load Persistent State (triggers initial render events in components)
    await loadDirectoryHandle();
}

main();
