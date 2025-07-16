import {
    setRuntimeConfig,
    setSelectedVariant,
    setProcessingMode,
} from '../state.js';
import { saveAppState } from '../_controllers/fileSystemController.js';
import { handleSearch } from '../ui/models.js';
import { renderStatus } from '../ui/main_component.js';
import { loadImageFiles, loadAudioFile } from './inputHandlers.js';

function handleRuntimeCheckboxChange(target) {
    if (target.dataset.paramId === 'processing-mode') {
        const mode = target.checked ? 'iterative' : 'batch';
        setProcessingMode(mode);
    } else {
        const moduleId = target.dataset.moduleId;
        const paramId = target.dataset.paramId;
        const value = target.checked;
        setRuntimeConfig(moduleId, paramId, value);
    }
    saveAppState();
}

function handleRuntimeSelectChange(target) {
    const moduleId = target.dataset.moduleId;
    const paramId = target.dataset.paramId;
    let value = target.value;
    if (value === 'true') value = true;
    if (value === 'false') value = false;
    setRuntimeConfig(moduleId, paramId, value);
    saveAppState();
}

function handleRuntimeRangeInput(target) {
    const moduleId = target.dataset.moduleId;
    const paramId = target.dataset.paramId;
    const value = parseFloat(target.value);
    setRuntimeConfig(moduleId, paramId, value);
    const valueDisplay = document.getElementById(`param-val-${paramId}`);
    if (valueDisplay) valueDisplay.textContent = value;
}

export function initChangeListeners() {
    document.body.addEventListener('change', e => {
        const target = e.target;
        if (target.id === 'image-picker') {
            if (target.files.length > 0) loadImageFiles(target.files);
        } else if (target.id === 'audio-picker') {
            if (target.files.length > 0) loadAudioFile(target.files[0]);
        } else if (target.matches('.variant-selector')) {
            const moduleId = target.dataset.moduleId;
            const variantName = target.value;
            setSelectedVariant(moduleId, variantName);
            renderStatus();
            saveAppState();
        } else if (target.matches('.runtime-control input[type="checkbox"]')) {
            handleRuntimeCheckboxChange(target);
        } else if (target.matches('.runtime-control select')) {
            handleRuntimeSelectChange(target);
        } else if (target.matches('.runtime-control input[type="range"]')) {
            saveAppState();
        }
    });

    document.body.addEventListener('input', e => {
        const target = e.target;
        if (target.matches('.runtime-control input[type="range"]')) {
            handleRuntimeRangeInput(target);
        } else if (target.id === 'model-search-input') {
            handleSearch(target.value);
        }
    });
}
