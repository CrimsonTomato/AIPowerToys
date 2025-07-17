import { dom } from '../../dom.js';
import { state, removeInputPoint } from '../../state.js'; // Import removeInputPoint

export function renderInputState() {
    // --- Image Input State ---
    const imageReady = state.inputDataURLs.length > 0;
    const isBatchMode = state.inputDataURLs.length > 1; // Note: SAM task will prevent this
    const dropArea = dom.getImageDropArea();

    if (dropArea) {
        const activeModule = state.modules.find(m => m.id === state.activeModuleId);
        const isSamTask = activeModule?.task === 'image-segmentation-with-prompt';
        const placeholder = dom.getImageInputPlaceholder();
        const inputGrid = dom.imageInputGrid();
        const singlePreview = dom.getImagePreview();
        const pointsContainer = dom.promptPointsContainer();
        const uploadImageBtn = dom.uploadImageBtn();

        // Controls are visible if an image is loaded, OR if it's the SAM task (to show the upload button).
        dropArea.dataset.controlsVisible = String(imageReady || isSamTask);
        dropArea.dataset.hasContent = String(imageReady);

        // Hide upload button for non-SAM image tasks or if image is loaded
        if (uploadImageBtn) {
            uploadImageBtn.classList.toggle('hidden', !isSamTask && imageReady);
        }

        // Show placeholder if no image
        if (placeholder) {
            placeholder.classList.toggle('hidden', imageReady);
        }
        
        if (singlePreview) singlePreview.classList.add('hidden');
        if (inputGrid) inputGrid.classList.add('hidden');

        if (imageReady) {
            // For SAM tasks, we only support single images.
            if (isBatchMode && !isSamTask && inputGrid) {
                // Render batch grid for other image tasks
                inputGrid.classList.remove('hidden');
                inputGrid.innerHTML = '';
                state.inputDataURLs.forEach(url => {
                    const item = document.createElement('div');
                    item.className = 'grid-image-item';
                    item.dataset.imageDataUrl = url;
                    item.innerHTML = `<img src="${url}" alt="Input image"><div class="grid-item-overlay"><span class="material-icons">zoom_in</span></div>`;
                    inputGrid.appendChild(item);
                });
            } else if (singlePreview) {
                singlePreview.classList.remove('hidden');
                singlePreview.src = state.inputDataURLs[0];
            }
        } else {
            if (singlePreview) singlePreview.src = '';
            if (inputGrid) inputGrid.innerHTML = '';
        }

        // Render prompt points if it's a SAM task and an image is loaded
        if (pointsContainer) {
            pointsContainer.classList.toggle('hidden', !isSamTask || !imageReady);
            pointsContainer.innerHTML = '';
            if (isSamTask && imageReady) {
                state.inputPoints.forEach((p, index) => {
                    const pointEl = document.createElement('div');
                    pointEl.className = 'prompt-point';
                    pointEl.classList.add(p.label === 1 ? 'positive' : 'negative');
                    pointEl.style.left = `${p.point[0] * 100}%`;
                    pointEl.style.top = `${p.point[1] * 100}%`;
                    pointEl.dataset.pointIndex = index; // Store index for removal
                    pointEl.title = p.label === 1 ? "Positive point (click to remove)" : "Negative point (click to remove)";
                    pointsContainer.appendChild(pointEl);
                });
            }
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

// Attach event listener for removing points
document.body.addEventListener('click', (e) => {
    const pointEl = e.target.closest('.prompt-point');
    if (pointEl && pointEl.dataset.pointIndex !== undefined) {
        e.stopPropagation(); // Prevent bubbling up to add another point
        const index = parseInt(pointEl.dataset.pointIndex, 10);
        removeInputPoint(index);
    }
});