import { dom } from '../dom.js';
import { state } from '../state.js';
import { renderModelsList } from './models.js';
import { renderInputState } from './components/inputRenderer.js';
import { renderOutputState } from './components/outputRenderer.js';
import { eventBus } from '../_events/eventBus.js';

let timerInterval = null;

// --- NEW: Module-level cache for frequently accessed DOM elements ---
let uiCache = {};

/**
 * Caches references to frequently accessed DOM elements to improve performance
 * by avoiding repeated document queries.
 * This should be called after major UI components are rendered or re-rendered.
 */
export function cacheDOMElements() {
    uiCache = {
        statusEl: dom.statusText(),
        runBtn: dom.runInferenceBtn(),
        timerEl: dom.inferenceTimer(),
        clearInputBtn: dom.clearInputBtn(),
        copyBtn: dom.copyBtn(),
        saveBtn: dom.saveBtn(),
        viewInputBtn: dom.viewInputBtn(),
        viewOutputBtn: dom.viewOutputBtn(),
        compareSlideBtn: dom.compareSlideBtn(),
        compareHoldBtn: dom.compareHoldBtn(),
    };
}

export async function renderApp() {
    const appContainer = dom.appContainer();
    if (!appContainer) return;

    appContainer.innerHTML = `
        <div id="left-sidebar-container"></div>
        <main class="center-stage" id="center-stage"></main>
    `;

    const sidebarContainer = document.getElementById('left-sidebar-container');
    const response = await fetch('/components/left_sidebar.html');
    sidebarContainer.innerHTML = await response.text();

    const workbenchResponse = await fetch(
        '/components/views/view_workbench.html'
    );
    dom.centerStage().innerHTML = await workbenchResponse.text();
    cacheDOMElements();
}

/**
 * Renders the global status of the application, including button states and text.
 * Uses cached DOM elements for high performance.
 */
export function renderStatus() {
    renderInputState();
    renderOutputState();

    // --- MODIFIED: Use the cached elements instead of querying the DOM ---
    const {
        statusEl,
        runBtn,
        timerEl,
        clearInputBtn,
        copyBtn,
        saveBtn,
        viewInputBtn,
        viewOutputBtn,
        compareSlideBtn,
        compareHoldBtn,
    } = uiCache;

    if (!statusEl || !runBtn || !timerEl) return;

    const imageReady = state.inputDataURLs.length > 0;
    const audioReady = state.inputAudioURL !== null;
    const inputReady = imageReady || audioReady;
    const outputReady = state.outputData !== null;

    const isSingleImageInput = imageReady && state.inputDataURLs.length === 1;
    const isImageOutput = outputReady && typeof state.outputData !== 'string';
    const isBatchImageOutput = Array.isArray(state.outputData);

    if (state.isProcessing) {
        statusEl.textContent = 'Status: Processing... Please wait.';
        runBtn.disabled = true;
        runBtn.textContent = 'Processing...';
        if (clearInputBtn) clearInputBtn.disabled = true;
        if (copyBtn) copyBtn.disabled = true;
        if (saveBtn) saveBtn.disabled = true;
        if (viewInputBtn) viewInputBtn.disabled = true;
        if (viewOutputBtn) viewOutputBtn.disabled = true;
        if (compareSlideBtn) compareSlideBtn.disabled = true;
        if (compareHoldBtn) compareHoldBtn.disabled = true;
        timerEl.classList.remove('hidden');
        if (!timerInterval) {
            timerInterval = setInterval(() => {
                const elapsed = (Date.now() - state.inferenceStartTime) / 1000;
                timerEl.textContent = `Time: ${elapsed.toFixed(2)}s`;
            }, 100);
        }
    } else {
        clearInterval(timerInterval);
        timerInterval = null;
        let statusMessage = 'Status: ';
        const activeModule = state.modules.find(
            m => m.id === state.activeModuleId
        );
        if (!state.activeModuleId) {
            statusMessage += 'Select a model from the sidebar.';
        } else if (!inputReady) {
            statusMessage += 'Choose an input file to process.';
        } else {
            const modelStatus = state.modelStatuses[activeModule.id] || {};
            const numInputs = imageReady ? state.inputDataURLs.length : 1;
            const inputType = imageReady ? 'image(s)' : 'audio file';
            statusMessage += `Ready to process ${numInputs} ${inputType}. (Model: ${
                activeModule.name
            }, Variant: ${modelStatus.selectedVariant || 'Default'})`;
        }
        statusEl.textContent = statusMessage;
        runBtn.disabled = !state.activeModuleId || !inputReady;
        runBtn.textContent = 'Run Inference';
        if (state.inferenceDuration !== null) {
            timerEl.classList.remove('hidden');
            const finalTime = state.inferenceDuration / 1000;
            timerEl.textContent = `Finished in ${finalTime.toFixed(2)}s`;
        } else {
            timerEl.classList.add('hidden');
        }

        if (clearInputBtn) clearInputBtn.disabled = !inputReady;
        if (copyBtn) copyBtn.disabled = !outputReady;
        if (saveBtn) saveBtn.disabled = !outputReady;
        if (viewInputBtn) viewInputBtn.disabled = !isSingleImageInput;
        if (viewOutputBtn)
            viewOutputBtn.disabled = !isImageOutput || isBatchImageOutput;
        const canCompare =
            isSingleImageInput && isImageOutput && !isBatchImageOutput;
        if (compareSlideBtn) compareSlideBtn.disabled = !canCompare;
        if (compareHoldBtn) compareHoldBtn.disabled = !canCompare;
    }
}

export function applyTheme() {
    const isDark = state.theme === 'dark';
    document.documentElement.classList.toggle('dark-mode', isDark);
    const sunIcon = dom.themeIconSun();
    const moonIcon = dom.themeIconMoon();
    if (sunIcon && moonIcon) {
        sunIcon.classList.toggle('hidden', isDark);
        moonIcon.classList.toggle('hidden', !isDark);
    }
}

// --- NEW: Subscription setup ---
export function initMainComponentSubscriptions() {
    eventBus.on('themeChanged', applyTheme);

    // Any state change that could affect the status text or button states
    // should trigger a renderStatus() call.
    const renderStatusEvents = [
        'inputDataChanged',
        'outputDataChanged',
        'processingStateChanged',
        'inferenceStateChanged',
        'activeModuleChanged',
        'selectedVariantChanged',
    ];
    renderStatusEvents.forEach(event => eventBus.on(event, renderStatus));

    // Initial render calls based on initial state
    renderStatus();
}
