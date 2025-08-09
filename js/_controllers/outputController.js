import JSZip from 'jszip';
import { state } from '../state.js';
import { dom } from '../dom.js';
import { imageDataToCanvas } from '../ui/utils/displayUtils.js';

export async function copyOutputToClipboard() {
    const copyBtn = dom.copyBtn();

    try {
        if (typeof state.workbench.output.data === 'string') {
            await navigator.clipboard.writeText(state.workbench.output.data);
            dom.statusText().textContent = 'Status: Text copied to clipboard!';
        } else {
            // Now, state.workbench.output.data directly holds the ImageData for all image tasks (including SAM cutout)
            const canvas = imageDataToCanvas(state.workbench.output.data);
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

    if (typeof state.workbench.output.data === 'string') {
        const filename = filenameInput?.value || 'transcription.txt';
        const blob = new Blob([state.workbench.output.data], {
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
        filenameInput?.value.replace(/\\.png$/i, '') || 'ai-powertoys-output';

    if (
        Array.isArray(state.workbench.output.data) &&
        state.workbench.output.data.length > 0
    ) {
        const zip = new JSZip();
        let i = 0;
        for (const imageData of state.workbench.output.data) {
            const canvas = imageDataToCanvas(imageData);
            if (!canvas) continue; // Skip invalid/null image data

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
    } else if (state.workbench.output.data) {
        // Now, state.workbench.output.data is directly the ImageData for all single image tasks.
        const canvas = imageDataToCanvas(state.workbench.output.data);
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = `${baseFilename}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }
}
