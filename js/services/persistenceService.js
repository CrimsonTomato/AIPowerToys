import { get, set } from 'idb-keyval';
import {
    state,
    setSidebarWidth,
    setTheme,
    setUseGpu,
    setProcessingMode,
    setStarredModels,
    setModelOrder,
    setCollapsedModels,
} from '../state.js';

const APP_STATE_KEY = 'aiPowerToysState';

/**
 * Loads all persistent application state from IndexedDB.
 */
export async function loadAppState() {
    const savedState = await get(APP_STATE_KEY);
    if (savedState) {
        // Use state setters to ensure events are fired for initial UI render
        setTheme(savedState.theme || 'light');
        setSidebarWidth(savedState.sidebarWidth || 500);
        if (
            state.system.gpuSupported &&
            typeof savedState.useGpu !== 'undefined'
        ) {
            setUseGpu(savedState.useGpu);
        }
        setProcessingMode(savedState.processingMode || 'batch'); // Load saved processing mode

        // These don't have direct UI effects on their own, so they can be set directly
        setStarredModels(new Set(savedState.starredModels || []));
        setModelOrder(savedState.modelOrder || []);

        let collapsedModelsToLoad = new Set();
        if (
            savedState.collapsedModels &&
            Array.isArray(savedState.collapsedModels)
        ) {
            collapsedModelsToLoad = new Set(savedState.collapsedModels);
        } else {
            // Default to all collapsed if nothing is saved
            if (state.models.modules && state.models.modules.length > 0) {
                collapsedModelsToLoad = new Set(
                    state.models.modules.map(m => m.id)
                );
            }
        }
        setCollapsedModels(collapsedModelsToLoad);
    } else {
        // Default initial state if nothing is loaded
        setTheme('light');
        setSidebarWidth(500);
        if (state.models.modules && state.models.modules.length > 0) {
            setCollapsedModels(new Set(state.models.modules.map(m => m.id)));
        } else {
            setCollapsedModels(new Set());
        }
    }
}

/**
 * Saves the current application state to IndexedDB.
 */
export async function saveAppState() {
    const appState = {
        sidebarWidth: state.ui.sidebarWidth,
        theme: state.system.theme,
        useGpu: state.system.useGpu,
        processingMode: state.workbench.processingMode, // Save processing mode
        starredModels: Array.from(state.models.starredModels),
        modelOrder: state.models.modelOrder,
        collapsedModels: Array.from(state.models.collapsedModels),
    };
    await set(APP_STATE_KEY, appState);
}
