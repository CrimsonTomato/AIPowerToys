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
} from '../state.js';
import { runInference } from '../_controllers/modelController.js';
import { downloadModel } from '../_controllers/modelDownloader.js';
import {
    copyOutputToClipboard,
    saveOutputToFile,
} from '../_controllers/outputController.js';
import {
    connectToDirectory,
    saveAppState,
} from '../_controllers/fileSystemController.js';
import { openImageModal, closeImageModal } from '../ui/components/modal.js';
import { clearInputs } from './inputHandlers.js';

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
    if (!moduleId || state.activeModuleId === moduleId) {
        return;
    }

    const module = state.modules.find(m => m.id === moduleId);
    if (module && module.configurable_params) {
        for (const param of module.configurable_params) {
            if (state.runtimeConfigs[moduleId]?.[param.id] === undefined) {
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
    if (state.inputDataURLs.length > 0) {
        openImageModal('data-url', state.inputDataURLs[0]);
    }
}

function handleCopyOutput() {
    copyOutputToClipboard();
}

function handleSaveOutput() {
    saveOutputToFile();
}

function handleViewOutput() {
    if (!state.outputData) return;
    const imageData = Array.isArray(state.outputData)
        ? state.outputData[0]
        : state.outputData;
    if (imageData && typeof imageData !== 'string') {
        openImageModal('image-data', imageData);
    }
}

function handleToggleSlideCompare() {
    const newMode = state.comparisonMode === 'slide' ? 'none' : 'slide';
    setComparisonMode(newMode);
}

function handleToggleHoldCompare() {
    const newMode = state.comparisonMode === 'hold' ? 'none' : 'hold';
    setComparisonMode(newMode);
}

function handleToggleTheme() {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    saveAppState();
}

function handleToggleGpu() {
    if (!state.gpuSupported) return;
    setUseGpu(!state.useGpu);
    saveAppState();
}

function handleResetSidebar() {
    setSidebarWidth(500);
    saveAppState();
}

const clickHandlers = {
    '#connect-folder-btn': handleConnectFolder,
    '#run-inference-btn': handleRunInference,
    '#clear-input-btn': clearInputs,
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
    document.body.addEventListener('click', e => {
        // Modal-specific close conditions
        const modal = e.target.closest('#image-modal');
        if (modal && e.target === modal) {
            closeImageModal();
            return;
        }

        // Grid item clicks for modal zoom
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

        // Delegated clicks
        for (const [selector, handler] of Object.entries(clickHandlers)) {
            if (e.target.closest(selector)) {
                handler(e); // Note: Removed await as handlers are sync now
                return;
            }
        }
    });
}
