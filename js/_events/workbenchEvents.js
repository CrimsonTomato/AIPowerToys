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
} from '../state.js';
let isDraggingSlider = false;
let isResizingSidebar = false;

// --- REFACTOR: Central function to activate a module ---
async function activateModule(moduleId) {
    if (!moduleId || state.activeModuleId === moduleId) {
        return; // Do nothing if no ID or already active
    }
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

// --- REFACTOR: Use the shared activateModule function ---
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

    // A click on the card body now always activates the module.
    await activateModule(moduleId);
}

// --- PERFORMANCE: Pass raw ImageData to runInference ---
async function handleRunInference() {
    const preview = dom.getImagePreview();
    if (!preview || !preview.src || preview.naturalWidth === 0) {
        // No image loaded or image not yet rendered
        dom.statusText().textContent = 'Status: Please load an image first.';
        return;
    }

    // Get the raw pixel data from the preview image to avoid re-decoding in the worker.
    // This is especially useful for image-segmentation's post-processing.
    const canvas = new OffscreenCanvas(
        preview.naturalWidth,
        preview.naturalHeight
    );
    const ctx = canvas.getContext('2d');
    ctx.drawImage(preview, 0, 0);
    const originalImageData = ctx.getImageData(
        0,
        0,
        preview.naturalWidth,
        preview.naturalHeight
    );

    // Pass both the data URL (for the pipeline) and the raw ImageData (for post-processing).
    runInference(preview.src, originalImageData);
}

async function handleCopyOutput() {
    copyOutputToClipboard();
}

async function handleSaveOutput() {
    saveOutputToFile();
}

async function handleViewInput() {
    openImageModal('input');
}

async function handleViewOutput() {
    openImageModal('output');
}

async function handleCloseModal(e) {
    closeImageModal();
}

async function handleToggleSlideCompare() {
    const newMode = state.comparisonMode === 'slide' ? 'none' : 'slide';
    setComparisonMode(newMode);
    await renderComparisonView();
}

async function handleToggleHoldCompare() {
    const newMode = state.comparisonMode === 'hold' ? 'none' : 'hold';
    setComparisonMode(newMode);
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

// Maps CSS selectors to their corresponding event handler functions.
const clickHandlers = {
    '.star-btn': handleStarClick,
    '.model-card-toggle-btn': handleToggleModelCollapse,
    '.select-model-btn': handleUseModel,
    '.download-btn': handleDownloadModel,
    '.model-card': handleSelectCard,

    '#connect-folder-btn': handleConnectFolder,
    '#run-inference-btn': handleRunInference,
    '#copy-btn': handleCopyOutput,
    '#save-btn': handleSaveOutput,
    '#view-input-btn': handleViewInput,
    '#view-output-btn': handleViewOutput,
    '#modal-close-btn': handleCloseModal,
    '#image-modal': handleCloseModal,
    '#compare-slide-btn': handleToggleSlideCompare,
    '#compare-hold-btn': handleToggleHoldCompare,
    '#theme-toggle-btn': handleToggleTheme,
    '#gpu-toggle-btn': handleToggleGpu,
    '#reset-sidebar-btn': handleResetSidebar,
};

export function initWorkbenchEvents() {
    // --- Main Click Event Dispatcher ---
    document.body.addEventListener('click', async e => {
        for (const [selector, handler] of Object.entries(clickHandlers)) {
            const element = e.target.closest(selector);
            if (
                element &&
                (selector !== '#image-modal' || e.target.id === 'image-modal')
            ) {
                await handler(e, element);
                return;
            }
        }
    });

    // --- Other Event Listeners ---
    document.body.addEventListener('change', e => {
        const target = e.target;
        if (target.id === 'image-picker') {
            const file = target.files[0];
            if (file) loadImageFile(file);
        } else if (target.matches('.variant-selector')) {
            const moduleId = target.dataset.moduleId;
            const variantName = target.value;
            setSelectedVariant(moduleId, variantName);
            renderStatus();
            saveAppState();
        } else if (target.matches('.runtime-control input[type="checkbox"]')) {
            const moduleId = target.dataset.moduleId;
            const paramId = target.dataset.paramId;
            const value = target.checked;
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

    handleImageDropAreaEvents();
}

export function initGlobalEvents() {
    applyTheme();
    applySidebarWidth();
}

function loadImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        console.warn('Selected file is not an image.');
        return;
    }
    const reader = new FileReader();
    reader.onload = e => {
        const preview = dom.getImagePreview();
        const placeholder = dom.getImageInputPlaceholder();
        if (preview) {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            if (placeholder) placeholder.classList.add('hidden');
            renderStatus();
        }
    };
    reader.readAsDataURL(file);
}

function handleImageDropAreaEvents() {
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
            const files = dt.files;
            if (files.length > 0) loadImageFile(files[0]);
        },
        false
    );
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
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
        // Do not save on every mouse move event for performance.
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
