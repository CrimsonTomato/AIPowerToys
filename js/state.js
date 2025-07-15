export let state = {
    // System State
    directoryHandle: null,
    modules: [],
    sidebarWidth: 500, // Default width
    theme: 'light', // 'light' or 'dark'

    // Model & UI State
    modelStatuses: {},
    activeModuleId: null,
    comparisonMode: 'none',
    starredModels: new Set(),
    modelOrder: [],

    // Worker & Processing State
    isProcessing: false,
    outputData: null,
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
}
export function setModules(modules) {
    state.modules = modules;
}
export function setSidebarWidth(width) {
    state.sidebarWidth = width;
}
export function setTheme(theme) {
    state.theme = theme;
}
export function updateModelStatus(moduleId, statusObject) {
    state.modelStatuses[moduleId] = {
        ...state.modelStatuses[moduleId],
        ...statusObject,
    };
}
export function setActiveModuleId(moduleId) {
    state.activeModuleId = moduleId;
}
export function setSelectedVariant(moduleId, variantName) {
    if (state.modelStatuses[moduleId]) {
        state.modelStatuses[moduleId].selectedVariant = variantName;
    }
}
export function setProcessing(isProcessing) {
    state.isProcessing = isProcessing;
}
export function setOutputData(data) {
    state.outputData = data;
}
export function setDownloadProgress(progress) {
    state.downloadProgress = { ...state.downloadProgress, ...progress };
}
export function setRuntimeConfig(moduleId, paramId, value) {
    if (!state.runtimeConfigs[moduleId]) {
        state.runtimeConfigs[moduleId] = {};
    }
    state.runtimeConfigs[moduleId][paramId] = value;
}
export function toggleModelCollapsed(moduleId) {
    if (state.collapsedModels.has(moduleId)) {
        state.collapsedModels.delete(moduleId);
    } else {
        state.collapsedModels.add(moduleId);
    }
}
export function toggleModelStarred(moduleId) {
    if (state.starredModels.has(moduleId)) {
        state.starredModels.delete(moduleId);
    } else {
        state.starredModels.add(moduleId);
    }
}
export function setModelOrder(order) {
    state.modelOrder = order;
}
export function setComparisonMode(mode) {
    state.comparisonMode = mode;
}
export function setStarredModels(models) {
    state.starredModels = models;
}
// Add a setter for collapsedModels for loading state
export function setCollapsedModels(modelsSet) {
    state.collapsedModels = modelsSet;
}