import { dom } from '../../dom.js';
import { state } from '../../state.js';
import { eventBus } from '../../_events/eventBus.js';
import { getContainSize } from '../../utils.js';
import { imageDataToCanvas } from '../utils/displayUtils.js';

let uiCache = {};
let inputImageForCompare = null;
let imageBounds = { x: 0, y: 0, width: 0, height: 0 };

const comparisonResizeObserver = new ResizeObserver(() => {
    if (state.workbench.output.comparisonMode === 'slide') {
        render();
    }
});

function cacheDOMElements() {
    const outputArea = dom.outputArea();
    uiCache = {
        outputArea,
        outputPlaceholder: document.getElementById('output-placeholder'),
        singleOutputCanvas: dom.getOutputCanvas(),
        batchOutputGrid: dom.outputImageGrid(),
        copyBtn: dom.copyBtn(),
        saveBtn: dom.saveBtn(),
        viewOutputBtn: dom.viewOutputBtn(),
        compareSlideBtn: dom.compareSlideBtn(),
        compareHoldBtn: dom.compareHoldBtn(),
        slider: dom.imageCompareSlider(),
    };
    if (outputArea) {
        // Disconnect from old element before observing new one
        comparisonResizeObserver.disconnect();
        comparisonResizeObserver.observe(outputArea);
    }
}

function renderOutputGrid(results) {
    const { batchOutputGrid } = uiCache;
    if (!batchOutputGrid || !results) return;

    // Clear previous results before appending new ones
    batchOutputGrid.innerHTML = '';

    // Programmatically create and append elements to preserve canvas pixel data
    results.forEach(imageData => {
        const canvas = imageDataToCanvas(imageData);
        if (!canvas) return; // Skip invalid or null image data

        // Create the wrapper div
        const gridItem = document.createElement('div');
        gridItem.className = 'grid-image-item';

        // Create the overlay
        const overlay = document.createElement('div');
        overlay.className = 'grid-item-overlay';
        overlay.innerHTML = `<span class="material-icons">zoom_in</span>`;

        // Append the canvas element itself (not its HTML string)
        gridItem.appendChild(canvas);
        gridItem.appendChild(overlay);

        // Append the completed item to the grid
        batchOutputGrid.appendChild(gridItem);
    });
}

async function _getLoadedInputImage() {
    const { imageURLs } = state.workbench.input;
    if (imageURLs.length === 0) return null;
    const previewSrc = imageURLs[0];

    if (!inputImageForCompare || inputImageForCompare.src !== previewSrc) {
        inputImageForCompare = new Image();
        inputImageForCompare.src = previewSrc;
        await new Promise((resolve, reject) => {
            inputImageForCompare.onload = resolve;
            inputImageForCompare.onerror = reject;
        });
    }
    return inputImageForCompare;
}

async function render() {
    const {
        outputArea,
        outputPlaceholder,
        singleOutputCanvas,
        batchOutputGrid,
        copyBtn,
        saveBtn,
        viewOutputBtn,
        compareSlideBtn,
        compareHoldBtn,
        slider,
    } = uiCache;

    if (!outputArea) return;

    const { data: outputData, comparisonMode } = state.workbench.output;
    const outputReady = outputData !== null;
    const isBatchMode = Array.isArray(outputData);

    // General visibility
    outputArea.dataset.controlsVisible = String(outputReady);
    outputPlaceholder.classList.toggle('hidden', outputReady);
    copyBtn.disabled = !outputReady;
    saveBtn.disabled = !outputReady;
    viewOutputBtn.disabled =
        !outputReady || typeof outputData === 'string' || isBatchMode;

    // Render output content (grid, single canvas, or nothing)
    if (outputReady) {
        if (isBatchMode) {
            singleOutputCanvas.classList.add('hidden');
            batchOutputGrid.classList.remove('hidden');
            renderOutputGrid(outputData);
        } else {
            batchOutputGrid.classList.add('hidden');
            singleOutputCanvas.classList.remove('hidden');
            if (outputData && outputData.width && outputData.height) {
                singleOutputCanvas.width = outputData.width;
                singleOutputCanvas.height = outputData.height;
                singleOutputCanvas
                    .getContext('2d')
                    .putImageData(outputData, 0, 0);
            }
        }
    } else {
        singleOutputCanvas.classList.add('hidden');
        batchOutputGrid.classList.add('hidden');
    }

    // Comparison controls logic
    const inputImage = await _getLoadedInputImage();
    const canCompare =
        outputReady &&
        !isBatchMode &&
        inputImage &&
        typeof outputData !== 'string';

    compareSlideBtn.classList.toggle('hidden', !canCompare);
    compareHoldBtn.classList.toggle('hidden', !canCompare);
    compareSlideBtn.classList.toggle('active', comparisonMode === 'slide');
    compareHoldBtn.classList.toggle('active', comparisonMode === 'hold');
    compareSlideBtn.disabled = !canCompare;
    compareHoldBtn.disabled = !canCompare;

    if (comparisonMode === 'slide' && canCompare) {
        const canvasRect = singleOutputCanvas.getBoundingClientRect();
        const outputAreaRect = outputArea.getBoundingClientRect();
        const visualImageRect = getContainSize(
            canvasRect.width,
            canvasRect.height,
            inputImage.width,
            inputImage.height
        );
        imageBounds = {
            x: canvasRect.left - outputAreaRect.left + visualImageRect.x,
            y: canvasRect.top - outputAreaRect.top + visualImageRect.y,
            width: visualImageRect.width,
            height: visualImageRect.height,
        };
        slider.style.top = `${imageBounds.y}px`;
        slider.style.height = `${imageBounds.height}px`;
        slider.style.left = `${imageBounds.x + imageBounds.width / 2}px`;
        slider.classList.remove('hidden');
        redrawCompareCanvas(imageBounds.x + imageBounds.width / 2);
    } else {
        slider.classList.add('hidden');
    }
}

// --- MODIFIED: Functions are now exported directly for global handlers to use ---
export function getImageBounds() {
    return imageBounds;
}

export async function showInputOnCanvas() {
    const canvas = dom.getOutputCanvas();
    const inputImage = await _getLoadedInputImage();
    if (!canvas || !inputImage) return;
    canvas.width = inputImage.width;
    canvas.height = inputImage.height;
    canvas
        .getContext('2d')
        .drawImage(inputImage, 0, 0, canvas.width, canvas.height);
}

export async function redrawCompareCanvas(splitX_visual) {
    const canvas = dom.getOutputCanvas();
    if (!canvas) return; // Add guard for when canvas is not on the page
    const ctx = canvas.getContext('2d');
    const inputImage = await _getLoadedInputImage();
    const outputImageData = state.workbench.output.data;

    if (!inputImage || !outputImageData || !outputImageData.width) return;

    canvas.width = inputImage.width;
    canvas.height = input - Image.height;

    const visualXRel = splitX_visual - imageBounds.x;
    const logicalX = (visualXRel / imageBounds.width) * canvas.width;
    const clampedX = Math.max(0, Math.min(logicalX, canvas.width));

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw left (input)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, clampedX, canvas.height);
    ctx.clip();
    ctx.drawImage(inputImage, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    // Draw right (output)
    ctx.save();
    ctx.beginPath();
    ctx.rect(clampedX, 0, canvas.width - clampedX, canvas.height);
    ctx.clip();
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = outputImageData.width;
    tempCanvas.height = outputImageData.height;
    tempCanvas.getContext('2d').putImageData(outputImageData, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
    ctx.restore();
}

export function initImageOutput() {
    cacheDOMElements();
    eventBus.on('outputDataChanged', render);
    eventBus.on('comparisonModeChanged', render);
    eventBus.on('inputDataChanged', render); // For comparison view
    render();
}
