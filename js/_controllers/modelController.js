import JSZip from 'jszip';
import {
    state,
    setProcessing,
    setOutputData,
    updateModelStatus,
    setDownloadProgress,
    setInferenceStartTime,
    setInferenceDuration,
} from '../state.js';
import { dom } from '../dom.js';
import {
    checkAllModelsStatus,
    getFileBuffer,
} from '../_controllers/fileSystemController.js';
import { renderStatus } from '../ui/main.js';
import { renderModelsList } from '../ui/models.js';

let inferenceWorker;
let resolveSingleInferencePromise = null;

export function initWorker() {
    inferenceWorker = new Worker(
        new URL('../../workers/inference.worker.js', import.meta.url),
        { type: 'module' }
    );

    inferenceWorker.onmessage = e => {
        const { type, data } = e.data;
        if (type === 'result') {
            if (resolveSingleInferencePromise) {
                resolveSingleInferencePromise(data);
                resolveSingleInferencePromise = null;
            } else {
                const duration = Date.now() - state.inferenceStartTime;
                setInferenceDuration(duration);
                setOutputData(data);
                setProcessing(false);
                renderStatus();
            }
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

export async function runInference() {
    const activeModule = state.modules.find(m => m.id === state.activeModuleId);
    const modelStatus = state.modelStatuses[state.activeModuleId];
    if (
        state.inputDataURLs.length === 0 ||
        state.isProcessing ||
        !activeModule ||
        modelStatus.status !== 'found'
    )
        return;

    setProcessing(true);
    setInferenceStartTime(Date.now());
    setInferenceDuration(null);
    setOutputData(null);
    renderStatus();

    try {
        if (
            state.processingMode === 'iterative' &&
            state.inputDataURLs.length > 1
        ) {
            await _runIterativeInference(activeModule, modelStatus);
        } else {
            await _runBatchInference(activeModule, modelStatus);
        }
    } catch (error) {
        console.error('Error during inference:', error);
        dom.statusText().textContent = `Error: ${error.message}`;
        setProcessing(false);
        setInferenceStartTime(null);
        renderStatus();
    }
}

function _executeSingleInference(url, activeModule, modelStatus) {
    return new Promise(async (resolve, reject) => {
        try {
            resolveSingleInferencePromise = resolve;

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
            const device = state.useGpu ? 'webgpu' : 'wasm';
            const finalPipelineOptions = {
                ...baseOptions,
                ...userConfigs,
                device: device,
            };
            const onnxModelPath = selectedVariant.filename;

            inferenceWorker.postMessage({
                type: 'run',
                modelFiles: modelFiles,
                modelId: activeModule.id,
                onnxModelPath: onnxModelPath,
                task: activeModule.task,
                pipelineOptions: finalPipelineOptions,
                data: url,
            });
        } catch (error) {
            reject(error);
        }
    });
}

async function _runIterativeInference(activeModule, modelStatus) {
    const allResults = [];
    const total = state.inputDataURLs.length;
    let i = 1;

    for (const url of state.inputDataURLs) {
        dom.statusText().textContent = `Status: Processing image ${i} of ${total}...`;
        const result = await _executeSingleInference(
            url,
            activeModule,
            modelStatus
        );
        if (result) {
            allResults.push(result);
        }
        i++;
    }

    const duration = Date.now() - state.inferenceStartTime;
    setInferenceDuration(duration);
    setOutputData(allResults);
    setProcessing(false);
    renderStatus();
}

async function _runBatchInference(activeModule, modelStatus) {
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
        const device = state.useGpu ? 'webgpu' : 'wasm';
        const finalPipelineOptions = {
            ...baseOptions,
            ...userConfigs,
            device: device,
        };

        const onnxModelPath = selectedVariant.filename;
        const dataToProcess =
            state.inputDataURLs.length === 1
                ? state.inputDataURLs[0]
                : state.inputDataURLs;

        inferenceWorker.postMessage({
            type: 'run',
            modelFiles: modelFiles,
            modelId: activeModule.id,
            onnxModelPath: onnxModelPath,
            task: activeModule.task,
            pipelineOptions: finalPipelineOptions,
            data: dataToProcess,
        });
    } catch (error) {
        throw error;
    }
}

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
    let canvas = dom.getOutputCanvas();
    if (Array.isArray(state.outputData)) {
        if (state.outputData.length > 0 && state.outputData[0]) {
            canvas = _imageDataToCanvas(state.outputData[0]);
        } else {
            canvas = null;
        }
    } else if (state.outputData) {
        canvas = _imageDataToCanvas(state.outputData);
    } else {
        canvas = null;
    }

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

export async function saveOutputToFile() {
    const filenameInput = dom.outputFilenameInput();
    const baseFilename =
        filenameInput?.value.replace(/\.png$/i, '') || 'ai-powertoys-output';

    if (Array.isArray(state.outputData) && state.outputData.length > 0) {
        // The check for JSZip is no longer needed as an import will fail loudly if it's not installed.
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

/**
 * Downloads a model repository from Hugging Face, but only includes .onnx and .json files.
 * @param {string} moduleId - The ID of the model to download.
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

        const filesToDownload = modelInfo.siblings.filter(fileInfo => {
            const filename = fileInfo.rfilename.toLowerCase();
            return filename.endsWith('.onnx') || filename.endsWith('.json');
        });

        if (filesToDownload.length === 0) {
            throw new Error(
                'No .onnx or .json files found in the model repository.'
            );
        }

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
