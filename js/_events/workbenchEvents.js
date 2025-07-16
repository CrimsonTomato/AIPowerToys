import { dom } from '../dom.js';
import {
    runInference,
    copyOutputToClipboard,
    saveOutputToFile,
    downloadModel,
} from '../_controllers/modelController.js';
import {
    connectToDirectory,
    saveAppState,
} from '../_controllers/fileSystemController.js';
import {
    renderStatus,
    openImageModal,
    closeImageModal,
    applySidebarWidth,
    applyTheme,
    renderGpuStatus,
} from '../ui/main.js';
import { renderModelsList, handleSearch } from '../ui/models.js';
import {
    renderWorkbench,
    renderComparisonView,
    redrawCompareCanvas,
    showInputOnCanvas,
    getImageBounds,
} from '../ui/workbench.js';
import {
    state,
    setActiveModuleId,
    setSelectedVariant,
    setRuntimeConfig,
    toggleModelCollapsed,
    setComparisonMode,
    toggleModelStarred,
    setSidebarWidth,
    setTheme,
    setUseGpu,
    setInputDataURLs,
    clearInputDataURLs,
    setInputAudioURL,
    clearInputAudioURL,
    setProcessingMode,
} from '../state.js';
let isDraggingSlider = false;
let isResizingSidebar = false;

// --- REFACTOR: Central function to activate a module ---
async function activateModule(moduleId) {
    if (!moduleId || state.activeModuleId === moduleId) {
        return; // Do nothing if no ID or already active
    }

    // --- FIX: Pre-populate runtime configs with defaults when activating a module ---
    const module = state.modules.find(m => m.id === moduleId);
    if (module && module.configurable_params) {
        for (const param of module.configurable_params) {
            // Only set the default if a value for this param isn't already in the state.
            // This preserves user choices if they switch away and back to a model.
            if (state.runtimeConfigs[moduleId]?.[param.id] === undefined) {
                // Special handling for boolean string from select
                const defaultValue =
                    param.default === 'true'
                        ? true
                        : param.default === 'false'
                        ? false
                        : param.default;
                setRuntimeConfig(moduleId, param.id, defaultValue);
            }
        }
    }
    // --- END FIX ---

    // When switching modules, clear the workbench inputs and outputs
    clearInputs();
    setActiveModuleId(moduleId);
    renderModelsList();
    await renderWorkbench();
    renderStatus();
    saveAppState(); // Persist the active module change
}

// --- Click Event Handlers ---

async function handleConnectFolder() {
    connectToDirectory();
}

async function handleToggleModelCollapse(e, element) {
    e.stopPropagation();
    const moduleId = element.dataset.moduleId;
    if (!moduleId) return;
    toggleModelCollapsed(moduleId);
    renderModelsList();
    saveAppState(); // CONSISTENCY: Persist collapsed state
}

async function handleStarClick(e, element) {
    e.stopPropagation();
    const moduleId = element.dataset.moduleId;
    if (!moduleId) return;
    toggleModelStarred(moduleId);
    renderModelsList();
    saveAppState();
}

async function handleUseModel(e, element) {
    e.stopPropagation();
    const moduleId = element.dataset.moduleId;
    await activateModule(moduleId);
}

async function handleDownloadModel(e, element) {
    e.stopPropagation();
    const moduleId = element.dataset.moduleId;
    if (!moduleId) return;
    downloadModel(moduleId);
}

async function handleSelectCard(e, element) {
    const clickedElement = e.target;
    const moduleId = element.dataset.moduleId;

    if (
        clickedElement.closest('.star-btn') ||
        clickedElement.closest('.model-card-toggle-btn') ||
        clickedElement.closest('.select-model-btn') ||
        clickedElement.closest('.download-btn')
    ) {
        return; // Let specific handlers take over
    }
    await activateModule(moduleId);
}

async function handleRunInference() {
    runInference();
}

function handleClearInput() {
    clearInputs();
}

async function handleViewInput() {
    if (state.inputDataURLs.length > 0) {
        // This will open the first (and only, in single-image mode) image in the modal.
        openImageModal('data-url', state.inputDataURLs[0]);
    }
}

async function handleCopyOutput() {
    copyOutputToClipboard();
}

async function handleSaveOutput() {
    saveOutputToFile();
}

async function handleViewOutput() {
    if (!state.outputData) return;
    const imageData = Array.isArray(state.outputData)
        ? state.outputData[0]
        : state.outputData;
    if (imageData && typeof imageData !== 'string') {
        openImageModal('image-data', imageData);
    }
}

async function handleCloseModal(e) {
    closeImageModal();
}

async function handleToggleSlideCompare() {
    const newMode = state.comparisonMode === 'slide' ? 'none' : 'slide';
    setComparisonMode(newMode);
    // FIX: Only call renderComparisonView when user interacts with it
    await renderComparisonView();
}

async function handleToggleHoldCompare() {
    const newMode = state.comparisonMode === 'hold' ? 'none' : 'hold';
    setComparisonMode(newMode);
    // FIX: Only call renderComparisonView when user interacts with it
    await renderComparisonView();
}

async function handleToggleTheme() {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    applyTheme();
    saveAppState();
}

async function handleToggleGpu() {
    if (!state.gpuSupported) return;
    setUseGpu(!state.useGpu);
    renderGpuStatus();
    saveAppState();
}

async function handleResetSidebar() {
    setSidebarWidth(500);
    applySidebarWidth();
    saveAppState();
}

const clickHandlers = {
    '.star-btn': handleStarClick,
    '.model-card-toggle-btn': handleToggleModelCollapse,
    '.select-model-btn': handleUseModel,
    '.download-btn': handleDownloadModel,
    '.model-card': handleSelectCard,
    '#connect-folder-btn': handleConnectFolder,
    '#run-inference-btn': handleRunInference,
    '#copy-btn': handleCopyOutput,
    '#view-input-btn': handleViewInput,
    '#clear-input-btn': handleClearInput,
    '#save-btn': handleSaveOutput,
    '#view-output-btn': handleViewOutput,
    '#modal-close-btn': handleCloseModal,
    '#compare-slide-btn': handleToggleSlideCompare,
    '#compare-hold-btn': handleToggleHoldCompare,
    '#theme-toggle-btn': handleToggleTheme,
    '#gpu-toggle-btn': handleToggleGpu,
    '#reset-sidebar-btn': handleResetSidebar,
};

export function initWorkbenchEvents() {
    document.body.addEventListener('click', async e => {
        const modal = e.target.closest('#image-modal');
        if (modal && e.target === modal) {
            handleCloseModal();
            return;
        }

        const gridItem = e.target.closest('.grid-image-item');
        if (gridItem) {
            e.preventDefault();
            e.stopPropagation();
            if (gridItem.closest('#image-input-grid')) {
                const url = gridItem.dataset.imageDataUrl;
                if (url) openImageModal('data-url', url);
            } else if (gridItem.closest('#output-image-grid')) {
                const canvas = gridItem.querySelector('canvas');
                if (canvas) openImageModal('canvas', canvas);
            }
            return;
        }

        for (const [selector, handler] of Object.entries(clickHandlers)) {
            const element = e.target.closest(selector);
            if (element) {
                await handler(e, element);
                return;
            }
        }
    });

    document.body.addEventListener('change', e => {
        const target = e.target;
        if (target.id === 'image-picker') {
            const files = target.files;
            if (files.length > 0) loadImageFiles(files);
        } else if (target.id === 'audio-picker') {
            const files = target.files;
            if (files.length > 0) loadAudioFile(files[0]);
        } else if (target.matches('.variant-selector')) {
            const moduleId = target.dataset.moduleId;
            const variantName = target.value;
            setSelectedVariant(moduleId, variantName);
            renderStatus();
            saveAppState();
        } else if (target.matches('.runtime-control input[type="checkbox"]')) {
            if (target.dataset.paramId === 'processing-mode') {
                const mode = target.checked ? 'iterative' : 'batch';
                setProcessingMode(mode);
                saveAppState();
                return;
            }

            const moduleId = target.dataset.moduleId;
            const paramId = target.dataset.paramId;
            const value = target.checked;
            setRuntimeConfig(moduleId, paramId, value);
            saveAppState();
        } else if (target.matches('.runtime-control select')) {
            const moduleId = target.dataset.moduleId;
            const paramId = target.dataset.paramId;
            let value = target.value;
            // Convert boolean strings back to booleans
            if (value === 'true') value = true;
            if (value === 'false') value = false;

            setRuntimeConfig(moduleId, paramId, value);
            saveAppState();
        }
    });

    document.body.addEventListener('input', e => {
        const target = e.target;
        if (target.matches('.runtime-control input[type="range"]')) {
            const moduleId = target.dataset.moduleId;
            const paramId = target.dataset.paramId;
            const value = parseFloat(target.value);
            setRuntimeConfig(moduleId, paramId, value);
            const valueDisplay = document.getElementById(
                `param-val-${paramId}`
            );
            if (valueDisplay) valueDisplay.textContent = value;
        } else if (target.id === 'model-search-input') {
            handleSearch(e.target.value);
        }
    });

    document.body.addEventListener('change', e => {
        const target = e.target;
        if (target.matches('.runtime-control input[type="range"]')) {
            saveAppState();
        }
    });

    document.body.addEventListener('mousedown', handleMouseDown);
    document.body.addEventListener('mousemove', handleMouseMove);
    document.body.addEventListener('mouseup', handleMouseUp);
    document.body.addEventListener('mouseleave', handleMouseUp);
}

export function initGlobalEvents() {
    applyTheme();
    applySidebarWidth();
}

function clearInputs() {
    clearInputDataURLs();
    clearInputAudioURL();
    renderStatus(); // Will clear UI based on now-empty state
}

async function loadAudioFile(file) {
    if (!file || !file.type.startsWith('audio/')) return;
    clearInputs();
    const url = URL.createObjectURL(file);
    setInputAudioURL(url, file.name);
    renderStatus();
}

async function loadImageFiles(files) {
    if (!files || files.length === 0) return;
    clearInputs();
    let urls = [];
    const readPromises = Array.from(files).map(file => {
        if (!file.type.startsWith('image/')) return Promise.resolve(null);
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    });
    urls = (await Promise.all(readPromises)).filter(Boolean);
    setInputDataURLs(urls);
    renderStatus();
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

export function handleImageDropAreaEvents() {
    const dropArea = dom.getImageDropArea();
    if (!dropArea) return;
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(
            eventName,
            () => dropArea.classList.add('drag-over'),
            false
        );
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(
            eventName,
            () => dropArea.classList.remove('drag-over'),
            false
        );
    });
    dropArea.addEventListener(
        'drop',
        e => {
            const dt = e.dataTransfer;
            if (dt.files.length > 0) loadImageFiles(dt.files);
        },
        false
    );
}
export function handleAudioDropAreaEvents() {
    const dropArea = dom.getAudioDropArea();
    if (!dropArea) return;
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(
            eventName,
            () => dropArea.classList.add('drag-over'),
            false
        );
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(
            eventName,
            () => dropArea.classList.remove('drag-over'),
            false
        );
    });
    dropArea.addEventListener(
        'drop',
        e => {
            const dt = e.dataTransfer;
            if (dt.files.length > 0) loadAudioFile(dt.files[0]);
        },
        false
    );
}

function handleMouseDown(e) {
    if (e.target.matches('.sidebar-resizer')) {
        isResizingSidebar = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    } else if (e.target.closest('#image-compare-slider')) {
        isDraggingSlider = true;
        e.preventDefault();
    } else if (
        e.target.closest('.output-area') &&
        state.comparisonMode === 'hold'
    ) {
        showInputOnCanvas();
        e.preventDefault();
    }
}

function handleMouseMove(e) {
    if (isResizingSidebar) {
        const newWidth = Math.max(300, Math.min(e.clientX, 800));
        setSidebarWidth(newWidth);
        applySidebarWidth();
    } else if (isDraggingSlider) {
        const outputArea = dom.outputArea();
        if (!outputArea) return;
        const imageBounds = getImageBounds();
        const rect = outputArea.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const position = Math.max(
            imageBounds.x,
            Math.min(imageBounds.x + imageBounds.width, mouseX)
        );
        dom.imageCompareSlider().style.left = `${position}px`;
        redrawCompareCanvas(position);
    }
}

function handleMouseUp() {
    if (isResizingSidebar) {
        isResizingSidebar = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        saveAppState();
    }
    if (isDraggingSlider) {
        isDraggingSlider = false;
    } else if (state.comparisonMode === 'hold') {
        renderComparisonView();
    }
}
