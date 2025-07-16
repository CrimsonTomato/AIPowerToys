import { eventBus } from './_events/eventBus.js';

export let state = {
    // System State
    directoryHandle: null,
    modules: [],
    sidebarWidth: 500, // Default width
    theme: 'light', // 'light' or 'dark'
    gpuSupported: false,
    useGpu: false,

    // Model & UI State
    modelStatuses: {},
    activeModuleId: null,
    comparisonMode: 'none',
    starredModels: new Set(),
    modelOrder: [],
    processingMode: 'batch', // 'batch' or 'iterative'

    // Worker & Processing State
    isProcessing: false,
    outputData: null,
    inferenceStartTime: null,
    inputDataURLs: [], // For images
    inputAudioURL: null, // For audio
    inferenceDuration: null,
    downloadProgress: {
        status: 'idle',
        moduleId: null,
        progress: 0,
        total: 0,
        filename: '',
    },

    runtimeConfigs: {},
    collapsedModels: new Set(),
};

// --- Mutation Functions ---
export function setDirectoryHandle(handle) {
    state.directoryHandle = handle;
    eventBus.emit('directoryHandleChanged');
}
export function setModules(modules) {
    state.modules = modules;
    eventBus.emit('modulesChanged');
}
export function setSidebarWidth(width) {
    state.sidebarWidth = width;
    eventBus.emit('sidebarWidthChanged', width);
}
export function setTheme(theme) {
    state.theme = theme;
    eventBus.emit('themeChanged', theme);
}
export function setGpuSupported(isSupported) {
    state.gpuSupported = isSupported;
    eventBus.emit('gpuSupportChanged');
}
export function setUseGpu(shouldUse) {
    if (state.useGpu === shouldUse) return;
    state.useGpu = shouldUse;
    eventBus.emit('useGpuChanged', shouldUse);
}
export function updateModelStatus(moduleId, statusObject) {
    state.modelStatuses[moduleId] = {
        ...state.modelStatuses[moduleId],
        ...statusObject,
    };
    eventBus.emit('modelStatusUpdated', { moduleId, statusObject });
}
export function setActiveModuleId(moduleId) {
    if (state.activeModuleId === moduleId) return;
    state.activeModuleId = moduleId;
    eventBus.emit('activeModuleChanged', moduleId);
}
export function setSelectedVariant(moduleId, variantName) {
    if (state.modelStatuses[moduleId]) {
        state.modelStatuses[moduleId].selectedVariant = variantName;
        eventBus.emit('selectedVariantChanged', { moduleId, variantName });
    }
}
export function setProcessing(isProcessing) {
    state.isProcessing = isProcessing;
    eventBus.emit('processingStateChanged', isProcessing);
}
export function setOutputData(data) {
    // If data is an array but empty, treat it as null for consistency
    if (Array.isArray(data) && data.length === 0) {
        state.outputData = null;
    } else {
        state.outputData = data;
    }
    eventBus.emit('outputDataChanged');
}
export function setInferenceStartTime(time) {
    state.inferenceStartTime = time;
    eventBus.emit('inferenceStateChanged');
}
export function setInferenceDuration(duration) {
    state.inferenceDuration = duration;
    eventBus.emit('inferenceStateChanged');
}
export function setDownloadProgress(progress) {
    state.downloadProgress = { ...state.downloadProgress, ...progress };
    eventBus.emit('downloadProgressChanged', progress);
}
export function setRuntimeConfig(moduleId, paramId, value) {
    if (!state.runtimeConfigs[moduleId]) {
        state.runtimeConfigs[moduleId] = {};
    }
    state.runtimeConfigs[moduleId][paramId] = value;
    eventBus.emit('runtimeConfigChanged', { moduleId, paramId, value });
}
export function toggleModelCollapsed(moduleId) {
    if (state.collapsedModels.has(moduleId)) {
        state.collapsedModels.delete(moduleId);
    } else {
        state.collapsedModels.add(moduleId);
    }
    eventBus.emit('modelCollapsedToggled', moduleId);
}
export function toggleModelStarred(moduleId) {
    if (state.starredModels.has(moduleId)) {
        state.starredModels.delete(moduleId);
    } else {
        state.starredModels.add(moduleId);
    }
    eventBus.emit('modelStarredToggled', moduleId);
}
export function setModelOrder(order) {
    state.modelOrder = order;
    eventBus.emit('modelOrderChanged', order);
}
export function setComparisonMode(mode) {
    state.comparisonMode = mode;
    eventBus.emit('comparisonModeChanged', mode);
}
export function setStarredModels(models) {
    state.starredModels = models;
}
export function setCollapsedModels(modelsSet) {
    state.collapsedModels = modelsSet;
}
export function setInputDataURLs(urls) {
    state.inputDataURLs = urls;
    eventBus.emit('inputDataChanged');
}
export function clearInputDataURLs() {
    state.inputDataURLs = [];
    eventBus.emit('inputDataChanged');
}
export function setInputAudioURL(url, filename) {
    state.inputAudioURL = url ? { url, filename } : null;
    eventBus.emit('inputDataChanged');
}
export function clearInputAudioURL() {
    state.inputAudioURL = null;
    eventBus.emit('inputDataChanged');
}
export function setProcessingMode(mode) {
    state.processingMode = mode;
    eventBus.emit('processingModeChanged', mode);
}
