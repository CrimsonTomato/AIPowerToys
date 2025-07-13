// This file is specific to the 'depth-estimation' task.
// It provides the functions needed to render the UI for this module.

/**
 * Renders the input area for image-based tasks.
 * @param {HTMLElement} container - The element to render into.
 */
export function renderInput(container) {
    container.innerHTML = `
      <div class="input-area">
        <label for="image-picker">Choose an image:</label>
        <input type="file" id="image-picker" accept="image/*" />
        <div class="image-preview-container">
          <img id="image-preview" src="" alt="Image preview" class="hidden" />
        </div>
      </div>
    `;
}

/**
 * Renders the output area for this task.
 * @param {HTMLElement} container - The element to render into.
 */
export function renderOutput(container) {
    container.innerHTML = `
      <div class="output-area">
        <p>Output:</p>
        <canvas id="output-canvas"></canvas>
      </div>
    `;
}

/**
 * Gathers the input data from the UI.
 * @returns {string|null} The data URL of the selected image.
 */
export function getInputData() {
    const preview = document.getElementById('image-preview');
    return preview.src && !preview.classList.contains('hidden')
        ? preview.src
        : null;
}
