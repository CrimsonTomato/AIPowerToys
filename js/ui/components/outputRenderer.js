import { dom } from '../../dom.js';
import { state } from '../../state.js';

/**
 * Renders the output grid for batch processing results.
 * @param {ImageData[]} results - An array of ImageData objects to render.
 */
function renderOutputGrid(results) {
    const grid = dom.outputImageGrid();
    if (!grid) return;

    grid.innerHTML = '';

    if (!results || results.length === 0) {
        return;
    }

    results.forEach(imageData => {
        if (!imageData) return;

        const item = document.createElement('div');
        item.className = 'grid-image-item';

        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        canvas.getContext('2d').putImageData(imageData, 0, 0);

        const overlay = document.createElement('div');
        overlay.className = 'grid-item-overlay';
        overlay.innerHTML = `<span class="material-icons">zoom_in</span>`;

        item.appendChild(canvas);
        item.appendChild(overlay);
        grid.appendChild(item);
    });
}

function clearOutputGrid() {
    const grid = dom.outputImageGrid();
    if (grid) grid.innerHTML = '';
}

export function renderOutputState() {
    const outputReady = state.workbench.output.data !== null;

    // --- Image Output ---
    const outputArea = dom.outputArea();
    if (outputArea) {
        const isBatchMode = Array.isArray(state.workbench.output.data);
        const singleOutputCanvas = dom.getOutputCanvas();
        const batchOutputGrid = dom.outputImageGrid();
        const outputPlaceholder = document.getElementById('output-placeholder');

        outputArea.dataset.controlsVisible = String(outputReady);
        outputPlaceholder.classList.toggle('hidden', outputReady);

        if (outputReady) {
            if (isBatchMode) {
                singleOutputCanvas.classList.add('hidden');
                batchOutputGrid.classList.remove('hidden');
                renderOutputGrid(state.workbench.output.data);
            } else {
                batchOutputGrid.classList.add('hidden');
                singleOutputCanvas.classList.remove('hidden');

                // For SAM, state.workbench.output.data is now directly the cutout ImageData.
                // For other tasks, it's also directly ImageData.
                const imageDataToRender = state.workbench.output.data;

                if (
                    imageDataToRender &&
                    imageDataToRender.width &&
                    imageDataToRender.height
                ) {
                    singleOutputCanvas.width = imageDataToRender.width;
                    singleOutputCanvas.height = imageDataToRender.height;
                    singleOutputCanvas
                        .getContext('2d')
                        .putImageData(imageDataToRender, 0, 0);
                } else {
                    // Clear canvas if no specific image data to render
                    singleOutputCanvas
                        .getContext('2d')
                        .clearRect(
                            0,
                            0,
                            singleOutputCanvas.width,
                            singleOutputCanvas.height
                        );
                }
            }
        } else {
            if (singleOutputCanvas) {
                singleOutputCanvas.classList.add('hidden');
                singleOutputCanvas
                    .getContext('2d')
                    .clearRect(
                        0,
                        0,
                        singleOutputCanvas.width,
                        singleOutputCanvas.height
                    );
            }
            if (batchOutputGrid) {
                batchOutputGrid.classList.add('hidden');
                clearOutputGrid();
            }
        }
    }

    // --- Text Output ---
    const textOutputArea = dom.getTextOutputArea();
    if (textOutputArea) {
        if (outputReady && typeof state.workbench.output.data === 'string') {
            textOutputArea.value = state.workbench.output.data;
        } else {
            textOutputArea.value = '';
        }
    }
}
