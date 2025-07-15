import { dom } from '../dom.js';
import { state } from '../state.js';
import { renderModelsList } from './models.js';
import { renderComparisonView } from './workbench.js';

export async function renderApp() {
    // Inject the sidebar HTML
    const appContainer = dom.appContainer();
    if (!appContainer) return;

    appContainer.innerHTML = `
        <div id="left-sidebar-container"></div>
        <main class="center-stage" id="center-stage"></main>
    `;

    const sidebarContainer = document.getElementById('left-sidebar-container');
    const response = await fetch('/components/left_sidebar.html');
    sidebarContainer.innerHTML = await response.text();

    // Render the initial workbench view shell
    const workbenchResponse = await fetch(
        '/components/views/view_workbench.html'
    );
    dom.centerStage().innerHTML = await workbenchResponse.text();

    renderModelsList();
}

export function renderStatus() {
    const statusEl = dom.statusText();
    const runBtn = dom.runInferenceBtn();
    if (!statusEl || !runBtn) return;

    const copyBtn = dom.copyBtn();
    const saveBtn = dom.saveBtn();
    const viewInputBtn = dom.viewInputBtn();
    const viewOutputBtn = dom.viewOutputBtn();
    const compareSlideBtn = dom.compareSlideBtn();
    const compareHoldBtn = dom.compareHoldBtn();

    const imagePreview = dom.getImagePreview();
    const imageReady =
        imagePreview?.src && !imagePreview.classList.contains('hidden');
    const outputReady = state.outputData !== null;

    // --- NEW LOGIC for controlling visibility ---
    // This is the fix for the missing buttons.
    const imageDropArea = dom.getImageDropArea();
    if (imageDropArea) {
        imageDropArea.dataset.controlsVisible = String(imageReady);
    }
    const outputArea = dom.outputArea();
    if (outputArea) {
        outputArea.dataset.controlsVisible = String(outputReady);
    }
    // --- END NEW LOGIC ---

    if (state.isProcessing) {
        statusEl.textContent = 'Status: Processing... Please wait.';
        runBtn.disabled = true;
        runBtn.textContent = 'Processing...';
        if (copyBtn) copyBtn.disabled = true;
        if (saveBtn) saveBtn.disabled = true;
        if (viewInputBtn) viewInputBtn.disabled = true;
        if (viewOutputBtn) viewOutputBtn.disabled = true;
        if (compareSlideBtn) compareSlideBtn.disabled = true;
        if (compareHoldBtn) compareHoldBtn.disabled = true;
    } else {
        let statusMessage = 'Status: ';
        const activeModule = state.modules.find(
            m => m.id === state.activeModuleId
        );
        if (!state.activeModuleId) {
            statusMessage += 'Select a model from the sidebar.';
        } else if (!imageReady) {
            statusMessage += 'Choose an image to process.';
        } else {
            const modelStatus = state.modelStatuses[activeModule.id] || {};
            statusMessage += `Ready (Model: ${activeModule.name}, Variant: ${
                modelStatus.selectedVariant || 'Default'
            })`;
        }
        statusEl.textContent = statusMessage;

        runBtn.disabled = !state.activeModuleId || !imageReady;
        runBtn.textContent = 'Run Inference';

        // The button disabling logic remains correct.
        if (copyBtn) copyBtn.disabled = !outputReady;
        if (saveBtn) saveBtn.disabled = !outputReady;
        if (viewInputBtn) viewInputBtn.disabled = !imageReady;
        if (viewOutputBtn) viewOutputBtn.disabled = !outputReady;

        const canCompare = imageReady && outputReady;
        if (compareSlideBtn) compareSlideBtn.disabled = !canCompare;
        if (compareHoldBtn) compareHoldBtn.disabled = !canCompare;

        if (outputReady) {
            renderComparisonView();
        }
    }
}

export function renderFolderConnectionStatus() {
    const connectBtn = dom.connectFolderBtn();
    const pathText = dom.currentFolderPath();
    if (!connectBtn || !pathText) return;

    if (state.directoryHandle) {
        connectBtn.textContent = 'Change Folder';
        pathText.textContent = `Connected: ${state.directoryHandle.name}`;
    } else {
        connectBtn.textContent = 'Connect Folder';
        pathText.textContent = 'Not connected';
    }
}

export function openImageModal(type) {
    const modal = dom.imageModal();
    const modalBody = dom.modalBody();
    if (!modal || !modalBody) return;

    modalBody.innerHTML = '';
    let contentElement;
    if (type === 'input') {
        const imgPreview = dom.getImagePreview();
        if (!imgPreview || imgPreview.classList.contains('hidden')) return;
        contentElement = document.createElement('img');
        contentElement.src = imgPreview.src;
    } else if (type === 'output') {
        const outputCanvas = dom.getOutputCanvas();
        if (!outputCanvas || outputCanvas.width === 0) return;
        contentElement = outputCanvas.cloneNode(true);
        const ctx = contentElement.getContext('2d');
        ctx.drawImage(outputCanvas, 0, 0);
    } else {
        return;
    }

    contentElement.classList.add('modal-image');
    modalBody.appendChild(contentElement);
    modal.classList.remove('hidden');
}

export function closeImageModal() {
    const modal = dom.imageModal();
    const modalBody = dom.modalBody();
    if (modal) modal.classList.add('hidden');
    if (modalBody) modalBody.innerHTML = '';
}

export function applyTheme() {
    const isDark = state.theme === 'dark';
    document.documentElement.classList.toggle('dark-mode', isDark);
    const sunIcon = dom.themeIconSun();
    const moonIcon = dom.themeIconMoon();
    if (sunIcon && moonIcon) {
        sunIcon.classList.toggle('hidden', isDark);
        moonIcon.classList.toggle('hidden', !isDark);
    }
}

export function applySidebarWidth() {
    const appContainer = dom.appContainer();
    if (appContainer) {
        appContainer.style.gridTemplateColumns = `${state.sidebarWidth}px 1fr`;
    }
}
