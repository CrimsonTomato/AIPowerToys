import {
    state,
    setProcessing,
    setOutputData,
    updateModelStatus,
    setDownloadProgress,
} from '../state.js';
import { renderStatus, renderOutputImage, renderModelsList } from '../ui.js';
import { dom } from '../dom.js';
import {
    checkAllModelsStatus,
    getFileBuffer,
} from '../_controllers/fileSystemController.js';

let inferenceWorker;

// Initializes the Web Worker.
export function initWorker() {
    inferenceWorker = new Worker(
        new URL('../../workers/inference.worker.js', import.meta.url),
        { type: 'module' }
    );

    inferenceWorker.onmessage = e => {
        const { type, data } = e.data;
        if (type === 'result') {
            setOutputData(data);
            setProcessing(false);
            renderOutputImage();
            renderStatus();
        } else if (type === 'status') {
            const statusEl = dom.statusText();
            if (statusEl) statusEl.textContent = `Status: ${data}`;
        }
    };
}

/**
 * A private helper function to gather all necessary file buffers for a given model.
 * @private
 * @param {object} activeModule - The manifest object for the active model.
 * @param {object} selectedVariant - The variant object for the selected model version.
 * @returns {Promise<object>} An object mapping file paths to their ArrayBuffer content.
 */
async function _prepareModelFiles(activeModule, selectedVariant) {
    const modelFiles = {};
    const repoDirName = activeModule.id.split('/')[1];

    // 1. Get the main model file for the selected variant.
    const modelPath = `${repoDirName}/${selectedVariant.filename}`;
    const modelBuffer = await getFileBuffer(modelPath);
    if (!modelBuffer)
        throw new Error(`Could not load model file: ${modelPath}`);
    modelFiles[`/models/${activeModule.id}/${selectedVariant.filename}`] =
        modelBuffer;

    // 2. Get all required config files from the manifest.
    for (const key of activeModule.config_files) {
        const configPath = `${repoDirName}/${key}`;
        const fileBuffer = await getFileBuffer(configPath);
        if (fileBuffer) {
            modelFiles[`/models/${activeModule.id}/${key}`] = fileBuffer;
        } else {
            // This is a significant issue if a declared config file is missing.
            throw new Error(
                `Manifest specified "${key}", but it was not found in the repository.`
            );
        }
    }
    return modelFiles;
}

// Orchestrates running inference.
export async function runInference(imageData) {
    const activeModule = state.modules.find(m => m.id === state.activeModuleId);
    const modelStatus = state.modelStatuses[state.activeModuleId];
    if (
        !imageData ||
        state.isProcessing ||
        !activeModule ||
        modelStatus.status !== 'found'
    )
        return;

    setProcessing(true);
    renderStatus();

    try {
        const selectedVariant = modelStatus.discoveredVariants.find(
            v => v.name === modelStatus.selectedVariant
        );
        if (!selectedVariant) {
            throw new Error(
                `Could not find details for selected variant "${modelStatus.selectedVariant}".`
            );
        }

        // --- THIS IS THE CHANGE ---
        // Delegate file preparation to the helper function.
        const modelFiles = await _prepareModelFiles(
            activeModule,
            selectedVariant
        );

        // Pass the prepared files to the worker.
        inferenceWorker.postMessage({
            type: 'run',
            modelFiles: modelFiles,
            modelId: activeModule.id,
            task: activeModule.task,
            pipelineOptions: selectedVariant.pipeline_options,
            data: imageData,
        });
    } catch (error) {
        alert(`Error preparing for inference: ${error.message}`);
        setProcessing(false);
        renderStatus();
    }
}

// Handles the export functions
export async function copyOutputToClipboard() {
    const canvas = dom.getOutputCanvas();
    if (!canvas) return;
    canvas.toBlob(async blob => {
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
        ]);
        alert('Image copied to clipboard!');
    });
}

export function saveOutputToFile() {
    const canvas = dom.getOutputCanvas();
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'depth-output.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

/**
 * Downloads a model repository from Hugging Face to the user's selected directory.
 * @param {string} moduleId - The ID of the model to download (e.g., 'Xenova/depth-anything-small-hf').
 */
export async function downloadModel(moduleId) {
    if (!state.directoryHandle) {
        alert('Please connect to a models folder first!');
        return;
    }
    const module = state.modules.find(m => m.id === moduleId);
    if (!module) return;

    updateModelStatus(moduleId, { status: 'downloading' });
    renderModelsList();

    try {
        // 1. Get the list of files from the Hugging Face API
        const api_url = `https://huggingface.co/api/models/${moduleId}`;
        const response = await fetch(api_url);
        if (!response.ok)
            throw new Error(
                `Failed to fetch model info from Hugging Face API. Status: ${response.status}`
            );
        const modelInfo = await response.json();
        const filesToDownload = modelInfo.siblings;

        // 2. Get/create the main model directory
        const dirName = moduleId.split('/')[1];
        const moduleDirHandle = await state.directoryHandle.getDirectoryHandle(
            dirName,
            { create: true }
        );

        // 3. Download each file
        let count = 0;
        for (const fileInfo of filesToDownload) {
            const filePath = fileInfo.rfilename; // e.g., "onnx/model.onnx" or "config.json"
            count++;

            setDownloadProgress({
                status: 'downloading',
                progress: count,
                total: filesToDownload.length,
                filename: filePath,
            });
            // You can enhance renderModelsList to show this progress
            console.log(
                `Downloading ${count}/${filesToDownload.length}: ${filePath}`
            );

            // Create subdirectories if they don't exist
            const pathParts = filePath.split('/');
            let currentHandle = moduleDirHandle;
            if (pathParts.length > 1) {
                for (const part of pathParts.slice(0, -1)) {
                    currentHandle = await currentHandle.getDirectoryHandle(
                        part,
                        { create: true }
                    );
                }
            }

            // Get a handle to the file, creating it if it doesn't exist
            const fileHandle = await currentHandle.getFileHandle(
                pathParts[pathParts.length - 1],
                { create: true }
            );

            // Fetch the file content
            const downloadUrl = `https://huggingface.co/${moduleId}/resolve/main/${filePath}`;
            const fileResponse = await fetch(downloadUrl);
            const fileBlob = await fileResponse.blob();

            // Write the content to the file
            const writable = await fileHandle.createWritable();
            await writable.write(fileBlob);
            await writable.close();
        }

        alert(`Model "${module.name}" downloaded successfully!`);
        // 4. Rescan the models to update the status to "Found"
        checkAllModelsStatus();
    } catch (error) {
        console.error('Download failed:', error);
        alert(`Download failed: ${error.message}`);
        updateModelStatus(moduleId, { status: 'missing' }); // Reset status on failure
        renderModelsList();
    }
}
