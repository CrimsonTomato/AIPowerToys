import {
    state,
    setActiveModuleId,
    setComparisonMode,
    toggleModelCollapsed,
    toggleModelStarred,
    setTheme,
    setUseGpu,
    setSidebarWidth,
    setRuntimeConfig,
    addInputPoint,
    clearInputPoints,
} from '../state.js';
import { runInference } from '../_controllers/modelController.js';
import { downloadModel } from '../_controllers/modelDownloader.js';
import {
    copyOutputToClipboard,
    saveOutputToFile,
} from '../_controllers/outputController.js';
import { connectToDirectory } from '../_controllers/fileSystemController.js';
import { saveAppState } from '../services/persistenceService.js';
import { openImageModal, closeImageModal } from '../ui/components/modal.js';
import { clearInputs } from './inputHandlers.js';
import { dom } from '../dom.js';

// --- Individual Click Handler Functions (Now free of direct UI calls) ---

function handleConnectFolder() {
    connectToDirectory();
}

function handleToggleModelCollapse(e) {
    e.stopPropagation();
    const moduleId = e.target.closest('.model-card-toggle-btn').dataset
        .moduleId;
    if (!moduleId) return;
    toggleModelCollapsed(moduleId);
    saveAppState();
}

function handleStarClick(e) {
    e.stopPropagation();
    const moduleId = e.target.closest('.star-btn').dataset.moduleId;
    if (!moduleId) return;
    toggleModelStarred(moduleId);
    saveAppState();
}

function activateModule(moduleId) {
    if (!moduleId || state.models.activeModuleId === moduleId) {
        return;
    }

    const module = state.models.modules.find(m => m.id === moduleId);
    if (module && module.configurable_params) {
        for (const param of module.configurable_params) {
            // Only set default if param doesn't exist for this module
            if (
                state.workbench.runtimeConfigs[moduleId]?.[param.id] ===
                undefined
            ) {
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

    clearInputs();
    setActiveModuleId(moduleId);
    saveAppState();
}

function handleUseModel(e) {
    e.stopPropagation();
    const moduleId = e.target.closest('.select-model-btn').dataset.moduleId;
    activateModule(moduleId);
}

function handleDownloadModel(e) {
    e.stopPropagation();
    const moduleId = e.target.closest('.download-btn').dataset.moduleId;
    if (!moduleId) return;
    downloadModel(moduleId);
}

function handleSelectCard(e) {
    const card = e.target.closest('.model-card');
    if (!card) return;

    // Prevent activating if a button within the card was clicked
    if (e.target.closest('button, .star-btn')) {
        return;
    }
    activateModule(card.dataset.moduleId);
}

function handleRunInference() {
    runInference();
}

function handleViewInput() {
    if (state.workbench.input.imageURLs.length > 0) {
        openImageModal('data-url', state.workbench.input.imageURLs[0]);
    }
}

function handleCopyOutput() {
    copyOutputToClipboard();
}

function handleSaveOutput() {
    saveOutputToFile();
}

function handleViewOutput() {
    if (!state.workbench.output.data) return;
    const imageData = Array.isArray(state.workbench.output.data)
        ? state.workbench.output.data[0]
        : state.workbench.output.data;
    if (imageData && typeof imageData !== 'string') {
        openImageModal('image-data', imageData);
    }
}

function handleToggleSlideCompare() {
    const newMode =
        state.workbench.output.comparisonMode === 'slide' ? 'none' : 'slide';
    setComparisonMode(newMode);
}

function handleToggleHoldCompare() {
    const newMode =
        state.workbench.output.comparisonMode === 'hold' ? 'none' : 'hold';
    setComparisonMode(newMode);
}

function handleToggleTheme() {
    const newTheme = state.system.theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    saveAppState();
}

function handleToggleGpu() {
    if (!state.system.gpuSupported) return;
    setUseGpu(!state.system.useGpu);
    saveAppState();
}

function handleResetSidebar() {
    setSidebarWidth(500);
    saveAppState();
}

function handleClearPoints() {
    clearInputPoints();
}

function handleUploadImage() {
    dom.getImagePicker()?.click();
}

function handlePointAndClick(e) {
    const area = e.target.closest('.point-and-click-area');
    // Add guards to prevent action when not ready or already processing
    if (
        !area ||
        state.workbench.input.imageURLs.length === 0 ||
        state.workbench.isProcessing
    )
        return;

    // Prevent context menu on right click
    e.preventDefault();

    const bb = area.getBoundingClientRect();
    const x = (e.clientX - bb.left) / bb.width;
    const y = (e.clientY - bb.top) / bb.height;

    // Clamp values between 0 and 1
    const point = [Math.max(0, Math.min(x, 1)), Math.max(0, Math.min(y, 1))];

    // Left-click is 1 (positive), Right-click is 0 (negative)
    const label = e.button === 0 ? 1 : 0;

    addInputPoint({ point, label });
    // Automatically trigger inference after adding a point
    setTimeout(runInference, 50);
}

const clickHandlers = {
    '#connect-folder-btn': handleConnectFolder,
    '#run-inference-btn': handleRunInference,
    '#upload-image-btn': handleUploadImage,
    '#clear-input-btn': clearInputs,
    '#clear-points-btn': handleClearPoints,
    '#copy-btn': handleCopyOutput,
    '#save-btn': handleSaveOutput,
    '#view-input-btn': handleViewInput,
    '#view-output-btn': handleViewOutput,
    '#compare-slide-btn': handleToggleSlideCompare,
    '#compare-hold-btn': handleToggleHoldCompare,
    '#theme-toggle-btn': handleToggleTheme,
    '#gpu-toggle-btn': handleToggleGpu,
    '#reset-sidebar-btn': handleResetSidebar,
    '#modal-close-btn': closeImageModal,
    '.model-card-toggle-btn': handleToggleModelCollapse,
    '.star-btn': handleStarClick,
    '.select-model-btn': handleUseModel,
    '.download-btn': handleDownloadModel,
    '.model-card': handleSelectCard,
};

export function initClickListeners() {
    // This listener prevents the right-click menu from showing up on the image.
    document.body.addEventListener('contextmenu', e => {
        if (e.target.closest('.point-and-click-area')) {
            e.preventDefault();
        }
    });

    // This listener handles adding points (both left and right clicks).
    document.body.addEventListener('mousedown', e => {
        const pointArea = e.target.closest('.point-and-click-area');
        if (pointArea) {
            // Do not register a point if a button or an existing point inside the area was clicked.
            if (e.target.closest('button, .prompt-point')) return;
            handlePointAndClick(e);
        }
    });

    // This listener handles all normal button clicks.
    document.body.addEventListener('click', e => {
        // We check for the closest matching selector for delegation.
        const matchingSelector = Object.keys(clickHandlers).find(selector =>
            e.target.closest(selector)
        );

        if (matchingSelector) {
            clickHandlers[matchingSelector](e);
            return;
        }

        // Modal-specific close condition (clicking overlay).
        const modal = e.target.closest('#image-modal');
        if (modal && e.target === modal) {
            closeImageModal();
            return;
        }

        // Grid item clicks for modal zoom.
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
        }
    });
}
