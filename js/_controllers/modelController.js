import {
    state,
    setProcessing,
    setOutputData,
    updateModelStatus,
    setDownloadProgress,
} from '../state.js';
import { renderStatus, renderModelsList } from '../ui.js';
import { dom } from '../dom.js';
import {
    checkAllModelsStatus,
    getFileBuffer,
} from '../_controllers/fileSystemController.js';

let inferenceWorker;

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
            renderStatus(); // This is the only call needed to update the UI
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

    const modelPath = `${repoDirName}/${selectedVariant.filename}`;
    const modelBuffer = await getFileBuffer(modelPath);
    if (!modelBuffer)
        throw new Error(`Could not load model file: ${modelPath}`);
    modelFiles[`/models/${activeModule.id}/${selectedVariant.filename}`] =
        modelBuffer;

    for (const key of activeModule.config_files) {
        const configPath = `${repoDirName}/${key}`;
        const fileBuffer = await getFileBuffer(configPath);
        if (fileBuffer) {
            modelFiles[`/models/${activeModule.id}/${key}`] = fileBuffer;
        } else {
            throw new Error(
                `Manifest specified "${key}", but it was not found in the repository.`
            );
        }
    }
    return modelFiles;
}

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

        const modelFiles = await _prepareModelFiles(
            activeModule,
            selectedVariant
        );

        const baseOptions = selectedVariant.pipeline_options;
        const userConfigs = state.runtimeConfigs[activeModule.id] || {};
        const finalPipelineOptions = { ...baseOptions, ...userConfigs };

        inferenceWorker.postMessage({
            type: 'run',
            modelFiles: modelFiles,
            modelId: activeModule.id,
            task: activeModule.task,
            pipelineOptions: finalPipelineOptions,
            data: imageData,
        });
    } catch (error) {
        console.error('Error preparing for inference:', error);
        dom.statusText().textContent = `Error: ${error.message}`;
        setProcessing(false);
        renderStatus();
    }
}

export async function copyOutputToClipboard() {
    const canvas = dom.getOutputCanvas();
    if (!canvas) return;

    const copyBtn = dom.copyBtn();

    try {
        const blob = await new Promise(resolve =>
            canvas.toBlob(resolve, 'image/png')
        );
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
        ]);
        dom.statusText().textContent = 'Status: Image copied to clipboard!';

        if (copyBtn) {
            copyBtn.classList.add('btn-success-feedback');
            setTimeout(() => {
                copyBtn.classList.remove('btn-success-feedback');
            }, 1500);
        }
    } catch (error) {
        console.error('Failed to copy image:', error);
        let errorMessage = 'Failed to copy image.';
        if (error.name === 'NotAllowedError') {
            errorMessage +=
                ' Clipboard access denied. Ensure HTTPS or localhost.';
        } else {
            errorMessage += ` ${error.message}`;
        }
        dom.statusText().textContent = `Status: ${errorMessage}`;

        if (copyBtn) {
            copyBtn.classList.add('btn-failure-feedback');
            setTimeout(() => {
                copyBtn.classList.remove('btn-failure-feedback');
            }, 1500);
        }
    }
}

export function saveOutputToFile() {
    const canvas = dom.getOutputCanvas();
    if (!canvas) return;

    const filenameInput = dom.outputFilenameInput();
    const filename = filenameInput?.value || 'ai-powertoys-output.png';

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

/**
 * Downloads a model repository from Hugging Face to the user's selected directory.
 * @param {string} moduleId - The ID of the model to download (e.g., 'Xenova/depth-anything-small-hf').
 */
export async function downloadModel(moduleId) {
    if (!state.directoryHandle) {
        dom.statusText().textContent =
            'Status: Please connect to a models folder first!';
        return;
    }
    const module = state.modules.find(m => m.id === moduleId);
    if (!module) return;

    updateModelStatus(moduleId, { status: 'downloading' });

    setDownloadProgress({
        status: 'downloading',
        moduleId: moduleId,
        progress: 0,
        total: 0,
        filename: 'Fetching file list...',
    });

    renderModelsList();

    try {
        const api_url = `https://huggingface.co/api/models/${moduleId}`;
        const response = await fetch(api_url);
        if (!response.ok)
            throw new Error(
                `Failed to fetch model info from Hugging Face API. Status: ${response.status}`
            );
        const modelInfo = await response.json();
        const filesToDownload = modelInfo.siblings;

        const dirName = moduleId.split('/')[1];
        const moduleDirHandle = await state.directoryHandle.getDirectoryHandle(
            dirName,
            { create: true }
        );

        let count = 0;
        for (const fileInfo of filesToDownload) {
            const filePath = fileInfo.rfilename;
            count++;

            setDownloadProgress({
                progress: count,
                total: filesToDownload.length,
                filename: filePath,
            });
            renderModelsList();

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
            const fileHandle = await currentHandle.getFileHandle(
                pathParts[pathParts.length - 1],
                { create: true }
            );

            const downloadUrl = `https://huggingface.co/${moduleId}/resolve/main/${filePath}`;
            const fileResponse = await fetch(downloadUrl);
            const fileBlob = await fileResponse.blob();

            const writable = await fileHandle.createWritable();
            await writable.write(fileBlob);
            await writable.close();
        }

        setDownloadProgress({ status: 'idle', moduleId: null });
        dom.statusText().textContent = `Status: Model "${module.name}" downloaded successfully!`;
        checkAllModelsStatus();
    } catch (error) {
        console.error('Download failed:', error);
        setDownloadProgress({ status: 'idle', moduleId: null });
        dom.statusText().textContent = `Status: Download for "${module.name}" failed. ${error.message}`;
        updateModelStatus(moduleId, { status: 'missing' });
        renderModelsList();
    }
}
