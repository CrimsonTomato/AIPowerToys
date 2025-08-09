import { dom } from '../../dom.js';
import {
    state,
    setComparisonMode,
    setRenderingWorkbench,
} from '../../state.js';
import {
    handleImageDropAreaEvents,
    handleAudioDropAreaEvents,
} from '../../_events/workbenchEvents.js';
import { initImageInput } from '../components/ImageInput.js';
import { initAudioInput } from '../components/AudioInput.js';
import { initImageOutput } from '../components/ImageOutput.js';
import { initTextOutput } from '../components/TextOutput.js';
import { initRunControls } from '../components/RunControls.js';
import { eventBus } from '../../_events/eventBus.js';

async function render() {
    setRenderingWorkbench(true);

    const workbenchArea = dom.workbenchArea();
    const inputContainer = dom.workbenchInputArea();
    const outputContainer = dom.workbenchOutputArea();
    if (!workbenchArea || !inputContainer || !outputContainer) {
        setRenderingWorkbench(false);
        return;
    }

    const activeModule = state.models.modules.find(
        m => m.id === state.models.activeModuleId
    );
    const outputOptionsContainer = dom.outputOptionsContainer();
    const filenameInput = dom.outputFilenameInput();

    if (activeModule) {
        workbenchArea.classList.remove('hidden');
        const components = activeModule.ui_components;
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

        // Initialize the specific input/output components after loading their HTML
        if (components.workbench_input?.includes('image')) initImageInput();
        if (components.workbench_input?.includes('audio')) initAudioInput();
        if (components.workbench_output?.includes('image')) initImageOutput();
        if (components.workbench_output?.includes('text')) initTextOutput();

        // Also re-initialize event handlers for drag/drop on the new elements
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

    setComparisonMode('none');
    setRenderingWorkbench(false);

    // --- REMOVED: This line caused the infinite recursion ---
    // eventBus.emit('activeModuleChanged', activeModule?.id);
}

function _renderRuntimeControls(activeModule) {
    const container = dom.runtimeControlsContainer();
    if (!container) return;

    // --- ADDED: Guard clause to prevent crash on startup ---
    if (!activeModule) {
        container.innerHTML = '<h4>Runtime Options</h4>';
        container.classList.remove('has-two-columns');
        return;
    }

    const isIterative = state.workbench.processingMode === 'iterative';
    const isSamTask = activeModule?.task === 'image-segmentation-with-prompt';

    // Add a global control for iterative processing, but not for SAM or audio tasks.
    let globalControlsHtml = '';
    if (!isSamTask && activeModule.task !== 'automatic-speech-recognition') {
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
    params.forEach(p => (p.column === 2 ? columns[2] : columns[1]).push(p));

    const renderParam = param => {
        const currentConfigs =
            state.workbench.runtimeConfigs[activeModule.id] || {};
        const currentValue = currentConfigs[param.id] ?? param.default;
        const baseAttributes = `id="param-${param.id}" data-param-id="${param.id}" data-module-id="${activeModule.id}"`;

        switch (param.type) {
            case 'slider':
                return `<div class="runtime-control"><label for="param-${param.id}">${param.name}: <span id="param-val-${param.id}">${currentValue}</span></label><input type="range" ${baseAttributes} min="${param.min}" max="${param.max}" step="${param.step}" value="${currentValue}"></div>`;
            case 'checkbox':
                const isChecked =
                    currentValue === 'true' || currentValue === true;
                return `<div class="runtime-control checkbox-control"><label for="param-${
                    param.id
                }">${
                    param.name
                }</label><input type="checkbox" ${baseAttributes} ${
                    isChecked ? 'checked' : ''
                }></div>`;
            case 'select':
                const optionsHtml = param.options
                    .map(
                        opt =>
                            `<option value="${opt.value}" ${
                                String(currentValue) === String(opt.value)
                                    ? 'selected'
                                    : ''
                            }>${opt.label}</option>`
                    )
                    .join('');
                return `<div class="runtime-control"><label for="param-${param.id}">${param.name}</label><select class="select-input" ${baseAttributes}>${optionsHtml}</select></div>`;
            default:
                return '';
        }
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

export function initWorkbenchView() {
    eventBus.on('activeModuleChanged', render);
    eventBus.on('processingModeChanged', () =>
        _renderRuntimeControls(
            state.models.modules.find(m => m.id === state.models.activeModuleId)
        )
    );

    initRunControls();

    render();
}
