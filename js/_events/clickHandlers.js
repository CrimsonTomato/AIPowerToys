import {
    state,
    setActiveModuleId,
    setComparisonMode,
    toggleModelCollapsed,
    toggleModelStarred,
    setTheme,
    setUseGpu,
    setSidebarWidth,
    setRuntimeConfig
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
import { renderStatus, applyTheme } from '../ui/main_component.js';
import { openImageModal, closeImageModal } from '../ui/components/modal.js';
import { renderGpuStatus } from '../ui/components/gpuStatus.js';
import { applySidebarWidth } from '../ui/sidebar.js';
import { renderModelsList } from '../ui/models.js';
import { renderWorkbench, renderComparisonView } from '../ui/workbench.js';
import { clearInputs } from './inputHandlers.js';

// --- Individual Click Handler Functions ---

async function handleConnectFolder() {
    connectToDirectory();
}

async function handleToggleModelCollapse(e) {
    e.stopPropagation();
    const moduleId = e.target.closest('.model-card-toggle-btn').dataset
        .moduleId;
    if (!moduleId) return;
    toggleModelCollapsed(moduleId);
    renderModelsList();
    saveAppState();
}

async function handleStarClick(e) {
    e.stopPropagation();
    const moduleId = e.target.closest('.star-btn').dataset.moduleId;
    if (!moduleId) return;
    toggleModelStarred(moduleId);
    renderModelsList();
    saveAppState();
}

async function activateModule(moduleId) {
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
    renderModelsList();
    await renderWorkbench();
    renderStatus();
    saveAppState();
}

async function handleUseModel(e) {
    e.stopPropagation();
    const moduleId = e.target.closest('.select-model-btn').dataset.moduleId;
    await activateModule(moduleId);
}

async function handleDownloadModel(e) {
    e.stopPropagation();
    const moduleId = e.target.closest('.download-btn').dataset.moduleId;
    if (!moduleId) return;
    downloadModel(moduleId);
}

async function handleSelectCard(e) {
    const card = e.target.closest('.model-card');
    if (!card) return;

    // Prevent activating if a button within the card was clicked
    if (e.target.closest('button, .star-btn')) {
        return;
    }
    await activateModule(card.dataset.moduleId);
}

async function handleRunInference() {
    runInference();
}

async function handleViewInput() {
    if (state.inputDataURLs.length > 0) {
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
    document.body.addEventListener('click', async e => {
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
                await handler(e);
                return;
            }
        }
    });
}
