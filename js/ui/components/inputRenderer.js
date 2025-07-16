import { dom } from '../../dom.js';
import { state } from '../../state.js';

export function renderInputState() {
    // --- Image Input State ---
    const imageReady = state.inputDataURLs.length > 0;
    const isBatchMode = state.inputDataURLs.length > 1;
    const dropArea = dom.getImageDropArea();
    if (dropArea) {
        const placeholder = dom.getImageInputPlaceholder();
        const inputGrid = dom.imageInputGrid();
        const singlePreview = dom.getImagePreview();

        dropArea.dataset.controlsVisible = String(imageReady);
        dropArea.dataset.hasContent = String(imageReady);

        placeholder.classList.toggle('hidden', imageReady);
        singlePreview.classList.add('hidden');
        inputGrid.classList.add('hidden');

        if (imageReady) {
            if (isBatchMode) {
                inputGrid.classList.remove('hidden');
                inputGrid.innerHTML = '';
                state.inputDataURLs.forEach(url => {
                    const item = document.createElement('div');
                    item.className = 'grid-image-item';
                    item.dataset.imageDataUrl = url;
                    item.innerHTML = `<img src="${url}" alt="Input image"><div class="grid-item-overlay"><span class="material-icons">zoom_in</span></div>`;
                    inputGrid.appendChild(item);
                });
            } else {
                singlePreview.classList.remove('hidden');
                singlePreview.src = state.inputDataURLs[0];
            }
        } else {
            singlePreview.src = '';
            inputGrid.innerHTML = '';
        }
    }

    // --- Audio Input State ---
    const audioReady = state.inputAudioURL !== null;
    const audioDropArea = dom.getAudioDropArea();
    if (audioDropArea) {
        const label = document.getElementById('audio-input-label');
        const loadedView = dom.getAudioLoadedView();

        audioDropArea.dataset.controlsVisible = String(audioReady);
        audioDropArea.dataset.hasContent = String(audioReady);

        label.classList.toggle('hidden', audioReady);
        loadedView.classList.toggle('hidden', !audioReady);

        if (audioReady) {
            const player = dom.getAudioPreviewPlayer();
            const filenameDisplay = dom.getAudioFilenameDisplay();
            player.src = state.inputAudioURL.url;
            filenameDisplay.textContent = state.inputAudioURL.filename;
        }
    }
}
