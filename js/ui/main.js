import { dom } from '../dom.js';
import { state } from '../state.js';
import { renderModelsList } from './models.js';
import {
    renderComparisonView,
    renderOutputGrid,
    clearOutputGrid,
} from './workbench.js';

let timerInterval = null;

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

    renderModelsList();
}

export function renderGpuStatus() {
    const statusEl = dom.gpuStatusText();
    const toggleBtn = dom.gpuToggleBtn();
    if (!statusEl || !toggleBtn) return;

    if (state.gpuSupported) {
        statusEl.textContent = 'WebGPU supported and available.';
        toggleBtn.disabled = false;
        if (state.useGpu) {
            toggleBtn.textContent = 'GPU: ON';
            toggleBtn.classList.add('btn-primary');
            toggleBtn.classList.remove('btn-secondary');
        } else {
            toggleBtn.textContent = 'GPU: OFF';
            toggleBtn.classList.remove('btn-primary');
            toggleBtn.classList.add('btn-secondary');
        }
    } else {
        statusEl.textContent = 'WebGPU not supported by this browser/device.';
        toggleBtn.disabled = true;
        toggleBtn.textContent = 'GPU: N/A';
        toggleBtn.classList.remove('btn-primary');
        toggleBtn.classList.add('btn-secondary');
    }
}

function renderInputState() {
    const imageReady = state.inputDataURLs.length > 0;
    const isBatchMode = state.inputDataURLs.length > 1;

    const dropArea = dom.getImageDropArea();
    const placeholder = dom.getImageInputPlaceholder();
    const inputGrid = dom.imageInputGrid();
    const singlePreview = dom.getImagePreview();

    if (!dropArea || !placeholder || !inputGrid || !singlePreview) return;

    dropArea.dataset.controlsVisible = String(imageReady);
    dropArea.dataset.hasContent = String(imageReady);

    placeholder.classList.toggle('hidden', imageReady);
    singlePreview.classList.add('hidden');
    inputGrid.classList.add('hidden');

    if (imageReady) {
        if (isBatchMode) {
            inputGrid.classList.remove('hidden');
            inputGrid.innerHTML = '';
            state.inputDataURLs.forEach(url => {
                const item = document.createElement('div');
                item.className = 'grid-image-item';
                item.dataset.imageDataUrl = url;
                item.innerHTML = `<img src="${url}" alt="Input image"><div class="grid-item-overlay"><span class="material-icons">zoom_in</span></div>`;
                inputGrid.appendChild(item);
            });
        } else {
            singlePreview.classList.remove('hidden');
            singlePreview.src = state.inputDataURLs[0];
        }
    } else {
        singlePreview.src = '';
        inputGrid.innerHTML = '';
    }
}

function renderOutputState() {
    const outputReady = state.outputData !== null;
    const isBatchMode = Array.isArray(state.outputData);

    const outputArea = dom.outputArea();
    const singleOutputCanvas = dom.getOutputCanvas();
    const batchOutputGrid = dom.outputImageGrid();
    const outputPlaceholder = document.getElementById('output-placeholder');

    if (
        !outputArea ||
        !singleOutputCanvas ||
        !batchOutputGrid ||
        !outputPlaceholder
    )
        return;

    outputArea.dataset.controlsVisible = String(outputReady);
    outputPlaceholder.classList.toggle('hidden', outputReady);

    if (outputReady) {
        if (isBatchMode) {
            singleOutputCanvas.classList.add('hidden');
            batchOutputGrid.classList.remove('hidden');
            renderOutputGrid(state.outputData);
        } else {
            batchOutputGrid.classList.add('hidden');
            singleOutputCanvas.classList.remove('hidden');
            const imageData = state.outputData;
            if (imageData) {
                singleOutputCanvas.width = imageData.width;
                singleOutputCanvas.height = imageData.height;
                singleOutputCanvas
                    .getContext('2d')
                    .putImageData(imageData, 0, 0);
            }
        }
    } else {
        singleOutputCanvas.classList.add('hidden');
        batchOutputGrid.classList.add('hidden');
        const ctx = singleOutputCanvas.getContext('2d');
        ctx.clearRect(
            0,
            0,
            singleOutputCanvas.width,
            singleOutputCanvas.height
        );
        clearOutputGrid();
    }
}

export function renderStatus() {
    renderInputState();
    renderOutputState();

    const statusEl = dom.statusText();
    const runBtn = dom.runInferenceBtn();
    const timerEl = dom.inferenceTimer();
    if (!statusEl || !runBtn || !timerEl) return;

    const clearInputBtn = dom.clearInputBtn();
    const viewInputBtn = dom.viewInputBtn();
    const copyBtn = dom.copyBtn();
    const saveBtn = dom.saveBtn();
    const viewOutputBtn = dom.viewOutputBtn();
    const compareSlideBtn = dom.compareSlideBtn();
    const compareHoldBtn = dom.compareHoldBtn();

    const imageReady = state.inputDataURLs.length > 0;
    const outputReady = state.outputData !== null;
    const isSingleImageMode = imageReady && state.inputDataURLs.length === 1;
    const isBatchOutput = Array.isArray(state.outputData);

    if (state.isProcessing) {
        statusEl.textContent = 'Status: Processing... Please wait.';
        runBtn.disabled = true;
        runBtn.textContent = 'Processing...';
        if (clearInputBtn) clearInputBtn.disabled = true;
        if (viewInputBtn) viewInputBtn.disabled = true;
        if (copyBtn) copyBtn.disabled = true;
        if (saveBtn) saveBtn.disabled = true;
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
        } else if (!imageReady) {
            statusMessage += 'Choose an image to process.';
        } else {
            const modelStatus = state.modelStatuses[activeModule.id] || {};
            statusMessage += `Ready to process ${
                state.inputDataURLs.length
            } image(s). (Model: ${activeModule.name}, Variant: ${
                modelStatus.selectedVariant || 'Default'
            })`;
        }
        statusEl.textContent = statusMessage;
        runBtn.disabled = !state.activeModuleId || !imageReady;
        runBtn.textContent = 'Run Inference';
        if (state.inferenceDuration !== null) {
            timerEl.classList.remove('hidden');
            const finalTime = state.inferenceDuration / 1000;
            timerEl.textContent = `Finished in ${finalTime.toFixed(2)}s`;
        } else {
            timerEl.classList.add('hidden');
        }
        if (clearInputBtn) clearInputBtn.disabled = !imageReady;
        if (viewInputBtn) viewInputBtn.disabled = !isSingleImageMode;
        if (copyBtn) copyBtn.disabled = !outputReady || isBatchOutput;
        if (saveBtn) saveBtn.disabled = !outputReady;
        if (viewOutputBtn)
            viewOutputBtn.disabled = !outputReady || isBatchOutput;
        const canCompare = isSingleImageMode && outputReady && !isBatchOutput;
        if (compareSlideBtn) compareSlideBtn.disabled = !canCompare;
        if (compareHoldBtn) compareHoldBtn.disabled = !canCompare;
    }
}

export function renderFolderConnectionStatus() {
    const connectBtn = dom.connectFolderBtn();
    const pathText = dom.currentFolderPath();
    if (!connectBtn || !pathText) return;
    if (state.directoryHandle) {
        connectBtn.textContent = 'Change Folder';
        pathText.textContent = `Connected: ${state.directoryHandle.name}`;
    } else {
        connectBtn.textContent = 'Connect Folder';
        pathText.textContent = 'Not connected';
    }
}

export function openImageModal(type, sourceElementOrData) {
    const modal = dom.imageModal();
    const modalBody = dom.modalBody();
    if (!modal || !modalBody) return;
    modalBody.innerHTML = '';
    let contentElement;
    if (type === 'data-url') {
        contentElement = document.createElement('img');
        contentElement.src = sourceElementOrData;
    } else if (type === 'canvas') {
        contentElement = sourceElementOrData.cloneNode(true);
        const ctx = contentElement.getContext('2d');
        ctx.drawImage(sourceElementOrData, 0, 0);
    } else if (type === 'image-data') {
        contentElement = document.createElement('canvas');
        contentElement.width = sourceElementOrData.width;
        contentElement.height = sourceElementOrData.height;
        const ctx = contentElement.getContext('2d');
        ctx.putImageData(sourceElementOrData, 0, 0);
    } else {
        return;
    }
    contentElement.classList.add('modal-image');
    modalBody.appendChild(contentElement);
    modal.classList.remove('hidden');
}

export function closeImageModal() {
    const modal = dom.imageModal();
    const modalBody = dom.modalBody();
    if (modal) modal.classList.add('hidden');
    if (modalBody) modalBody.innerHTML = '';
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

export function applySidebarWidth() {
    const appContainer = dom.appContainer();
    if (appContainer) {
        appContainer.style.gridTemplateColumns = `${state.sidebarWidth}px 1fr`;
    }
}
