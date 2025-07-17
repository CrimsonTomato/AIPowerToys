// Centralized DOM element selectors.
export const dom = {
    appContainer: () => document.getElementById('app-container'),
    centerStage: () => document.getElementById('center-stage'),

    // --- Sidebar ---
    leftSidebar: () => document.getElementById('left-sidebar'),
    connectFolderBtn: () => document.getElementById('connect-folder-btn'),
    currentFolderPath: () => document.getElementById('current-folder-path'),
    gpuStatusText: () => document.getElementById('gpu-status-text'),
    gpuToggleBtn: () => document.getElementById('gpu-toggle-btn'),
    modelsList: () => document.getElementById('models-list'),
    themeToggleBtn: () => document.getElementById('theme-toggle-btn'),
    themeIconSun: () => document.getElementById('theme-icon-sun'),
    themeIconMoon: () => document.getElementById('theme-icon-moon'),
    resetSidebarBtn: () => document.getElementById('reset-sidebar-btn'),

    // --- Workbench ---
    workbenchArea: () => document.getElementById('workbench-area'),
    workbenchInputArea: () => document.getElementById('workbench-input-area'),
    workbenchOutputArea: () => document.getElementById('workbench-output-area'),
    inferenceTimer: () => document.getElementById('inference-timer'),
    runtimeControlsContainer: () =>
        document.getElementById('runtime-controls-container'),
    outputOptionsContainer: () =>
        document.getElementById('output-options-container'),
    outputFilenameInput: () => document.getElementById('output-filename-input'),
    runInferenceBtn: () => document.getElementById('run-inference-btn'),
    statusText: () => document.getElementById('status-text'),

    // --- Input Area ---
    getImagePicker: () => document.getElementById('image-picker'),
    getImagePreview: () => document.getElementById('image-preview'),
    getImageDropArea: () => document.getElementById('image-drop-area'),
    getImageInputPlaceholder: () =>
        document.getElementById('image-input-placeholder'),
    imageInputGrid: () => document.getElementById('image-input-grid'),
    getAudioPicker: () => document.getElementById('audio-picker'),
    getAudioDropArea: () => document.getElementById('audio-drop-area'),
    getAudioInputPlaceholder: () =>
        document.getElementById('audio-input-placeholder'),
    getAudioLoadedView: () => document.getElementById('audio-loaded-view'),
    getAudioFilenameDisplay: () =>
        document.getElementById('audio-filename-display'),
    getAudioPreviewPlayer: () =>
        document.getElementById('audio-preview-player'),
    inputControls: () =>
        document.querySelector('#image-drop-area .input-controls'),
    uploadImageBtn: () => document.getElementById('upload-image-btn'),
    clearInputBtn: () => document.getElementById('clear-input-btn'),
    clearPointsBtn: () => document.getElementById('clear-points-btn'),
    promptPointsContainer: () =>
        document.getElementById('prompt-points-container'),
    viewInputBtn: () => document.getElementById('view-input-btn'),

    // --- Output Area ---
    getOutputCanvas: () => document.getElementById('output-canvas'),
    getTextOutputArea: () => document.getElementById('text-output-area'),
    outputArea: () => document.querySelector('.output-area'),
    outputControls: () =>
        document.querySelector(
            '.output-area .output-controls, #text-output-container .output-controls'
        ),
    copyBtn: () => document.getElementById('copy-btn'),
    saveBtn: () => document.getElementById('save-btn'),
    viewOutputBtn: () => document.getElementById('view-output-btn'),
    compareSlideBtn: () => document.getElementById('compare-slide-btn'),
    compareHoldBtn: () => document.getElementById('compare-hold-btn'),
    outputImageGrid: () => document.getElementById('output-image-grid'),
    imageCompareSlider: () => document.getElementById('image-compare-slider'),
    showCutoutBtn: () => document.getElementById('show-cutout-btn'), // NEW
    showOverlayBtn: () => document.getElementById('show-overlay-btn'), // NEW
    showMaskOnlyBtn: () => document.getElementById('show-mask-only-btn'), // NEW

    // --- Modal ---
    imageModal: () => document.getElementById('image-modal'),
    modalCloseBtn: () => document.getElementById('modal-close-btn'),
    modalBody: () => document.querySelector('#image-modal .modal-body'),
};
