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
                const duration = Date.now() - state.inferenceStartTime;
                setInferenceDuration(duration);
                setOutputData(data);
                setProcessing(false);
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
    const activeModule = state.modules.find(m => m.id === state.activeModuleId);
    const modelStatus = state.modelStatuses[state.activeModuleId];
    const inputReady =
        state.inputDataURLs.length > 0 || state.inputAudioURL !== null;

    if (
        !inputReady ||
        state.isProcessing ||
        !activeModule ||
        modelStatus.status !== 'found'
    )
        return;

    setProcessing(true);
    setInferenceStartTime(Date.now());
    setInferenceDuration(null);
    setOutputData(null);

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
    const userConfigs = state.runtimeConfigs[activeModule.id] || {};
    const device = state.useGpu ? 'webgpu' : 'wasm';

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

async function _executeSingleInference(url, activeModule, modelStatus) {
    // This function is for iterative processing, which SAM does not support in its current UI iteration.
    // So this path should ideally not be taken for SAM.
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
            if (state.inputDataURLs.length === 0)
                throw new Error('No input image for segmentation.');
            if (state.inputDataURLs.length > 1)
                throw new Error(
                    'Image segmentation with prompts only supports single image input.'
                );
            if (state.inputPoints.length === 0)
                throw new Error(
                    'Please add at least one prompt point to the image.'
                );

            const imageUrl = state.inputDataURLs[0];

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
            finalPipelineOptions.input_points = state.inputPoints.map(
                p => p.point
            ); // Pass points
            finalPipelineOptions.input_labels = state.inputPoints.map(
                p => p.label
            ); // Pass labels

            dataToProcess = imageUrl; // Send the image URL to worker
        } else if (state.inputAudioURL) {
            dom.statusText().textContent = 'Status: Decoding audio file...';
            dataToProcess = await decodeAudio(state.inputAudioURL.url);
        } else {
            // For other image tasks (image-to-image, depth-estimation),
            // ensure single image if not batch, or throw error if multiple for single-image task
            if (state.inputDataURLs.length === 0)
                throw new Error('No input data provided.');

            if (state.processingMode === 'batch') {
                dataToProcess =
                    state.inputDataURLs.length === 1
                        ? state.inputDataURLs[0]
                        : state.inputDataURLs;
            } else {
                // iterative mode, send only first for now
                dataToProcess = state.inputDataURLs[0];
            }
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
