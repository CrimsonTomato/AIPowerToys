import { dom } from '../dom.js';
import { state, setComparisonMode, setRenderingWorkbench } from '../state.js';
import { getContainSize } from '../utils.js';
import {
    handleImageDropAreaEvents,
    handleAudioDropAreaEvents,
} from '../_events/workbenchEvents.js';
import { cacheDOMElements, renderStatus } from './main_component.js';
import { eventBus } from '../_events/eventBus.js';

let inputImageForCompare = null;
let imageBounds = { x: 0, y: 0, width: 0, height: 0 };

export function getImageBounds() {
    return imageBounds;
}

const comparisonResizeObserver = new ResizeObserver(() => {
    if (state.comparisonMode === 'slide') {
        renderComparisonView();
    }
});

export async function renderWorkbench() {
    setRenderingWorkbench(true);

    const workbenchArea = dom.workbenchArea();
    const inputContainer = dom.workbenchInputArea();
    const outputContainer = dom.workbenchOutputArea();
    if (!workbenchArea || !inputContainer || !outputContainer) {
        setRenderingWorkbench(false);
        return;
    }

    const oldOutputArea = dom.outputArea();
    if (oldOutputArea) {
        comparisonResizeObserver.unobserve(oldOutputArea);
    }

    const activeModule = state.modules.find(m => m.id === state.activeModuleId);
    const outputOptionsContainer = dom.outputOptionsContainer();
    const filenameInput = dom.outputFilenameInput();

    if (activeModule) {
        workbenchArea.classList.remove('hidden');
        const components = activeModule.ui_components;
        if (components) {
            const [inputHtml, outputHtml] = await Promise.all([
                components.workbench_input
                    ? fetch(components.workbench_input).then(res => res.text())
                    : Promise.resolve(''),
                components.workbench_output
                    ? fetch(components.workbench_output).then(res => res.text())
                    : Promise.resolve(''),
            ]);
            inputContainer.innerHTML = inputHtml;
            outputContainer.innerHTML = outputHtml;
        } else {
            inputContainer.innerHTML = '';
            outputContainer.innerHTML = '';
        }

        handleImageDropAreaEvents();
        handleAudioDropAreaEvents();

        _renderRuntimeControls(activeModule);

        if (
            activeModule.default_filename &&
            outputOptionsContainer &&
            filenameInput
        ) {
            outputOptionsContainer.classList.remove('hidden');
            filenameInput.value = activeModule.default_filename;
        } else if (outputOptionsContainer) {
            outputOptionsContainer.classList.add('hidden');
        }
    } else {
        workbenchArea.classList.add('hidden');
        if (outputOptionsContainer)
            outputOptionsContainer.classList.add('hidden');
        inputContainer.innerHTML = '';
        outputContainer.innerHTML = '';
    }

    cacheDOMElements();

    const newOutputArea = dom.outputArea();
    if (newOutputArea) {
        comparisonResizeObserver.observe(newOutputArea);
    }

    setComparisonMode('none'); // Reset comparison mode when workbench changes
    await renderComparisonView(); // Re-render comparison view as necessary

    setRenderingWorkbench(false);
    renderStatus();
}

function _renderRuntimeControls(activeModule) {
    const container = dom.runtimeControlsContainer();
    if (!container) return;

    const isIterative = state.processingMode === 'iterative';
    const isSamTask = activeModule?.task === 'image-segmentation-with-prompt';

    // Global Processing Mode Control (only if not SAM task)
    let globalControlsHtml = '';
    if (!isSamTask) {
        globalControlsHtml = `
            <div class="runtime-control checkbox-control">
                <label for="param-processing-mode">Iterative Processing (One-by-one)</label>
                <input type="checkbox" id="param-processing-mode" data-param-id="processing-mode" ${
                    isIterative ? 'checked' : ''
                }>
            </div>
            <hr class="sidebar-section-divider">
        `;
    }

    const params = activeModule.configurable_params;
    if (!params || !params.length) {
        container.innerHTML = `<h4>Runtime Options</h4>${globalControlsHtml}`;
        container.classList.remove('has-two-columns');
        return;
    }

    const hasTwoColumns = params.some(p => p.column === 2);
    container.classList.toggle('has-two-columns', hasTwoColumns);

    const columns = { 1: [], 2: [] };
    params.forEach(p => {
        const col = p.column === 2 ? 2 : 1;
        columns[col].push(p);
    });

    const renderParam = param => {
        const currentConfigs = state.runtimeConfigs[activeModule.id] || {};
        const currentValue = currentConfigs[param.id] ?? param.default;

        const baseAttributes = `id="param-${param.id}" data-param-id="${param.id}" data-module-id="${activeModule.id}"`;

        let controlHtml = '';

        if (param.type === 'slider') {
            controlHtml = `<input type="range" ${baseAttributes} min="${param.min}" max="${param.max}" step="${param.step}" value="${currentValue}">`;
            return `<div class="runtime-control"><label for="param-${param.id}">${param.name}: <span id="param-val-${param.id}">${currentValue}</span></label>${controlHtml}</div>`;
        }

        if (param.type === 'checkbox') {
            const valueAsBoolean =
                currentValue === 'true' || currentValue === true;
            controlHtml = `<input type="checkbox" ${baseAttributes} ${
                valueAsBoolean ? 'checked' : ''
            }>`;
            return `<div class="runtime-control checkbox-control"><label for="param-${param.id}">${param.name}</label>${controlHtml}</div>`;
        }

        if (param.type === 'select') {
            const valueAsString = String(currentValue);
            const optionsHtml = param.options
                .map(
                    opt =>
                        `<option value="${opt.value}" ${
                            valueAsString === String(opt.value)
                                ? 'selected'
                                : ''
                        }>${opt.label}</option>`
                )
                .join('');
            controlHtml = `<select class="select-input" ${baseAttributes}>${optionsHtml}</select>`;
            return `<div class="runtime-control"><label for="param-${param.id}">${param.name}</label>${controlHtml}</div>`;
        }

        return '';
    };

    let html = `<h4>Runtime Options</h4>${globalControlsHtml}`;
    if (hasTwoColumns) {
        html += `<div class="runtime-column">${columns[1]
            .map(renderParam)
            .join('')}</div>`;
        html += `<div class="runtime-column">${columns[2]
            .map(renderParam)
            .join('')}</div>`;
    } else {
        html += params.map(renderParam).join('');
    }
    container.innerHTML = html;
}

async function _getLoadedInputImage() {
    const inputDataURLs = state.inputDataURLs;
    if (inputDataURLs.length === 0) return null;

    const previewSrc = inputDataURLs[0];

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

export async function renderComparisonView() {
    const outputArea = dom.outputArea();
    if (!outputArea) return;

    const slider = dom.imageCompareSlider();
    const slideBtn = dom.compareSlideBtn();
    const holdBtn = dom.compareHoldBtn();
    if (!slider || !slideBtn || !holdBtn) return;

    outputArea.dataset.compareMode = state.comparisonMode;

    const isBatchMode = Array.isArray(state.outputData);
    if (isBatchMode) {
        setComparisonMode('none'); // Cannot compare batches
    }

    slideBtn.classList.toggle('active', state.comparisonMode === 'slide');
    holdBtn.classList.toggle('active', state.comparisonMode === 'hold');

    const canvas = dom.getOutputCanvas();
    const inputImage = await _getLoadedInputImage();
    const canCompare =
        !isBatchMode &&
        canvas &&
        canvas.width > 0 && // Ensure canvas has dimensions (logical)
        inputImage &&
        state.outputData;

    // Show/hide comparison buttons based on `canCompare`
    if (slideBtn) slideBtn.classList.toggle('hidden', !canCompare);
    if (holdBtn) holdBtn.classList.toggle('hidden', !canCompare);

    if (state.comparisonMode === 'slide' && canCompare) {
        const canvasRect = canvas.getBoundingClientRect(); // Visual dimensions of the canvas DOM element
        const outputAreaRect = outputArea.getBoundingClientRect(); // Visual dimensions of the parent output-area

        // Calculate the actual visual area where the image is drawn *within* the canvas element,
        // respecting object-fit: contain. This is essential for accurate slider positioning.
        const visualImageRenderedRect = getContainSize(
            canvasRect.width, // Visual width of the canvas DOM element
            canvasRect.height, // Visual height of the canvas DOM element
            inputImage.width, // Native width of the input image
            inputImage.height // Native height of the input image
        );

        imageBounds = {
            // Visual X position of the rendered image relative to the outputArea
            x:
                canvasRect.left -
                outputAreaRect.left +
                visualImageRenderedRect.x,
            // Visual Y position of the rendered image relative to the outputArea
            y: canvasRect.top - outputAreaRect.top + visualImageRenderedRect.y,
            width: visualImageRenderedRect.width,
            height: visualImageRenderedRect.height,
        };

        slider.style.top = `${imageBounds.y}px`;
        slider.style.height = `${imageBounds.height}px`;
        slider.style.left = `${imageBounds.x + imageBounds.width / 2}px`; // Initial slider position at center
        slider.classList.remove('hidden');

        // Pass the initial slider position (center of the visual image bounds) to redraw
        redrawCompareCanvas(imageBounds.x + imageBounds.width / 2);

        canvas.classList.remove('dimmed'); // Ensure no dimming for comparison
    } else {
        slider.classList.add('hidden');
        const canvas = dom.getOutputCanvas();
        if (canvas) {
            canvas.classList.remove('dimmed'); // Remove dimming if comparison not active
        }
        // When comparison is off, re-render the output based on its standard mode.
        // state.outputData holds the ImageData for the output.
        if (
            state.outputData &&
            !Array.isArray(state.outputData) &&
            state.outputData.width
        ) {
            const ctx = canvas.getContext('2d');
            canvas.width = state.outputData.width;
            canvas.height = state.outputData.height;
            ctx.putImageData(state.outputData, 0, 0);
        }
    }
}

export async function showInputOnCanvas() {
    const canvas = dom.getOutputCanvas();
    const ctx = canvas.getContext('2d');
    const inputImage = await _getLoadedInputImage();
    if (!canvas || !inputImage) return;

    canvas.classList.remove('dimmed'); // Ensure no dimming for this view

    // Set canvas logical dimensions to match input image
    canvas.width = inputImage.width;
    canvas.height = inputImage.height;

    // Drawing the input image to fill the logical canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(inputImage, 0, 0, canvas.width, canvas.height);
}

export async function redrawCompareCanvas(splitX_visual) {
    // splitX_visual is mouseX relative to outputAreaRect.left
    const canvas = dom.getOutputCanvas();
    const ctx = canvas.getContext('2d');
    const inputImage = await _getLoadedInputImage();
    const outputImageData = state.outputData;

    if (!canvas || !inputImage || !outputImageData || !outputImageData.width)
        return;

    // Set canvas dimensions to match the input image's native resolution.
    // This is crucial for drawing and ensures pixel-perfect source data.
    canvas.width = inputImage.width;
    canvas.height = inputImage.height;

    // Retrieve the pre-calculated imageBounds (which represents the visual size/position of the *rendered image* within the outputArea)
    const currentImageBounds = getImageBounds();

    // Calculate the mouse X position relative to the *visual left edge of the rendered image*
    const visualXRelativeToImageDrawArea = splitX_visual - currentImageBounds.x;

    // Convert this visual X position to a logical X position *within the canvas's pixel grid*.
    // The image is drawn internally on the canvas to fill its logical dimensions (canvas.width, canvas.height).
    // So we scale visual position (within currentImageBounds.width) to logical position (within canvas.width).
    const splitX_logical =
        (visualXRelativeToImageDrawArea / currentImageBounds.width) *
        canvas.width;

    // Clamp the split position to the image's logical bounds (0 to canvas.width)
    const clamped_splitX_logical = Math.max(
        0,
        Math.min(splitX_logical, canvas.width)
    );

    // Clear the entire canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw the input image (left side of slider)
    ctx.save();
    ctx.beginPath();
    ctx.rect(
        0, // Start from logical 0
        0, // Start from logical 0
        clamped_splitX_logical, // Width of the clipped input part
        canvas.height // Full height of the canvas
    );
    ctx.clip();
    ctx.drawImage(
        inputImage,
        0, // Draw from logical 0
        0, // Draw from logical 0
        canvas.width, // Draw full width of input image
        canvas.height // Draw full height of input image
    );
    ctx.restore();

    // 2. Draw the output image (right side of slider)
    ctx.save();
    ctx.beginPath();
    ctx.rect(
        clamped_splitX_logical, // Start from slider position
        0, // Start from logical 0
        canvas.width - clamped_splitX_logical, // Width of the clipped output part
        canvas.height // Full height of the canvas
    );
    ctx.clip();

    // Create a temporary canvas for the output image data
    const tempOutputCanvas = document.createElement('canvas');
    tempOutputCanvas.width = outputImageData.width;
    tempOutputCanvas.height = outputImageData.height;
    tempOutputCanvas.getContext('2d').putImageData(outputImageData, 0, 0);

    // Draw the entire output image. Clipping will limit what's seen.
    // Ensure output image is drawn to fill the same logical area as input
    ctx.drawImage(
        tempOutputCanvas,
        0, // Draw from logical 0
        0, // Draw from logical 0
        canvas.width, // Draw full width of output (scaled to input width)
        canvas.height // Draw full height of output (scaled to input height)
    );
    ctx.restore();
}

export function initWorkbenchSubscriptions() {
    // Re-render workbench fully when active module changes
    eventBus.on('activeModuleChanged', renderWorkbench);
    eventBus.on('processingModeChanged', renderWorkbench); // Re-render controls too

    // Re-render comparison view when mode or output data changes
    eventBus.on('comparisonModeChanged', renderComparisonView);
    eventBus.on('outputDataChanged', renderComparisonView);

    renderWorkbench();
}
