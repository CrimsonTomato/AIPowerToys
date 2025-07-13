import { dom } from './dom.js';
import { state } from './state.js';

export async function renderApp() {
    const appContainer = dom.app();
    if (!appContainer) return;

    const response = await fetch('/components/views/view_workbench.html');
    const html = await response.text();
    appContainer.innerHTML = html;

    renderModelsList();
}

/**
 * Renders the entire list of model cards into the DOM.
 */
export function renderModelsList() {
    const container = dom.modelsList();
    if (!container) return;

    container.innerHTML = state.modules
        .map(module => {
            const statusInfo = state.modelStatuses[module.id] || {
                status: 'checking',
            };
            return `
            <div class="model-card" data-active="${
                state.activeModuleId === module.id
            }">
                <h3>${module.name}</h3>
                <p>${module.description}</p>
                ${_renderModelStatus(statusInfo)}
                <div class="model-controls">${_renderModelControls(
                    module,
                    statusInfo
                )}</div>
            </div>
        `;
        })
        .join('');
}

/**
 * Renders the HTML for the status paragraph of a model card.
 * @private
 * @param {object} statusInfo - The status object for the model from the state.
 * @returns {string} The HTML string for the status.
 */
function _renderModelStatus(statusInfo) {
    switch (statusInfo.status) {
        case 'checking':
            return '<p>Status: Checking...</p>';
        case 'missing':
            return '<p class="status-missing">Status: Repository not found</p>';
        case 'found':
            return '<p class="status-found">Status: Found</p>';
        case 'downloading':
            return `<p>Status: Downloading...</p>`; // Can be enhanced with progress
        default:
            return '';
    }
}

/**
 * Renders the HTML for the interactive controls of a model card (buttons, select).
 * @private
 * @param {object} module - The module manifest object.
 * @param {object} statusInfo - The status object for the model from the state.
 * @returns {string} The HTML string for the controls.
 */
function _renderModelControls(module, statusInfo) {
    switch (statusInfo.status) {
        case 'found':
            return `
                <select class="variant-selector" data-module-id="${module.id}">
                    ${statusInfo.discoveredVariants
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
                <button class="select-model-btn" data-module-id="${
                    module.id
                }">Use this Model</button>
            `;
        case 'missing':
            return `<button class="download-btn" data-module-id="${module.id}">Download</button>`;
        default:
            // No controls for 'checking' or 'downloading' states
            return '';
    }
}

export function renderWorkbench() {
    const workbench = dom.workbenchArea();
    if (!workbench) return; // Added null check for robustness
    if (state.activeModuleId) {
        workbench.classList.remove('hidden');
    } else {
        workbench.classList.add('hidden');
    }
    renderStatus();
}

export function renderStatus() {
    const statusEl = dom.statusText();
    const runBtn = dom.runInferenceBtn();
    if (!statusEl || !runBtn) return;

    if (state.isProcessing) {
        statusEl.textContent = 'Status: Processing... Please wait.';
        runBtn.disabled = true;
        runBtn.textContent = 'Processing...';
    } else {
        statusEl.textContent = 'Status: Idle';
        const imagePreview = dom.getImagePreview();
        const imageReady =
            imagePreview?.src && !imagePreview.classList.contains('hidden');
        runBtn.disabled = !state.activeModuleId || !imageReady;
        runBtn.textContent = 'Run Inference';
    }

    const copyBtn = dom.copyBtn();
    const saveBtn = dom.saveBtn();
    if (copyBtn) copyBtn.disabled = !state.outputData;
    if (saveBtn) saveBtn.disabled = !state.outputData;
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
