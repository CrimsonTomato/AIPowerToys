// Centralized DOM element selectors.
// By exporting functions, we ensure getElementById is called just-in-time.
export const dom = {
    app: () => document.getElementById('app'),
    modelsList: () => document.getElementById('models-list'),
    workbenchArea: () => document.getElementById('workbench-area'),

    // Dynamic elements in the workbench
    getImagePicker: () => document.getElementById('image-picker'),
    getImagePreview: () => document.getElementById('image-preview'),
    getOutputCanvas: () => document.getElementById('output-canvas'),
    statusText: () => document.getElementById('status-text'),
    runInferenceBtn: () => document.getElementById('run-inference-btn'),
    copyBtn: () => document.getElementById('copy-btn'),
    saveBtn: () => document.getElementById('save-btn'),
};
