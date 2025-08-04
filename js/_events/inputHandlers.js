import {
    clearInputImageURLs,
    clearInputAudioURL,
    setInputImageURLs,
    setInputAudioURL,
} from '../state.js';

export function clearInputs() {
    clearInputImageURLs();
    clearInputAudioURL();
}

export async function loadAudioFile(file) {
    if (!file || !file.type.startsWith('audio/')) return;
    clearInputs();
    const url = URL.createObjectURL(file);
    setInputAudioURL(url, file.name);
}

export async function loadImageFiles(files) {
    if (!files || files.length === 0) return;
    clearInputs();
    let urls = [];
    const readPromises = Array.from(files).map(file => {
        if (!file.type.startsWith('image/')) return Promise.resolve(null);
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    });
    urls = (await Promise.all(readPromises)).filter(Boolean);
    setInputImageURLs(urls);
}
