export let state = {
    // System State
    directoryHandle: null,
    modules: [], // Will hold all loaded module manifests

    // Model & UI State
    modelStatuses: {}, // e.g., { 'Xenova/d...': { status: 'found', selectedVariant: '...' } }
    activeModuleId: null,

    // Worker & Processing State
    isProcessing: false,
    outputData: null,
    downloadProgress: { status: 'idle', progress: 0, total: 0, filename: '' },
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
    state.modelStatuses[moduleId].selectedVariant = variantName;
}

export function setProcessing(isProcessing) {
    state.isProcessing = isProcessing;
}

export function setOutputData(data) {
    state.outputData = data;
}

export function setActiveModule(module) {
    state.activeModule = module;
}

export function setModelFileStatus(status, message) {
    state.modelFileStatus = { status, message };
}

export function setDownloadProgress(progress) {
    state.downloadProgress = progress;
}
