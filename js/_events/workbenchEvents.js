// workbenchEvents.js
import { dom } from '../dom.js';
import {
    runInference,
    copyOutputToClipboard,
    saveOutputToFile,
    downloadModel,
} from '../_controllers/modelController.js';
import {
    connectToDirectory,
    saveAppState,
} from '../_controllers/fileSystemController.js';
import {
    renderStatus,
    openImageModal,
    closeImageModal,
    applySidebarWidth,
    applyTheme,
} from '../ui/main.js';
import { renderModelsList, handleSearch } from '../ui/models.js';
import {
    renderWorkbench,
    renderComparisonView,
    redrawCompareCanvas,
    showInputOnCanvas,
    getImageBounds,
} from '../ui/workbench.js';
import {
    state,
    setActiveModuleId,
    setSelectedVariant,
    setRuntimeConfig,
    toggleModelCollapsed,
    setComparisonMode,
    toggleModelStarred,
    setSidebarWidth,
    setTheme,
} from '../state.js';
let isDraggingSlider = false;
let isResizingSidebar = false;

// --- Click Event Handlers ---

async function handleConnectFolder() {
    connectToDirectory();
}

// Handles clicks specifically on the chevron button to toggle collapse/expand.
async function handleToggleModelCollapse(e, element) {
    e.stopPropagation(); // CRITICAL: Prevent the click event from bubbling up to the parent '.model-card' handler.
    const moduleId = element.dataset.moduleId;
    if (!moduleId) return;
    toggleModelCollapsed(moduleId);
    renderModelsList();
    // --- NEW: Persist the change ---
    saveAppState();
    // --- END NEW ---
}

// Handles clicks on the star icon to toggle starred status.
async function handleStarClick(e, element) {
    e.stopPropagation(); // CRITICAL: Prevent the click event from bubbling up to the parent '.model-card' handler.
    const moduleId = element.dataset.moduleId;
    if (!moduleId) return;
    toggleModelStarred(moduleId);
    renderModelsList();
    // --- ALREADY PRESENT: Persist the change ---
    saveAppState();
    // --- END ALREADY PRESENT ---
}

// Handles clicks on the "Use Model" button to select and activate a model.
async function handleUseModel(e, element) {
    e.stopPropagation();
    const moduleId = element.dataset.moduleId;
    if (!moduleId) return;
    if (state.activeModuleId !== moduleId) {
        setActiveModuleId(moduleId);
        renderModelsList();
        await renderWorkbench();
        renderStatus();
    }
}

// Handles downloading a model.
async function handleDownloadModel(e, element) {
    e.stopPropagation();
    const moduleId = element.dataset.moduleId;
    if (!moduleId) return;
    downloadModel(moduleId);
}

// Handles clicks on the main card body (title, description, etc.)
async function handleSelectCard(e, element) {
    const clickedElement = e.target;
    const moduleId = element.dataset.moduleId;

    // GUARD CLAUSE: If the click was on any element that has its own dedicated handler, exit.
    if (
        clickedElement.closest('.star-btn') ||
        clickedElement.closest('.model-card-toggle-btn') ||
        clickedElement.closest('.select-model-btn') ||
        clickedElement.closest('.download-btn')
    ) {
        return;
    }

    // Handle clicks on the general card body (title, description, etc.)
    const isCollapsed = element.dataset.collapsed === 'true';

    if (isCollapsed) {
        // If collapsed, expand the card.
        toggleModelCollapsed(moduleId);
        renderModelsList();
        // --- NEW: Persist the change ---
        saveAppState();
        // --- END NEW ---
    } else {
        // If expanded, activate the module.
        if (state.activeModuleId === moduleId) return;
        setActiveModuleId(moduleId);
        renderModelsList();
        await renderWorkbench();
        renderStatus();
    }
}

async function handleRunInference() {
    const imageData = dom.getImagePreview()?.src;
    runInference(imageData);
}

async function handleCopyOutput() {
    copyOutputToClipboard();
}

async function handleSaveOutput() {
    saveOutputToFile();
}

async function handleViewInput() {
    openImageModal('input');
}

async function handleViewOutput() {
    openImageModal('output');
}

async function handleCloseModal(e) {
    closeImageModal();
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
    // --- ALREADY PRESENT: Persist the change ---
    saveAppState();
    // --- END ALREADY PRESENT ---
}

async function handleResetSidebar() {
    setSidebarWidth(500);
    applySidebarWidth();
    // --- ALREADY PRESENT: Persist the change ---
    saveAppState();
    // --- END ALREADY PRESENT ---
}

// Maps CSS selectors to their corresponding event handler functions.
const clickHandlers = {
    '.star-btn': handleStarClick,
    '.model-card-toggle-btn': handleToggleModelCollapse,
    '.select-model-btn': handleUseModel,
    '.download-btn': handleDownloadModel,
    '.model-card': handleSelectCard, // General card body click handler

    '#connect-folder-btn': handleConnectFolder,
    '#run-inference-btn': handleRunInference,
    '#copy-btn': handleCopyOutput,
    '#save-btn': handleSaveOutput,
    '#view-input-btn': handleViewInput,
    '#view-output-btn': handleViewOutput,
    '#modal-close-btn': handleCloseModal,
    '#image-modal': handleCloseModal,
    '#compare-slide-btn': handleToggleSlideCompare,
    '#compare-hold-btn': handleToggleHoldCompare,
    '#theme-toggle-btn': handleToggleTheme,
    '#reset-sidebar-btn': handleResetSidebar,
};

export function initWorkbenchEvents() {
    // --- Main Click Event Dispatcher ---
    document.body.addEventListener('click', async e => {
        for (const [selector, handler] of Object.entries(clickHandlers)) {
            const element = e.target.closest(selector);
            if (
                element &&
                (selector !== '#image-modal' || e.target.id === 'image-modal')
            ) {
                await handler(e, element);
                return; // Stop processing further handlers for this click.
            }
        }
    });

    // --- Other Event Listeners ---
    document.body.addEventListener('change', e => {
        const target = e.target;
        if (target.id === 'image-picker') {
            const file = target.files[0];
            if (file) loadImageFile(file);
        } else if (target.matches('.variant-selector')) {
            const moduleId = target.dataset.moduleId;
            const variantName = target.value;
            setSelectedVariant(moduleId, variantName);
            renderStatus();
        } else if (target.matches('.runtime-control input[type="checkbox"]')) {
            const moduleId = target.dataset.moduleId;
            const paramId = target.dataset.paramId;
            const value = target.checked;
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
        } else if (target.id === 'model-search-input') {
            handleSearch(e.target.value);
        }
    });

    document.body.addEventListener('mousedown', handleMouseDown);
    document.body.addEventListener('mousemove', handleMouseMove);
    document.body.addEventListener('mouseup', handleMouseUp);
    document.body.addEventListener('mouseleave', handleMouseUp);

    handleImageDropAreaEvents();
}

export function initGlobalEvents() {
    applyTheme();
    applySidebarWidth();
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
            if (files.length > 0) loadImageFile(files[0]);
        },
        false
    );
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// --- Combined Mouse Handlers for Resizing and Comparison Slider ---

function handleMouseDown(e) {
    if (e.target.matches('.sidebar-resizer')) {
        isResizingSidebar = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    } else if (e.target.closest('#image-compare-slider')) {
        isDraggingSlider = true;
        e.preventDefault();
    } else if (
        e.target.closest('.output-area') &&
        state.comparisonMode === 'hold'
    ) {
        showInputOnCanvas();
        e.preventDefault();
    }
}

function handleMouseMove(e) {
    if (isResizingSidebar) {
        const newWidth = Math.max(300, Math.min(e.clientX, 800));
        setSidebarWidth(newWidth);
        applySidebarWidth();
        // --- NEW: Persist the change ---
        saveAppState();
        // --- END NEW ---
    } else if (isDraggingSlider) {
        const outputArea = dom.outputArea();
        if (!outputArea) return;
        const imageBounds = getImageBounds();
        const rect = outputArea.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const position = Math.max(
            imageBounds.x,
            Math.min(imageBounds.x + imageBounds.width, mouseX)
        );
        dom.imageCompareSlider().style.left = `${position}px`;
        redrawCompareCanvas(position);
    }
}

function handleMouseUp() {
    if (isResizingSidebar) {
        isResizingSidebar = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }
    if (isDraggingSlider) {
        isDraggingSlider = false;
    } else if (state.comparisonMode === 'hold') {
        renderComparisonView();
    }
}
