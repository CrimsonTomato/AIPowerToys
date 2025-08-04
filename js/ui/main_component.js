import { dom } from '../dom.js';
import { state } from '../state.js';
import { renderInputState } from './components/inputRenderer.js';
import { renderOutputState } from './components/outputRenderer.js';
import { eventBus } from '../_events/eventBus.js';
import { applyTheme } from './sidebar.js';

let timerInterval = null;
let uiCache = {};

export function cacheDOMElements() {
    uiCache = {
        statusEl: dom.statusText(),
        runBtn: dom.runInferenceBtn(),
        runBtnIcon: document.querySelector('#run-inference-btn .btn-icon'),
        runBtnText: document.querySelector('#run-inference-btn .btn-text'),
        timerEl: dom.inferenceTimer(),
        clearInputBtn: dom.clearInputBtn(),
        uploadImageBtn: dom.uploadImageBtn(),
        clearPointsBtn: dom.clearPointsBtn(),
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

export function renderStatus() {
    // If the workbench is currently re-rendering its DOM, abort this status update.
    // The update will be called manually by renderWorkbench when it's finished.
    if (state.ui.isRenderingWorkbench) return;

    renderInputState();
    renderOutputState();

    const {
        statusEl,
        runBtn,
        runBtnIcon,
        runBtnText,
        timerEl,
        clearInputBtn,
        uploadImageBtn,
        clearPointsBtn,
        copyBtn,
        saveBtn,
        viewInputBtn,
        viewOutputBtn,
        compareSlideBtn,
        compareHoldBtn,
    } = uiCache;

    if (!statusEl || !runBtn || !timerEl || !runBtnIcon || !runBtnText) return;

    const imageReady = state.workbench.input.imageURLs.length > 0;
    const audioReady = state.workbench.input.audioURL !== null;
    const inputReady = imageReady || audioReady;
    const outputReady = state.workbench.output.data !== null;

    const isSingleImageInput =
        imageReady && state.workbench.input.imageURLs.length === 1;
    const isImageOutput =
        outputReady && typeof state.workbench.output.data !== 'string';
    const isBatchImageOutput = Array.isArray(state.workbench.output.data);
    const activeModule = state.models.modules.find(
        m => m.id === state.models.activeModuleId
    );
    const isSamTask = activeModule?.task === 'image-segmentation-with-prompt';

    if (state.workbench.isProcessing) {
        statusEl.textContent = 'Status: Processing... Please wait.';
        runBtn.disabled = true;
        runBtnText.textContent = 'Processing...';
        runBtnIcon.className = 'btn-icon spinner';

        if (clearInputBtn) clearInputBtn.disabled = true;
        if (uploadImageBtn) uploadImageBtn.disabled = true;
        if (clearPointsBtn) clearPointsBtn.disabled = true;
        if (copyBtn) copyBtn.disabled = true;
        if (saveBtn) saveBtn.disabled = true;
        if (viewInputBtn) viewInputBtn.disabled = true;
        if (viewOutputBtn) viewOutputBtn.disabled = true;
        if (compareSlideBtn) compareSlideBtn.disabled = true;
        if (compareHoldBtn) compareHoldBtn.disabled = true;
        timerEl.classList.remove('hidden');
        if (!timerInterval) {
            timerInterval = setInterval(() => {
                const elapsed =
                    (Date.now() - state.workbench.inferenceStartTime) / 1000;
                timerEl.textContent = `Time: ${elapsed.toFixed(2)}s`;
            }, 100);
        }
    } else {
        clearInterval(timerInterval);
        timerInterval = null;
        let statusMessage = 'Status: ';

        if (!state.models.activeModuleId) {
            statusMessage += 'Select a model from the sidebar.';
        } else if (!inputReady) {
            statusMessage += 'Choose an input file to process.';
        } else if (isSamTask && state.workbench.input.points.length === 0) {
            statusMessage += 'Click on the image to add prompt points.';
        } else {
            const modelStatus =
                state.models.modelStatuses[activeModule.id] || {};
            const numInputs = imageReady
                ? state.workbench.input.imageURLs.length
                : 1;
            const inputType = imageReady ? 'image(s)' : 'audio file';
            statusMessage += `Ready to process ${numInputs} ${inputType}. (Model: ${
                activeModule.name
            }, Variant: ${modelStatus.selectedVariant || 'Default'})`;
        }
        statusEl.textContent = statusMessage;

        let isRunDisabled = !state.models.activeModuleId || !inputReady;
        if (isSamTask) {
            // For SAM, the run button is a fallback; primary trigger is clicking a point.
            // We disable it because it doesn't make sense to run without points.
            isRunDisabled =
                !state.models.activeModuleId ||
                !imageReady ||
                state.workbench.input.points.length === 0;
        }
        runBtn.disabled = isRunDisabled;

        runBtnText.textContent = 'Run Inference';
        runBtnIcon.className = 'btn-icon';

        if (state.workbench.inferenceDuration !== null) {
            timerEl.classList.remove('hidden');
            const finalTime = state.workbench.inferenceDuration / 1000;
            timerEl.textContent = `Finished in ${finalTime.toFixed(2)}s`;
        } else {
            timerEl.classList.add('hidden');
        }

        if (clearInputBtn) clearInputBtn.disabled = !inputReady;
        if (uploadImageBtn) uploadImageBtn.disabled = imageReady;
        if (clearPointsBtn)
            clearPointsBtn.disabled = state.workbench.input.points.length === 0;
        if (copyBtn) copyBtn.disabled = !outputReady;
        if (saveBtn) saveBtn.disabled = !outputReady;
        if (viewInputBtn) viewInputBtn.disabled = !isSingleImageInput;
        if (viewOutputBtn)
            viewOutputBtn.disabled = !isImageOutput || isBatchImageOutput;

        // Comparison buttons are always enabled for single image output, unless it's SAM (which is simplified now).
        // For simplified SAM, it's always "cutout", so comparison with original is still desired.
        const canCompare =
            isSingleImageInput && isImageOutput && !isBatchImageOutput;
        if (compareSlideBtn) compareSlideBtn.disabled = !canCompare;
        if (compareHoldBtn) compareHoldBtn.disabled = !canCompare;
    }
}

export function initMainComponentSubscriptions() {
    eventBus.on('themeChanged', applyTheme);

    const renderStatusEvents = [
        'inputDataChanged',
        'inputPointsChanged',
        'outputDataChanged',
        'processingStateChanged',
        'inferenceStateChanged',
        'selectedVariantChanged',
    ];
    renderStatusEvents.forEach(event => eventBus.on(event, renderStatus));

    renderStatus();
}
