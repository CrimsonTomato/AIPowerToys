import { dom } from '../dom.js';
import {
    runInference,
    copyOutputToClipboard,
    saveOutputToFile,
    downloadModel,
} from '../_controllers/modelController.js';
import { connectToDirectory } from '../_controllers/fileSystemController.js';
import {
    renderWorkbench,
    renderModelsList,
    renderStatus,
    renderComparisonView,
    redrawCompareCanvas,
    showInputOnCanvas,
    getImageBounds,
    openImageModal,
    closeImageModal,
} from '../ui.js';
import {
    state,
    setActiveModuleId,
    setSelectedVariant,
    setRuntimeConfig,
    toggleModelCollapsed,
    setComparisonMode,
} from '../state.js';

let isDraggingSlider = false;

export function initWorkbenchEvents() {
    document.body.addEventListener('click', async e => {
        const target = e.target;

        // Sidebar & Model List Actions
        if (target.closest('#connect-folder-btn')) {
            connectToDirectory();
        } else if (target.closest('.model-card-header')) {
            const header = target.closest('.model-card-header');
            const moduleId = header.dataset.moduleId;
            toggleModelCollapsed(moduleId);
            renderModelsList();
        } else if (target.closest('.select-model-btn')) {
            const btn = target.closest('.select-model-btn');
            const moduleId = btn.dataset.moduleId;
            setActiveModuleId(moduleId);
            renderModelsList();
            await renderWorkbench();
        } else if (target.closest('.download-btn')) {
            const btn = target.closest('.download-btn');
            const moduleId = btn.dataset.moduleId;
            downloadModel(moduleId);

            // Workbench Actions
        } else if (target.closest('#run-inference-btn')) {
            const imageData = dom.getImagePreview()?.src;
            runInference(imageData);
        } else if (target.closest('#copy-btn')) {
            copyOutputToClipboard();
        } else if (target.closest('#save-btn')) {
            saveOutputToFile();
        } else if (target.closest('#view-input-btn')) {
            openImageModal('input');
        } else if (target.closest('#view-output-btn')) {
            openImageModal('output');

            // Modal Closing Actions
        } else if (
            target.closest('#modal-close-btn') ||
            target.id === 'image-modal'
        ) {
            closeImageModal();

            // Comparison button clicks
        } else if (target.closest('#compare-slide-btn')) {
            const newMode = state.comparisonMode === 'slide' ? 'none' : 'slide';
            setComparisonMode(newMode);
            await renderComparisonView();
        } else if (target.closest('#compare-hold-btn')) {
            const newMode = state.comparisonMode === 'hold' ? 'none' : 'hold';
            setComparisonMode(newMode);
            await renderComparisonView();
        }
    });

    document.body.addEventListener('change', e => {
        const target = e.target;
        if (target.id === 'image-picker') {
            const file = e.target.files[0];
            if (file) {
                loadImageFile(file);
            }
        } else if (target.matches('.variant-selector')) {
            const moduleId = target.dataset.moduleId;
            const variantName = target.value;
            setSelectedVariant(moduleId, variantName);
            renderStatus();
        }
        // --- NEW: Handle checkbox changes ---
        else if (target.matches('.runtime-control input[type="checkbox"]')) {
            const moduleId = target.dataset.moduleId;
            const paramId = target.dataset.paramId;
            const value = target.checked; // Get boolean value
            setRuntimeConfig(moduleId, paramId, value);
        }
    });

    document.body.addEventListener('input', e => {
        const target = e.target;
        if (target.matches('.runtime-control input[type="range"]')) {
            const moduleId = target.dataset.moduleId;
            const paramId = target.dataset.paramId;
            const value = parseFloat(target.value);
            setRuntimeConfig(moduleId, paramId, value);
            const valueDisplay = document.getElementById(
                `param-val-${paramId}`
            );
            if (valueDisplay) valueDisplay.textContent = value;
        }
    });

    document.body.addEventListener('mousedown', handleCompareMouseDown);
    document.body.addEventListener('mousemove', handleCompareMouseMove);
    document.body.addEventListener('mouseup', handleCompareMouseUp);
    document.body.addEventListener('mouseleave', handleCompareMouseUp);

    handleImageDropAreaEvents();
}

export function initGlobalEvents() {
    applySavedTheme();

    const themeToggleBtn = dom.themeToggleBtn();
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
}

function toggleTheme() {
    const isDarkMode = document.documentElement.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark-mode');
    } else {
        document.documentElement.classList.remove('dark-mode');
    }
}

function loadImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        console.warn('Selected file is not an image.');
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        const preview = dom.getImagePreview();
        const placeholder = dom.getImageInputPlaceholder();
        if (preview) {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            if (placeholder) placeholder.classList.add('hidden');
            renderStatus();
        }
    };
    reader.readAsDataURL(file);
}

function handleImageDropAreaEvents() {
    const dropArea = dom.getImageDropArea();
    if (!dropArea) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(
            eventName,
            () => dropArea.classList.add('drag-over'),
            false
        );
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(
            eventName,
            () => dropArea.classList.remove('drag-over'),
            false
        );
    });

    dropArea.addEventListener(
        'drop',
        e => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                loadImageFile(files[0]);
            }
        },
        false
    );
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// --- CLEANED UP: Comparison Event Handlers ---

function handleCompareMouseDown(e) {
    const slider = dom.imageCompareSlider();
    const outputArea = dom.outputArea();

    if (slider && e.target.closest('#image-compare-slider')) {
        isDraggingSlider = true;
        slider.classList.add('dragging');
        e.preventDefault();
    } else if (
        outputArea &&
        e.target.closest('.output-area') &&
        state.comparisonMode === 'hold'
    ) {
        showInputOnCanvas();
        e.preventDefault();
    }
}

function handleCompareMouseMove(e) {
    if (!isDraggingSlider) return;
    e.preventDefault();

    const outputArea = dom.outputArea();
    if (!outputArea) return;

    const imageBounds = getImageBounds();
    const rect = outputArea.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const position = Math.max(
        imageBounds.x,
        Math.min(imageBounds.x + imageBounds.width, mouseX)
    );

    const slider = dom.imageCompareSlider();
    if (slider) slider.style.left = `${position}px`;

    redrawCompareCanvas(position);
}

function handleCompareMouseUp() {
    if (isDraggingSlider) {
        const slider = dom.imageCompareSlider();
        if (slider) slider.classList.remove('dragging');
        isDraggingSlider = false;
    } else if (state.comparisonMode === 'hold') {
        renderComparisonView();
    }
}
