import { dom } from './dom.js';
import { state, setComparisonMode } from './state.js';
import { getContainSize } from './utils.js'; // Import from new utils file

let inputImageForCompare = null; // Cache the loaded input image object
let imageBounds = { x: 0, y: 0, width: 0, height: 0 };

export function getImageBounds() {
    return imageBounds;
}

const comparisonResizeObserver = new ResizeObserver(() => {
    if (state.comparisonMode === 'slide') {
        renderComparisonView();
    }
});

export async function renderApp() {
    const centerStage = dom.centerStage();
    if (!centerStage) return;
    const response = await fetch('/components/views/view_workbench.html');
    const html = await response.text();
    centerStage.innerHTML = html;
    renderModelsList();
}

/**
 * Renders the entire list of model cards into the DOM.
 */
export function renderModelsList() {
    const container = dom.modelsList();
    if (!container) return;

    const activeId = state.activeModuleId;

    container.innerHTML = state.modules
        .map(module => {
            const statusInfo = state.modelStatuses[module.id] || {
                status: 'checking',
            };
            const isCollapsed = state.collapsedModels.has(module.id);
            const isActive = activeId === module.id;

            const currentDownloadProgress =
                statusInfo.status === 'downloading' &&
                state.downloadProgress.status === 'downloading' &&
                state.downloadProgress.moduleId === module.id
                    ? state.downloadProgress
                    : null;

            return `
            <div class="model-card"
                 data-active="${isActive}"
                 data-collapsed="${isCollapsed}">
                <div class="model-card-header" data-module-id="${module.id}">
                    <h3>${module.name}</h3>
                    <button class="model-card-toggle-btn">
                        <svg viewBox="0 0 24 24"><path fill="currentColor" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" /></svg>
                    </button>
                </div>
                <div class="model-card-content">
                    <p>${module.description}</p>
                    ${_renderModelStatus(statusInfo, currentDownloadProgress)}
                    <div class="model-controls">${_renderModelControls(
                        module,
                        statusInfo
                    )}</div>
                </div>
            </div>
        `;
        })
        .join('');
}

/**
 * Renders the HTML for the status paragraph and optional progress bar of a model card.
 * @private
 */
function _renderModelStatus(statusInfo, downloadProgressInfo = null) {
    let statusHtml = '';

    switch (statusInfo.status) {
        case 'checking':
            statusHtml = '<p>Status: Checking...</p>';
            break;
        case 'missing':
            statusHtml =
                '<p class="status-missing">Status: Repository not found</p>';
            break;
        case 'found':
            statusHtml = '<p class="status-found">Status: Found</p>';
            break;
        case 'downloading':
            if (downloadProgressInfo && downloadProgressInfo.total > 0) {
                const filenameParts = downloadProgressInfo.filename.split('/');
                const shortFilename =
                    filenameParts.length > 1
                        ? `.../${filenameParts[filenameParts.length - 1]}`
                        : downloadProgressInfo.filename;
                const percentage = Math.round(
                    (downloadProgressInfo.progress /
                        downloadProgressInfo.total) *
                        100
                );
                statusHtml = `
                    <p>Downloading ${shortFilename} (${downloadProgressInfo.progress}/${downloadProgressInfo.total})...</p>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                `;
            } else if (downloadProgressInfo) {
                statusHtml = `<p>Status: ${downloadProgressInfo.filename}</p>`;
            } else {
                statusHtml = `<p>Status: Downloading...</p>`;
            }
            break;
        default:
            statusHtml = '';
            break;
    }
    return statusHtml;
}

/**
 * Renders the HTML for the interactive controls of a model card.
 * @private
 */
function _renderModelControls(module, statusInfo) {
    if (statusInfo.status === 'found') {
        return `
            <select class="variant-selector" data-module-id="${module.id}">
                ${(statusInfo.discoveredVariants || [])
                    .map(
                        v =>
                            `<option value="${v.name}" ${
                                statusInfo.selectedVariant === v.name
                                    ? 'selected'
                                    : ''
                            }>${v.name}</option>`
                    )
                    .join('')}
            </select>
            <button class="select-model-btn btn" data-module-id="${
                module.id
            }">Use Model</button>
        `;
    } else if (statusInfo.status === 'missing') {
        return `<button class="download-btn btn" data-module-id="${module.id}">Download</button>`;
    }
    return '';
}

function renderRuntimeControls() {
    const container = document.getElementById('runtime-controls-container');
    if (!container) return;

    const activeModule = state.modules.find(m => m.id === state.activeModuleId);
    if (!activeModule || !activeModule.configurable_params) {
        container.innerHTML = '';
        return;
    }

    const currentConfigs = state.runtimeConfigs[activeModule.id] || {};

    container.innerHTML =
        `<h4>Runtime Options</h4>` +
        activeModule.configurable_params
            .map(param => {
                const currentValue = currentConfigs[param.id] ?? param.default;
                if (param.type === 'slider') {
                    return `
                <div class="runtime-control">
                    <label for="param-${param.id}">${param.name}: <span id="param-val-${param.id}">${currentValue}</span></label>
                    <input type="range"
                           id="param-${param.id}"
                           data-param-id="${param.id}"
                           data-module-id="${activeModule.id}"
                           min="${param.min}"
                           max="${param.max}"
                           step="${param.step}"
                           value="${currentValue}"
                    >
                </div>
            `;
                }
                return '';
            })
            .join('');
}

export async function renderWorkbench() {
    const workbenchArea = dom.workbenchArea();
    const inputArea = dom.workbenchInputArea();
    if (!workbenchArea || !inputArea) return;

    const oldOutputArea = dom.outputArea();
    if (oldOutputArea) {
        comparisonResizeObserver.unobserve(oldOutputArea);
    }

    const activeModule = state.modules.find(m => m.id === state.activeModuleId);
    const outputOptionsContainer = dom.outputOptionsContainer();
    const filenameInput = dom.outputFilenameInput();

    if (activeModule) {
        workbenchArea.classList.remove('hidden');
        const components = activeModule.ui_components;
        if (components) {
            const [inputHtml, outputHtml] = await Promise.all([
                components.workbench_input
                    ? fetch(components.workbench_input).then(res => res.text())
                    : Promise.resolve(''),
                components.workbench_output
                    ? fetch(components.workbench_output).then(res => res.text())
                    : Promise.resolve(''),
            ]);
            inputArea.innerHTML = inputHtml;
            dom.workbenchOutputArea().innerHTML = outputHtml;
        } else {
            inputArea.innerHTML = '';
            dom.workbenchOutputArea().innerHTML = '';
        }

        renderRuntimeControls();
        if (
            activeModule.default_filename &&
            outputOptionsContainer &&
            filenameInput
        ) {
            outputOptionsContainer.classList.remove('hidden');
            filenameInput.value = activeModule.default_filename;
        } else if (outputOptionsContainer) {
            outputOptionsContainer.classList.add('hidden');
        }
    } else {
        workbenchArea.classList.add('hidden');
        if (outputOptionsContainer)
            outputOptionsContainer.classList.add('hidden');
        inputArea.innerHTML = '';
        dom.workbenchOutputArea().innerHTML = '';
    }

    const newOutputArea = dom.outputArea();
    if (newOutputArea) {
        comparisonResizeObserver.observe(newOutputArea);
    }

    setComparisonMode('none');
    await renderComparisonView();
    renderStatus();
}

export function renderStatus() {
    const statusEl = dom.statusText();
    const runBtn = dom.runInferenceBtn();
    if (!statusEl || !runBtn) return;

    const inputControls = dom.inputControls();
    const outputControls = dom.outputControls();
    const copyBtn = dom.copyBtn();
    const saveBtn = dom.saveBtn();
    const viewInputBtn = dom.viewInputBtn();
    const viewOutputBtn = dom.viewOutputBtn();
    const compareSlideBtn = dom.compareSlideBtn();
    const compareHoldBtn = dom.compareHoldBtn();

    if (state.isProcessing) {
        statusEl.textContent = 'Status: Processing... Please wait.';
        runBtn.disabled = true;
        runBtn.textContent = 'Processing...';

        if (inputControls) inputControls.classList.add('hidden');
        if (outputControls) outputControls.classList.add('hidden');
        if (copyBtn) copyBtn.disabled = true;
        if (saveBtn) saveBtn.disabled = true;
        if (viewInputBtn) viewInputBtn.disabled = true;
        if (viewOutputBtn) viewOutputBtn.disabled = true;
        if (compareSlideBtn) compareSlideBtn.disabled = true;
        if (compareHoldBtn) compareHoldBtn.disabled = true;
    } else {
        const imagePreview = dom.getImagePreview();
        const imageReady =
            imagePreview?.src && !imagePreview.classList.contains('hidden');
        const outputReady = state.outputData !== null;

        let statusMessage = 'Status: ';
        const activeModule = state.modules.find(
            m => m.id === state.activeModuleId
        );
        const modelStatus = activeModule
            ? state.modelStatuses[activeModule.id]
            : null;

        if (!state.activeModuleId) {
            statusMessage += 'Select a model from the sidebar.';
        } else if (!imageReady) {
            statusMessage += 'Choose an image to process.';
        } else {
            statusMessage += 'Ready';
            if (modelStatus && modelStatus.selectedVariant) {
                statusMessage += ` (Model: ${activeModule.name}, Variant: ${modelStatus.selectedVariant})`;
            }
        }
        statusEl.textContent = statusMessage;

        runBtn.disabled = !state.activeModuleId || !imageReady;
        runBtn.textContent = 'Run Inference';

        if (inputControls) {
            if (imageReady) inputControls.classList.remove('hidden');
            else inputControls.classList.add('hidden');
        }
        if (outputControls) {
            if (outputReady) outputControls.classList.remove('hidden');
            else outputControls.classList.add('hidden');
        }

        if (copyBtn) copyBtn.disabled = !outputReady;
        if (saveBtn) saveBtn.disabled = !outputReady;
        if (viewInputBtn) viewInputBtn.disabled = !imageReady;
        if (viewOutputBtn) viewOutputBtn.disabled = !outputReady;

        const canCompare = imageReady && outputReady;
        if (compareSlideBtn) compareSlideBtn.disabled = !canCompare;
        if (compareHoldBtn) compareHoldBtn.disabled = !canCompare;

        renderComparisonView();
    }
}

export function renderOutputImage() {
    if (!state.outputData) return;
    const canvas = dom.getOutputCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = state.outputData.width;
    canvas.height = state.outputData.height;
    ctx.putImageData(state.outputData, 0, 0);

    // After rendering a new image, re-evaluate the comparison view
    renderComparisonView();
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

export function openImageModal(type) {
    const modal = dom.imageModal();
    const modalBody = dom.modalBody();
    if (!modal || !modalBody) return;

    modalBody.innerHTML = '';

    let contentElement;
    if (type === 'input') {
        const imgPreview = dom.getImagePreview();
        if (!imgPreview || imgPreview.classList.contains('hidden')) return;

        contentElement = document.createElement('img');
        contentElement.src = imgPreview.src;
        contentElement.alt = 'Input Image';
        contentElement.classList.add('modal-image');
    } else if (type === 'output') {
        const outputCanvas = dom.getOutputCanvas();
        if (!outputCanvas || outputCanvas.width === 0) return;

        const clonedCanvas = outputCanvas.cloneNode(true);
        const ctx = clonedCanvas.getContext('2d');
        ctx.drawImage(outputCanvas, 0, 0);

        contentElement = clonedCanvas;
        contentElement.classList.add('modal-image');
    } else {
        return;
    }

    modalBody.appendChild(contentElement);
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

export function closeImageModal() {
    const modal = dom.imageModal();
    const modalBody = dom.modalBody();
    if (modal) modal.classList.add('hidden');
    if (modalBody) modalBody.innerHTML = '';
    document.body.style.overflow = '';
}

// --- REFINED & CENTRALIZED: Comparison View Logic ---

/**
 * Draws the plain output data to the canvas. Internal use only.
 */
function _drawPlainOutputToCanvas() {
    if (!state.outputData) return;
    const canvas = dom.getOutputCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = state.outputData.width;
    canvas.height = state.outputData.height;
    ctx.putImageData(state.outputData, 0, 0);
}

/**
 * Loads the input image into an Image object for drawing. Caches the result.
 * This is a private helper for the UI functions below.
 * @returns {Promise<HTMLImageElement|null>}
 */
async function _getLoadedInputImage() {
    const inputPreview = dom.getImagePreview();
    if (!inputPreview || inputPreview.classList.contains('hidden')) return null;

    if (
        !inputImageForCompare ||
        inputImageForCompare.src !== inputPreview.src
    ) {
        inputImageForCompare = new Image();
        inputImageForCompare.src = inputPreview.src;
        await new Promise((resolve, reject) => {
            inputImageForCompare.onload = resolve;
            inputImageForCompare.onerror = reject;
        });
    }
    return inputImageForCompare;
}

/**
 * Updates the entire comparison UI, including slider position and canvas content.
 */
export async function renderComparisonView() {
    const outputArea = dom.outputArea();
    const slider = dom.imageCompareSlider();
    const slideBtn = dom.compareSlideBtn();
    const holdBtn = dom.compareHoldBtn();
    if (!outputArea || !slider || !slideBtn || !holdBtn) return;

    outputArea.dataset.compareMode = state.comparisonMode;
    slideBtn.classList.toggle('active', state.comparisonMode === 'slide');
    holdBtn.classList.toggle('active', state.comparisonMode === 'hold');

    const canvas = dom.getOutputCanvas();
    const inputImage = await _getLoadedInputImage();
    const canCompare =
        canvas && canvas.width > 0 && inputImage && state.outputData;

    if (state.comparisonMode === 'slide' && canCompare) {
        const canvasRect = canvas.getBoundingClientRect();
        const outputAreaRect = outputArea.getBoundingClientRect();
        const outputDest = getContainSize(
            canvas.width,
            canvas.height,
            state.outputData.width,
            state.outputData.height
        );
        const scale = canvasRect.width / canvas.width;

        imageBounds = {
            x: canvasRect.left - outputAreaRect.left + outputDest.x * scale,
            y: canvasRect.top - outputAreaRect.top + outputDest.y * scale,
            width: outputDest.width * scale,
            height: outputDest.height * scale,
        };

        slider.style.top = `${imageBounds.y}px`;
        slider.style.height = `${imageBounds.height}px`;
        slider.style.left = `${imageBounds.x + imageBounds.width / 2}px`;
        slider.classList.remove('hidden');

        redrawCompareCanvas(imageBounds.x + imageBounds.width / 2);
    } else {
        slider.classList.add('hidden');
        if (canCompare) {
            _drawPlainOutputToCanvas();
        }
    }
}

/**
 * Draws the full input image onto the main canvas for hold-to-compare.
 */
export async function showInputOnCanvas() {
    const canvas = dom.getOutputCanvas();
    const ctx = canvas.getContext('2d');
    const inputImage = await _getLoadedInputImage();
    if (!canvas || !inputImage) return;

    const dest = getContainSize(
        canvas.width,
        canvas.height,
        inputImage.width,
        inputImage.height
    );
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(inputImage, dest.x, dest.y, dest.width, dest.height);
}

/**
 * Redraws the comparison view on the canvas with a split at a given X-coordinate.
 * @param {number} splitX_visual - The X-coordinate in the VISUAL (pixel) space.
 */
export async function redrawCompareCanvas(splitX_visual) {
    const canvas = dom.getOutputCanvas();
    const ctx = canvas.getContext('2d');
    const inputImage = await _getLoadedInputImage();
    if (!canvas || !inputImage || !state.outputData) return;

    // This logic correctly maps the visual split position to the canvas coordinate system.
    const canvasRect = canvas.getBoundingClientRect();
    const outputAreaRect = dom.outputArea().getBoundingClientRect();
    const scale = canvas.width / canvasRect.width;
    const visualImageOffsetX = canvasRect.left - outputAreaRect.left;
    const splitX_canvas = (splitX_visual - visualImageOffsetX) * scale;

    const inputDest = getContainSize(
        canvas.width,
        canvas.height,
        inputImage.width,
        inputImage.height
    );
    const outputDest = getContainSize(
        canvas.width,
        canvas.height,
        state.outputData.width,
        state.outputData.height
    );

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = state.outputData.width;
    tempCanvas.height = state.outputData.height;
    tempCanvas.getContext('2d').putImageData(state.outputData, 0, 0);
    ctx.drawImage(
        tempCanvas,
        outputDest.x,
        outputDest.y,
        outputDest.width,
        outputDest.height
    );

    const inputClipX = splitX_canvas - inputDest.x;
    if (inputClipX <= 0) return;

    const sourceClipWidth = (inputClipX / inputDest.width) * inputImage.width;
    ctx.drawImage(
        inputImage,
        0,
        0,
        sourceClipWidth,
        inputImage.height,
        inputDest.x,
        inputDest.y,
        inputClipX,
        inputDest.height
    );
}
