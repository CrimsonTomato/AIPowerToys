import { dom } from '../../dom.js';
import { state } from '../../state.js';
import { eventBus } from '../../_events/eventBus.js';

let uiCache = {};

function cacheDOMElements() {
    uiCache = {
        audioDropArea: dom.getAudioDropArea(),
        label: document.getElementById('audio-input-label'),
        loadedView: dom.getAudioLoadedView(),
        player: dom.getAudioPreviewPlayer(),
        filenameDisplay: dom.getAudioFilenameDisplay(),
        clearInputBtn: dom
            .getAudioDropArea()
            ?.querySelector('#clear-input-btn'),
    };
}

function render() {
    const {
        audioDropArea,
        label,
        loadedView,
        player,
        filenameDisplay,
        clearInputBtn,
    } = uiCache;

    if (!audioDropArea) return;

    const audioReady = state.workbench.input.audioURL !== null;

    audioDropArea.dataset.controlsVisible = String(audioReady);
    audioDropArea.dataset.hasContent = String(audioReady);

    if (label) label.classList.toggle('hidden', audioReady);
    if (loadedView) loadedView.classList.toggle('hidden', !audioReady);
    if (clearInputBtn) clearInputBtn.disabled = !audioReady;

    if (audioReady) {
        if (player) player.src = state.workbench.input.audioURL.url;
        if (filenameDisplay)
            filenameDisplay.textContent =
                state.workbench.input.audioURL.filename;
    }
}

export function initAudioInput() {
    cacheDOMElements();
    eventBus.on('inputDataChanged', render);
    render();
}
