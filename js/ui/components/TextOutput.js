import { dom } from '../../dom.js';
import { state } from '../../state.js';
import { eventBus } from '../../_events/eventBus.js';

let uiCache = {};

function cacheDOMElements() {
    uiCache = {
        textOutputArea: dom.getTextOutputArea(),
        copyBtn: dom
            .getTextOutputArea()
            ?.parentElement.querySelector('#copy-btn'),
        saveBtn: dom
            .getTextOutputArea()
            ?.parentElement.querySelector('#save-btn'),
    };
}

function render() {
    const { textOutputArea, copyBtn, saveBtn } = uiCache;
    if (!textOutputArea) return;

    const outputData = state.workbench.output.data;
    const outputReady = outputData !== null && typeof outputData === 'string';

    textOutputArea.value = outputReady ? outputData : '';
    if (copyBtn) copyBtn.disabled = !outputReady;
    if (saveBtn) saveBtn.disabled = !outputReady;
}

export function initTextOutput() {
    cacheDOMElements();
    eventBus.on('outputDataChanged', render);
    render();
}
