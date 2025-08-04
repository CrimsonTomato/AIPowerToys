import { eventBus } from './_events/eventBus.js';

export let state = {
    // System-level state, doesn't change often
    system: {
        directoryHandle: null,
        gpuSupported: false,
        useGpu: false,
        theme: 'light', // 'light' or 'dark'
    },
    // State purely for UI layout and transient UI state
    ui: {
        sidebarWidth: 500, // Default width
        isRenderingWorkbench: false,
    },
    // State related to the model definitions and their status
    models: {
        modules: [],
        modelStatuses: {},
        activeModuleId: null,
        starredModels: new Set(),
        modelOrder: [],
        collapsedModels: new Set(),
        downloadProgress: {
            status: 'idle',
            moduleId: null,
            progress: 0,
            total: 0,
            filename: '',
        },
    },
    // State for the active workbench session
    workbench: {
        isProcessing: false,
        inferenceStartTime: null,
        inferenceDuration: null,
        runtimeConfigs: {},
        processingMode: 'batch', // 'batch' or 'iterative'
        input: {
            imageURLs: [], // Renamed from inputDataURLs
            audioURL: null,
            points: [], // Renamed from inputPoints: [{point: [x,y], label: 0|1}]
        },
        output: {
            data: null, // Holds ImageData, string, or array of ImageData
            comparisonMode: 'none',
        },
    },
};

// --- Mutation Functions (updated to use new sliced state) ---
export function setDirectoryHandle(handle) {
    state.system.directoryHandle = handle;
    eventBus.emit('directoryHandleChanged');
}
export function setModules(modules) {
    state.models.modules = modules;
    eventBus.emit('modulesChanged');
}
export function setSidebarWidth(width) {
    state.ui.sidebarWidth = width;
    eventBus.emit('sidebarWidthChanged', width);
}
export function setTheme(theme) {
    state.system.theme = theme;
    eventBus.emit('themeChanged', theme);
}
export function setGpuSupported(isSupported) {
    state.system.gpuSupported = isSupported;
    eventBus.emit('gpuSupportChanged');
}
export function setUseGpu(shouldUse) {
    if (state.system.useGpu === shouldUse) return;
    state.system.useGpu = shouldUse;
    eventBus.emit('useGpuChanged', shouldUse);
}
export function updateModelStatus(moduleId, statusObject) {
    state.models.modelStatuses[moduleId] = {
        ...state.models.modelStatuses[moduleId],
        ...statusObject,
    };
    eventBus.emit('modelStatusUpdated', { moduleId, statusObject });
}
export function setActiveModuleId(moduleId) {
    if (state.models.activeModuleId === moduleId) return;
    state.models.activeModuleId = moduleId;
    eventBus.emit('activeModuleChanged', moduleId);
}
export function setSelectedVariant(moduleId, variantName) {
    if (state.models.modelStatuses[moduleId]) {
        state.models.modelStatuses[moduleId].selectedVariant = variantName;
        eventBus.emit('selectedVariantChanged', { moduleId, variantName });
    }
}
export function setProcessing(isProcessing) {
    state.workbench.isProcessing = isProcessing;
    eventBus.emit('processingStateChanged', isProcessing);
}
export function setOutputData(data) {
    // If data is an array but empty, treat it as null for consistency
    if (Array.isArray(data) && data.length === 0) {
        state.workbench.output.data = null;
    } else {
        state.workbench.output.data = data;
    }
    eventBus.emit('outputDataChanged');
}
export function setInferenceStartTime(time) {
    state.workbench.inferenceStartTime = time;
    eventBus.emit('inferenceStateChanged');
}
export function setInferenceDuration(duration) {
    state.workbench.inferenceDuration = duration;
    eventBus.emit('inferenceStateChanged');
}
export function setDownloadProgress(progress) {
    state.models.downloadProgress = {
        ...state.models.downloadProgress,
        ...progress,
    };
    eventBus.emit('downloadProgressChanged', progress);
}
export function setRuntimeConfig(moduleId, paramId, value) {
    if (!state.workbench.runtimeConfigs[moduleId]) {
        state.workbench.runtimeConfigs[moduleId] = {};
    }
    state.workbench.runtimeConfigs[moduleId][paramId] = value;
    eventBus.emit('runtimeConfigChanged', { moduleId, paramId, value });
}
export function toggleModelCollapsed(moduleId) {
    if (state.models.collapsedModels.has(moduleId)) {
        state.models.collapsedModels.delete(moduleId);
    } else {
        state.models.collapsedModels.add(moduleId);
    }
    eventBus.emit('modelCollapsedToggled', moduleId);
}
export function toggleModelStarred(moduleId) {
    if (state.models.starredModels.has(moduleId)) {
        state.models.starredModels.delete(moduleId);
    } else {
        state.models.starredModels.add(moduleId);
    }
    eventBus.emit('modelStarredToggled', moduleId);
}
export function setModelOrder(order) {
    state.models.modelOrder = order;
    eventBus.emit('modelOrderChanged', order);
}
export function setComparisonMode(mode) {
    state.workbench.output.comparisonMode = mode;
    eventBus.emit('comparisonModeChanged', mode);
}
export function setStarredModels(models) {
    state.models.starredModels = models;
}
export function setCollapsedModels(modelsSet) {
    state.models.collapsedModels = modelsSet;
}
export function setInputImageURLs(urls) {
    const activeModule = state.models.modules.find(
        m => m.id === state.models.activeModuleId
    );
    const isSamTask = activeModule?.task === 'image-segmentation-with-prompt';
    if (isSamTask && urls.length > 1) {
        alert('Only a single image can be processed for this task.');
        return; // Prevent setting multiple URLs
    }
    state.workbench.input.imageURLs = urls;
    eventBus.emit('inputDataChanged');
}
export function clearInputImageURLs() {
    state.workbench.input.imageURLs = [];
    eventBus.emit('inputDataChanged');
}
export function setInputAudioURL(url, filename) {
    state.workbench.input.audioURL = url ? { url, filename } : null;
    eventBus.emit('inputDataChanged');
}
export function clearInputAudioURL() {
    state.workbench.input.audioURL = null;
    eventBus.emit('inputDataChanged');
}
export function setProcessingMode(mode) {
    state.workbench.processingMode = mode;
    eventBus.emit('processingModeChanged', mode);
}
export function setRenderingWorkbench(isRendering) {
    state.ui.isRenderingWorkbench = isRendering;
}
export function addInputPoint(point) {
    state.workbench.input.points.push(point);
    eventBus.emit('inputPointsChanged');
}
export function clearInputPoints() {
    if (state.workbench.input.points.length === 0) return;
    state.workbench.input.points = [];
    eventBus.emit('inputPointsChanged');
}
export function removeInputPoint(index) {
    if (index >= 0 && index < state.workbench.input.points.length) {
        state.workbench.input.points.splice(index, 1);
        eventBus.emit('inputPointsChanged');
    }
}
