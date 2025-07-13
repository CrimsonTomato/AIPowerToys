import { dom } from '../dom.js';
import {
    runInference,
    copyOutputToClipboard,
    saveOutputToFile,
    downloadModel,
} from '../_controllers/modelController.js';
import { connectToDirectory } from '../_controllers/fileSystemController.js';
import { renderWorkbench, renderModelsList, renderStatus } from '../ui.js';
import { setActiveModuleId, setSelectedVariant } from '../state.js';

// Initializes all event listeners for the workbench.
export function initWorkbenchEvents() {
    document.body.addEventListener('click', e => {
        const target = e.target;
        if (target.id === 'connect-folder-btn') {
            connectToDirectory();
        } else if (target.matches('.select-model-btn')) {
            const moduleId = target.dataset.moduleId;
            setActiveModuleId(moduleId);
            renderModelsList();
            renderWorkbench();
        } else if (target.matches('.download-btn')) {
            const moduleId = target.dataset.moduleId;
            downloadModel(moduleId);
        } else if (target.id === 'run-inference-btn') {
            const imageData = dom.getImagePreview()?.src;
            runInference(imageData);
        } else if (target.id === 'copy-btn') {
            copyOutputToClipboard();
        } else if (target.id === 'save-btn') {
            saveOutputToFile();
        }
    });

    document.body.addEventListener('change', e => {
        const target = e.target;
        if (target.id === 'image-picker') {
            handleImagePick(e);
        } else if (target.matches('.variant-selector')) {
            const moduleId = target.dataset.moduleId;
            const variantName = target.value;
            setSelectedVariant(moduleId, variantName);
        }
    });
}

// Handles file input change.
function handleImagePick(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            const preview = dom.getImagePreview();
            if (preview) {
                preview.src = e.target.result;
                preview.classList.remove('hidden');
                renderStatus(); // Update button state
            }
        };
        reader.readAsDataURL(file);
    }
}
