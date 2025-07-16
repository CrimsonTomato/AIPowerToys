import JSZip from 'jszip';
import { state } from '../state.js';
import { dom } from '../dom.js';

/**
 * Helper to convert an ImageData object to a temporary canvas.
 * @param {ImageData} imageData The ImageData to convert.
 * @returns {HTMLCanvasElement} A canvas with the image data drawn on it.
 */
function _imageDataToCanvas(imageData) {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

export async function copyOutputToClipboard() {
    const copyBtn = dom.copyBtn();

    try {
        if (typeof state.outputData === 'string') {
            await navigator.clipboard.writeText(state.outputData);
            dom.statusText().textContent = 'Status: Text copied to clipboard!';
        } else {
            let canvas = dom.getOutputCanvas();
            if (Array.isArray(state.outputData)) {
                canvas =
                    state.outputData.length > 0 && state.outputData[0]
                        ? _imageDataToCanvas(state.outputData[0])
                        : null;
            } else if (state.outputData) {
                canvas = _imageDataToCanvas(state.outputData);
            } else {
                canvas = null;
            }
            if (!canvas) return;

            const blob = await new Promise(resolve =>
                canvas.toBlob(resolve, 'image/png')
            );
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob }),
            ]);
            dom.statusText().textContent = 'Status: Image copied to clipboard!';
        }

        if (copyBtn) {
            copyBtn.classList.add('btn-success-feedback');
            setTimeout(() => {
                copyBtn.classList.remove('btn-success-feedback');
            }, 1500);
        }
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        dom.statusText().textContent = `Status: Failed to copy. ${error.message}`;
        if (copyBtn) {
            copyBtn.classList.add('btn-failure-feedback');
            setTimeout(() => {
                copyBtn.classList.remove('btn-failure-feedback');
            }, 1500);
        }
    }
}

export async function saveOutputToFile() {
    const filenameInput = dom.outputFilenameInput();

    if (typeof state.outputData === 'string') {
        const filename = filenameInput?.value || 'transcription.txt';
        const blob = new Blob([state.outputData], {
            type: 'text/plain;charset=utf-8',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        return;
    }

    const baseFilename =
        filenameInput?.value.replace(/\.png$/i, '') || 'ai-powertoys-output';

    if (Array.isArray(state.outputData) && state.outputData.length > 0) {
        const zip = new JSZip();
        let i = 0;
        for (const imageData of state.outputData) {
            if (!imageData) continue;
            const canvas = _imageDataToCanvas(imageData);
            const blob = await new Promise(resolve =>
                canvas.toBlob(resolve, 'image/png')
            );
            const filename = `${baseFilename}-${i + 1}.png`;
            zip.file(filename, blob);
            i++;
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.download = `${baseFilename}.zip`;
        link.href = URL.createObjectURL(zipBlob);
        link.click();
        URL.revokeObjectURL(link.href);
    } else if (state.outputData) {
        const canvas = _imageDataToCanvas(state.outputData);
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = `${baseFilename}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }
}
