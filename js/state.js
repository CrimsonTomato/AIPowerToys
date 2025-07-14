export let state = {
    // System State
    directoryHandle: null,
    modules: [], // Will hold all loaded module manifests

    // Model & UI State
    modelStatuses: {}, // e.g., { 'Xenova/d...': { status: 'found', selectedVariant: '...' } }
    activeModuleId: null,

    // NEW: Add state for comparison mode
    comparisonMode: 'none', // 'none', 'slide', 'hold'

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

    runtimeConfigs: {}, // To store { moduleId: { paramId: value } }
    collapsedModels: new Set(),
};

// --- Mutation Functions ---
export function setDirectoryHandle(handle) {
    state.directoryHandle = handle;
}

export function setModules(modules) {
    state.modules = modules;
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
    // Ensure the model status object exists before trying to set a property on it
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

export function setComparisonMode(mode) {
    state.comparisonMode = mode;
}
