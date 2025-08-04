import { dom } from '../../dom.js';
import { state, removeInputPoint } from '../../state.js';
import { eventBus } from '../../_events/eventBus.js';

let uiCache = {};

function cacheDOMElements() {
    uiCache = {
        dropArea: dom.getImageDropArea(),
        placeholder: dom.getImageInputPlaceholder(),
        inputGrid: dom.imageInputGrid(),
        singlePreview: dom.getImagePreview(),
        pointsContainer: dom.promptPointsContainer(),
        uploadImageBtn: dom.uploadImageBtn(),
        clearInputBtn: dom.clearInputBtn(),
        clearPointsBtn: dom.clearPointsBtn(),
        viewInputBtn: dom.viewInputBtn(),
    };
}

function render() {
    const {
        dropArea,
        placeholder,
        inputGrid,
        singlePreview,
        pointsContainer,
        uploadImageBtn,
        clearInputBtn,
        clearPointsBtn,
        viewInputBtn,
    } = uiCache;

    if (!dropArea) return;

    const { imageURLs, points } = state.workbench.input;
    const { modules, activeModuleId } = state.models;
    const imageReady = imageURLs.length > 0;
    const isBatchMode = imageURLs.length > 1;
    const activeModule = modules.find(m => m.id === activeModuleId);
    const isSamTask = activeModule?.task === 'image-segmentation-with-prompt';

    dropArea.dataset.controlsVisible = String(imageReady || isSamTask);
    dropArea.dataset.hasContent = String(imageReady);

    if (uploadImageBtn) {
        uploadImageBtn.classList.toggle('hidden', !isSamTask && imageReady);
    }
    if (placeholder) {
        placeholder.classList.toggle('hidden', imageReady);
    }
    if (clearInputBtn) {
        clearInputBtn.disabled = !imageReady;
    }
    if (clearPointsBtn) {
        clearPointsBtn.disabled = points.length === 0;
    }
    if (viewInputBtn) {
        viewInputBtn.disabled = imageURLs.length !== 1;
    }

    if (singlePreview) singlePreview.classList.add('hidden');
    if (inputGrid) inputGrid.classList.add('hidden');

    if (imageReady) {
        if (isBatchMode && !isSamTask && inputGrid) {
            inputGrid.classList.remove('hidden');
            inputGrid.innerHTML = imageURLs
                .map(
                    url => `
                <div class="grid-image-item" data-image-data-url="${url}">
                    <img src="${url}" alt="Input image">
                    <div class="grid-item-overlay"><span class="material-icons">zoom_in</span></div>
                </div>`
                )
                .join('');
        } else if (singlePreview) {
            singlePreview.classList.remove('hidden');
            singlePreview.src = imageURLs[0];
        }
    } else {
        if (singlePreview) singlePreview.src = '';
        if (inputGrid) inputGrid.innerHTML = '';
    }

    if (pointsContainer) {
        pointsContainer.classList.toggle('hidden', !isSamTask || !imageReady);
        pointsContainer.innerHTML = '';
        if (isSamTask && imageReady) {
            pointsContainer.innerHTML = points
                .map(
                    (p, index) => `
                <div class="prompt-point ${
                    p.label === 1 ? 'positive' : 'negative'
                }" 
                     style="left: ${p.point[0] * 100}%; top: ${
                        p.point[1] * 100
                    }%"
                     data-point-index="${index}"
                     title="${
                         p.label === 1 ? 'Positive' : 'Negative'
                     } point (click to remove)">
                </div>`
                )
                .join('');
        }
    }
}

// Attach event listener for removing points
document.body.addEventListener('click', e => {
    const pointEl = e.target.closest('.prompt-point');
    if (pointEl?.dataset.pointIndex !== undefined) {
        e.stopPropagation();
        removeInputPoint(parseInt(pointEl.dataset.pointIndex, 10));
    }
});

export function initImageInput() {
    cacheDOMElements();
    eventBus.on('inputDataChanged', render);
    eventBus.on('inputPointsChanged', render);
    eventBus.on('activeModuleChanged', render);
    render();
}
