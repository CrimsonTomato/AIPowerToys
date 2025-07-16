import { dom } from '../dom.js';
import { loadImageFiles, loadAudioFile } from './inputHandlers.js';

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

export function handleImageDropAreaEvents() {
    const dropArea = dom.getImageDropArea();
    if (!dropArea) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(
            eventName,
            () => dropArea.classList.add('drag-over'),
            false
        );
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(
            eventName,
            () => dropArea.classList.remove('drag-over'),
            false
        );
    });
    dropArea.addEventListener(
        'drop',
        e => {
            if (e.dataTransfer?.files.length > 0)
                loadImageFiles(e.dataTransfer.files);
        },
        false
    );
}

export function handleAudioDropAreaEvents() {
    const dropArea = dom.getAudioDropArea();
    if (!dropArea) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(
            eventName,
            () => dropArea.classList.add('drag-over'),
            false
        );
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(
            eventName,
            () => dropArea.classList.remove('drag-over'),
            false
        );
    });
    dropArea.addEventListener(
        'drop',
        e => {
            if (e.dataTransfer?.files.length > 0)
                loadAudioFile(e.dataTransfer.files[0]);
        },
        false
    );
}
