// Centralized DOM element selectors.
// By exporting functions, we ensure getElementById is called just-in-time.
export const dom = {
    app: () => document.getElementById('app'),
    modelsList: () => document.getElementById('models-list'),

    appContainer: () => document.getElementById('app-container'),
    leftSidebar: () => document.getElementById('left-sidebar'),
    centerStage: () => document.getElementById('center-stage'),

    folderConnectionArea: () =>
        document.getElementById('folder-connection-area'),
    connectFolderBtn: () => document.getElementById('connect-folder-btn'),
    currentFolderPath: () => document.getElementById('current-folder-path'),

    workbenchContent: () => document.getElementById('workbench-view-content'),
    workbenchArea: () => document.getElementById('workbench-area'),

    // Selectors for component injection areas
    workbenchInputArea: () => document.getElementById('workbench-input-area'),
    workbenchOutputArea: () => document.getElementById('workbench-output-area'),

    getImagePicker: () => document.getElementById('image-picker'),
    getImagePreview: () => document.getElementById('image-preview'),
    getImageDropArea: () => document.getElementById('image-drop-area'),
    getImageInputPlaceholder: () =>
        document.getElementById('image-input-placeholder'),
    // Selector for input-specific controls container
    inputControls: () =>
        document.querySelector('#image-drop-area .input-controls'),
    viewInputBtn: () => document.getElementById('view-input-btn'),

    getOutputCanvas: () => document.getElementById('output-canvas'),
    statusText: () => document.getElementById('status-text'),
    runInferenceBtn: () => document.getElementById('run-inference-btn'),

    // NEW: Filename input
    outputOptionsContainer: () =>
        document.getElementById('output-options-container'),
    outputFilenameInput: () => document.getElementById('output-filename-input'),

    // Selector for output-specific controls container
    outputArea: () => document.querySelector('.output-area'),
    outputControls: () =>
        document.querySelector('.output-area .output-controls'),
    copyBtn: () => document.getElementById('copy-btn'),
    saveBtn: () => document.getElementById('save-btn'),
    viewOutputBtn: () => document.getElementById('view-output-btn'),
    compareSlideBtn: () => document.getElementById('compare-slide-btn'),
    compareHoldBtn: () => document.getElementById('compare-hold-btn'),
    imageCompareSlider: () => document.getElementById('image-compare-slider'),

    // Modal elements
    imageModal: () => document.getElementById('image-modal'),
    modalCloseBtn: () => document.getElementById('modal-close-btn'),
    modalBody: () => document.querySelector('#image-modal .modal-body'),

    themeToggleBtn: () => document.getElementById('theme-toggle-btn'),
};
