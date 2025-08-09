import {
    state,
    setProcessing,
    setOutputData,
    setInferenceStartTime,
    setInferenceDuration,
    // Removed: setRuntimeConfig, // No longer need to store rawMaskOnly
} from '../state.js';
import { dom } from '../dom.js';
import { prepareModelFiles } from './modelFileManager.js';

let inferenceWorker;
let resolveSingleInferencePromise = null;
let audioContext = null;

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
                const duration =
                    Date.now() - state.workbench.inferenceStartTime;
                setInferenceDuration(duration);
                setOutputData(data);
                setProcessing(false);
            }
        } else if (type === 'error') {
            dom.statusText().textContent = `Status: ${data}`;
            const duration = state.workbench.inferenceStartTime
                ? Date.now() - state.workbench.inferenceStartTime
                : null;
            setInferenceDuration(duration);
            setProcessing(false);
            if (resolveSingleInferencePromise) {
                resolveSingleInferencePromise(null); // Resolve with null on error to prevent hanging
                resolveSingleInferencePromise = null;
            }
        } else if (type === 'status') {
            // This is a direct status update from the worker and is fine to leave here,
            // as it doesn't rely on the main app's state object.
            const statusEl = dom.statusText();
            if (statusEl) statusEl.textContent = `Status: ${data}`;
        }
    };
}

export async function runInference() {
    const activeModule = state.models.modules.find(
        m => m.id === state.models.activeModuleId
    );
    const modelStatus = state.models.modelStatuses[state.models.activeModuleId];
    const inputReady =
        state.workbench.input.imageURLs.length > 0 ||
        state.workbench.input.audioURL !== null;

    if (
        !inputReady ||
        state.workbench.isProcessing ||
        !activeModule ||
        modelStatus.status !== 'found'
    )
        return;

    setProcessing(true);
    setInferenceStartTime(Date.now());
    setInferenceDuration(null);
    setOutputData(null);

    try {
        // If iterative mode is on and we have multiple images, run them one by one.
        if (
            state.workbench.processingMode === 'iterative' &&
            // This check ensures we only use this path for image tasks with multiple inputs.
            state.workbench.input.imageURLs.length > 1 &&
            (activeModule.task === 'image-to-image' ||
                activeModule.task === 'image-segmentation' ||
                activeModule.task === 'depth-estimation')
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
    }
}

function _getPipelineOptions(activeModule, modelStatus) {
    const selectedVariant = modelStatus.discoveredVariants?.find(
        v => v.name === modelStatus.selectedVariant
    );

    if (!selectedVariant) {
        throw new Error(
            `Could not find details for selected variant "${modelStatus.selectedVariant}".`
        );
    }

    const baseOptions = selectedVariant.pipeline_options || {};
    const userConfigs = state.workbench.runtimeConfigs[activeModule.id] || {};
    const device = state.system.useGpu ? 'webgpu' : 'wasm';

    const finalPipelineOptions = {
        ...baseOptions,
        ...userConfigs,
        device: device,
    };

    if (activeModule.task === 'automatic-speech-recognition') {
        finalPipelineOptions.chunk_length_s = 30;
    }

    return { selectedVariant, finalPipelineOptions };
}

async function _runIterativeInference(activeModule, modelStatus) {
    const urls = state.workbench.input.imageURLs;
    const results = [];
    for (let i = 0; i < urls.length; i++) {
        // Stop processing if the user has switched models or cleared inputs
        if (!state.workbench.isProcessing) break;

        dom.statusText().textContent = `Status: Processing image ${i + 1} of ${
            urls.length
        }...`;
        try {
            const result = await _executeSingleInference(
                urls[i],
                activeModule,
                modelStatus
            );
            if (result) {
                results.push(result);
                setOutputData([...results]); // Update UI with growing result list
            }
        } catch (error) {
            console.error(`Error processing item ${i}:`, error);
            // Optionally, push an error placeholder to the results
        }
    }
    const duration = Date.now() - state.workbench.inferenceStartTime;
    setInferenceDuration(duration);
    setProcessing(false);
}
async function _executeSingleInference(url, activeModule, modelStatus) {
    // This function is for iterative processing of a single item.
    return new Promise(async (resolve, reject) => {
        try {
            resolveSingleInferencePromise = resolve;

            const { selectedVariant, finalPipelineOptions } =
                _getPipelineOptions(activeModule, modelStatus);

            const modelFiles = await prepareModelFiles(
                activeModule,
                selectedVariant
            );

            inferenceWorker.postMessage({
                type: 'run',
                modelFiles: modelFiles,
                modelId: activeModule.id,
                task: activeModule.task,
                pipelineOptions: finalPipelineOptions,
                data: url,
            });
        } catch (error) {
            reject(error);
        }
    });
}

async function decodeAudio(url) {
    if (!audioContext) {
        audioContext = new AudioContext({ sampleRate: 16000 });
    }
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const decodedAudio = await audioContext.decodeAudioData(arrayBuffer);

    return decodedAudio.getChannelData(0);
}

async function _runBatchInference(activeModule, modelStatus) {
    try {
        let { selectedVariant, finalPipelineOptions } = _getPipelineOptions(
            activeModule,
            modelStatus
        );

        const modelFiles = await prepareModelFiles(
            activeModule,
            selectedVariant
        );

        let dataToProcess;
        if (activeModule.task === 'image-segmentation-with-prompt') {
            if (state.workbench.input.imageURLs.length === 0)
                throw new Error('No input image for segmentation.');
            if (state.workbench.input.imageURLs.length > 1)
                throw new Error(
                    'Image segmentation with prompts only supports single image input.'
                );
            if (state.workbench.input.points.length === 0)
                throw new Error(
                    'Please add at least one prompt point to the image.'
                );

            const imageUrl = state.workbench.input.imageURLs[0];

            // For SAM, the worker needs the *original image dimensions* and the points.
            // It will handle reading the image and calculating embeddings.
            const image = new Image(); // Temporarily load image to get dimensions for the worker
            image.src = imageUrl;
            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = reject;
            });

            finalPipelineOptions.image_width = image.width;
            finalPipelineOptions.image_height = image.height;
            finalPipelineOptions.input_points =
                state.workbench.input.points.map(p => p.point); // Pass points
            finalPipelineOptions.input_labels =
                state.workbench.input.points.map(p => p.label); // Pass labels

            dataToProcess = imageUrl; // Send the image URL to worker
        } else if (state.workbench.input.audioURL) {
            dom.statusText().textContent = 'Status: Decoding audio file...';
            dataToProcess = await decodeAudio(
                state.workbench.input.audioURL.url
            );
        } else {
            // For other image tasks
            if (state.workbench.input.imageURLs.length === 0)
                throw new Error('No input images provided.');

            // In batch mode, send a single image URL or an array of them.
            dataToProcess =
                state.workbench.input.imageURLs.length === 1
                    ? state.workbench.input.imageURLs[0]
                    : state.workbench.input.imageURLs;
        }

        inferenceWorker.postMessage({
            type: 'run',
            modelFiles: modelFiles,
            modelId: activeModule.id,
            task: activeModule.task,
            pipelineOptions: finalPipelineOptions,
            data: dataToProcess,
        });
    } catch (error) {
        throw error;
    }
}
