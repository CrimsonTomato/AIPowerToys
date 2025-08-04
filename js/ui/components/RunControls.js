import { dom } from '../../dom.js';
import { state } from '../../state.js';
import { eventBus } from '../../_events/eventBus.js';

let uiCache = {};
let timerInterval = null;

function cacheDOMElements() {
    const runBtn = dom.runInferenceBtn();
    uiCache = {
        runBtn,
        statusEl: dom.statusText(),
        timerEl: dom.inferenceTimer(),
        runBtnIcon: runBtn?.querySelector('.btn-icon'),
        runBtnText: runBtn?.querySelector('.btn-text'),
    };
}

function render() {
    const { runBtn, statusEl, timerEl, runBtnIcon, runBtnText } = uiCache;
    if (!runBtn || !statusEl || !timerEl || !runBtnIcon || !runBtnText) return;

    const { isProcessing, inferenceStartTime, inferenceDuration } =
        state.workbench;
    const { imageURLs, audioURL, points } = state.workbench.input;
    const { activeModuleId } = state.models;
    const { modelStatuses, modules } = state.models;

    const imageReady = imageURLs.length > 0;
    const audioReady = audioURL !== null;
    const inputReady = imageReady || audioReady;
    const activeModule = modules.find(m => m.id === activeModuleId);
    const isSamTask = activeModule?.task === 'image-segmentation-with-prompt';

    if (isProcessing) {
        statusEl.textContent = 'Status: Processing... Please wait.';
        runBtn.disabled = true;
        runBtnText.textContent = 'Processing...';
        runBtnIcon.className = 'btn-icon spinner';
        timerEl.classList.remove('hidden');

        if (!timerInterval) {
            timerInterval = setInterval(() => {
                const elapsed = (Date.now() - inferenceStartTime) / 1000;
                timerEl.textContent = `Time: ${elapsed.toFixed(2)}s`;
            }, 100);
        }
    } else {
        clearInterval(timerInterval);
        timerInterval = null;
        let statusMessage = 'Status: ';

        if (!activeModuleId) {
            statusMessage += 'Select a model from the sidebar.';
        } else if (!inputReady) {
            statusMessage += 'Choose an input file to process.';
        } else if (isSamTask && points.length === 0) {
            statusMessage += 'Click on the image to add prompt points.';
        } else {
            const modelStatus = modelStatuses[activeModuleId] || {};
            const numInputs = imageReady ? imageURLs.length : 1;
            const inputType = imageReady ? 'image(s)' : 'audio file';
            statusMessage += `Ready to process ${numInputs} ${inputType}. (Model: ${
                activeModule.name
            }, Variant: ${modelStatus.selectedVariant || 'Default'})`;
        }
        statusEl.textContent = statusMessage;

        let isRunDisabled = !activeModuleId || !inputReady;
        if (isSamTask) {
            isRunDisabled =
                !activeModuleId || !imageReady || points.length === 0;
        }
        runBtn.disabled = isRunDisabled;

        runBtnText.textContent = 'Run Inference';
        runBtnIcon.className = 'btn-icon';

        if (inferenceDuration !== null) {
            timerEl.classList.remove('hidden');
            const finalTime = inferenceDuration / 1000;
            timerEl.textContent = `Finished in ${finalTime.toFixed(2)}s`;
        } else {
            timerEl.classList.add('hidden');
        }
    }
}

export function initRunControls() {
    cacheDOMElements();
    const eventsToRender = [
        'inputDataChanged',
        'inputPointsChanged',
        'processingStateChanged',
        'inferenceStateChanged',
        'selectedVariantChanged',
        'activeModuleChanged',
    ];
    eventsToRender.forEach(event => eventBus.on(event, render));
    render();
}
