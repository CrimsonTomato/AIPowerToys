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

    // Filter for image files and sort them numerically by filename
    const imageFiles = Array.from(files)
        .filter(file => file.type.startsWith('image/'))
        .sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true })
        );

    // Create a read promise for each sorted file
    const readPromises = imageFiles.map(file => {
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    });

    const urls = await Promise.all(readPromises);
    setInputImageURLs(urls);
}
