import { dom } from '../dom.js';
import { state, setComparisonMode } from '../state.js';
import { getContainSize } from '../utils.js';

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
    const workbenchArea = dom.workbenchArea();
    const inputArea = dom.workbenchInputArea();
    if (!workbenchArea || !inputArea) return;

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
            inputArea.innerHTML = inputHtml;
            dom.workbenchOutputArea().innerHTML = outputHtml;
        } else {
            inputArea.innerHTML = '';
            dom.workbenchOutputArea().innerHTML = '';
        }

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
        inputArea.innerHTML = '';
        dom.workbenchOutputArea().innerHTML = '';
    }

    const newOutputArea = dom.outputArea();
    if (newOutputArea) {
        comparisonResizeObserver.observe(newOutputArea);
    }

    setComparisonMode('none');
    await renderComparisonView();
}

function _renderRuntimeControls(activeModule) {
    const container = dom.runtimeControlsContainer();
    if (!container) return;

    const params = activeModule.configurable_params;
    if (!params || !params.length) {
        container.innerHTML = '';
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
        if (param.type === 'slider') {
            return `<div class="runtime-control"><label for="param-${param.id}">${param.name}: <span id="param-val-${param.id}">${currentValue}</span></label><input type="range" id="param-${param.id}" data-param-id="${param.id}" data-module-id="${activeModule.id}" min="${param.min}" max="${param.max}" step="${param.step}" value="${currentValue}"></div>`;
        } else if (param.type === 'checkbox') {
            return `<div class="runtime-control checkbox-control"><label for="param-${
                param.id
            }">${param.name}</label><input type="checkbox" id="param-${
                param.id
            }" data-param-id="${param.id}" data-module-id="${
                activeModule.id
            }" ${currentValue ? 'checked' : ''}></div>`;
        }
        return '';
    };

    let html = `<h4>Runtime Options</h4>`;
    if (hasTwoColumns) {
        html += `<div class="runtime-column">${columns[1]
            .map(renderParam)
            .join('')}</div>`;
        html += `<div class="runtime-column">${columns[2]
            .map(renderParam)
            .join('')}</div>`;
    } else {
        // If not explicitly two columns, render all in a single block
        html += params.map(renderParam).join('');
    }
    container.innerHTML = html;
}

function _drawPlainOutputToCanvas() {
    if (!state.outputData) return;
    const canvas = dom.getOutputCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = state.outputData.width;
    canvas.height = state.outputData.height;
    ctx.putImageData(state.outputData, 0, 0);
}

async function _getLoadedInputImage() {
    const inputPreview = dom.getImagePreview();
    if (!inputPreview || inputPreview.classList.contains('hidden')) return null;

    if (
        !inputImageForCompare ||
        inputImageForCompare.src !== inputPreview.src
    ) {
        inputImageForCompare = new Image();
        inputImageForCompare.src = inputPreview.src;
        await new Promise((resolve, reject) => {
            inputImageForCompare.onload = resolve;
            inputImageForCompare.onerror = reject;
        });
    }
    return inputImageForCompare;
}

export async function renderComparisonView() {
    const outputArea = dom.outputArea();
    const slider = dom.imageCompareSlider();
    const slideBtn = dom.compareSlideBtn();
    const holdBtn = dom.compareHoldBtn();
    if (!outputArea || !slider || !slideBtn || !holdBtn) return;

    outputArea.dataset.compareMode = state.comparisonMode;
    slideBtn.classList.toggle('active', state.comparisonMode === 'slide');
    holdBtn.classList.toggle('active', state.comparisonMode === 'hold');

    const canvas = dom.getOutputCanvas();
    const inputImage = await _getLoadedInputImage();
    const canCompare =
        canvas && canvas.width > 0 && inputImage && state.outputData;

    if (state.comparisonMode === 'slide' && canCompare) {
        const canvasRect = canvas.getBoundingClientRect();
        const outputAreaRect = outputArea.getBoundingClientRect();
        const outputDest = getContainSize(
            canvas.width,
            canvas.height,
            state.outputData.width,
            state.outputData.height
        );
        const scale = canvasRect.width / canvas.width;

        imageBounds = {
            x: canvasRect.left - outputAreaRect.left + outputDest.x * scale,
            y: canvasRect.top - outputAreaRect.top + outputDest.y * scale,
            width: outputDest.width * scale,
            height: outputDest.height * scale,
        };

        slider.style.top = `${imageBounds.y}px`;
        slider.style.height = `${imageBounds.height}px`;
        slider.style.left = `${imageBounds.x + imageBounds.width / 2}px`;
        slider.classList.remove('hidden');
        redrawCompareCanvas(imageBounds.x + imageBounds.width / 2);
    } else {
        slider.classList.add('hidden');
        if (canCompare) {
            _drawPlainOutputToCanvas();
        }
    }
}

export async function showInputOnCanvas() {
    const canvas = dom.getOutputCanvas();
    const ctx = canvas.getContext('2d');
    const inputImage = await _getLoadedInputImage();
    if (!canvas || !inputImage) return;

    const dest = getContainSize(
        canvas.width,
        canvas.height,
        inputImage.width,
        inputImage.height
    );
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(inputImage, dest.x, dest.y, dest.width, dest.height);
}

export async function redrawCompareCanvas(splitX_visual) {
    const canvas = dom.getOutputCanvas();
    const ctx = canvas.getContext('2d');
    const inputImage = await _getLoadedInputImage();
    if (!canvas || !inputImage || !state.outputData) return;

    const canvasRect = canvas.getBoundingClientRect();
    const outputAreaRect = dom.outputArea().getBoundingClientRect();
    const scale = canvas.width / canvasRect.width;
    const visualImageOffsetX = canvasRect.left - outputAreaRect.left;
    const splitX_canvas = (splitX_visual - visualImageOffsetX) * scale;

    const inputDest = getContainSize(
        canvas.width,
        canvas.height,
        inputImage.width,
        inputImage.height
    );
    const outputDest = getContainSize(
        canvas.width,
        canvas.height,
        state.outputData.width,
        state.outputData.height
    );

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = state.outputData.width;
    tempCanvas.height = state.outputData.height;
    tempCanvas.getContext('2d').putImageData(state.outputData, 0, 0);
    ctx.drawImage(
        tempCanvas,
        outputDest.x,
        outputDest.y,
        outputDest.width,
        outputDest.height
    );

    const inputClipX = splitX_canvas - inputDest.x;
    if (inputClipX <= 0) return;

    const sourceClipWidth = (inputClipX / inputDest.width) * inputImage.width;
    ctx.drawImage(
        inputImage,
        0,
        0,
        sourceClipWidth,
        inputImage.height,
        inputDest.x,
        inputDest.y,
        inputClipX,
        inputDest.height
    );
}
