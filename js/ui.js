import { dom } from './dom.js';
import { state } from './state.js';

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
 * @param {object} statusInfo - The status object for the model from the state.
 * @param {object|null} downloadProgressInfo - The download progress for this module, if applicable.
 * @returns {string} The HTML string for the status.
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
 * Renders the HTML for the interactive controls of a model card (buttons, select).
 * @private
 * @param {object} module - The module manifest object.
 * @param {object} statusInfo - The status object for the model from the state.
 * @returns {string} The HTML string for the controls.
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

export function renderWorkbench() {
    const workbenchContent = dom.workbenchContent();
    if (!workbenchContent) return;

    const workbenchArea = dom.workbenchArea();
    if (!workbenchArea) return;

    if (state.activeModuleId) {
        workbenchArea.classList.remove('hidden');
        renderRuntimeControls();
    } else {
        workbenchArea.classList.add('hidden');
    }
    renderStatus();
}

export function renderStatus() {
    const statusEl = dom.statusText();
    const runBtn = dom.runInferenceBtn();
    if (!statusEl || !runBtn) return;

    // Get control groups
    const inputControls = dom.inputControls();
    const outputControls = dom.outputControls();

    const copyBtn = dom.copyBtn();
    const saveBtn = dom.saveBtn();
    const viewInputBtn = dom.viewInputBtn();
    const viewOutputBtn = dom.viewOutputBtn();

    if (state.isProcessing) {
        statusEl.textContent = 'Status: Processing... Please wait.';
        runBtn.disabled = true;
        runBtn.textContent = 'Processing...';

        // Disable and hide control groups while processing
        if (inputControls) inputControls.classList.add('hidden');
        if (outputControls) outputControls.classList.add('hidden');
        if (copyBtn) copyBtn.disabled = true;
        if (saveBtn) saveBtn.disabled = true;
        if (viewInputBtn) viewInputBtn.disabled = true;
        if (viewOutputBtn) viewOutputBtn.disabled = true;
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

        // Manage visibility and disabled state of control groups and buttons
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
}

/**
 * Renders the folder connection status and path.
 */
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

// Modal functions
export function openImageModal(type) {
    const modal = dom.imageModal();
    const modalBody = dom.modalBody();
    if (!modal || !modalBody) return;

    modalBody.innerHTML = ''; // Clear previous content

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
    document.body.style.overflow = 'hidden'; // Prevent body scroll when modal is open
}

export function closeImageModal() {
    const modal = dom.imageModal();
    const modalBody = dom.modalBody();
    if (modal) modal.classList.add('hidden');
    if (modalBody) modalBody.innerHTML = '';
    document.body.style.overflow = ''; // Restore body scroll
}
