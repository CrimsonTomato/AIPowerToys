import { env, pipeline } from '@huggingface/transformers';
import { taskHandlers } from './task-handlers.js';

// --- THE CORRECT, PROVEN CONFIGURATION ---
env.allowRemoteModels = false;
env.allowLocalModels = true;

// This worker knows nothing about directory handles.
// It will be populated by the main thread.
const fileCache = new Map();

let currentPipeline = null;
let currentModelId = null;
let currentPipelineOptions = null;

// The custom cache uses the in-memory fileCache.
env.useCustomCache = true;
env.customCache = {
    match: async request => {
        // The `request` parameter can be a Request object OR a URL string.
        // We handle both cases to prevent errors.
        const url = typeof request === 'string' ? request : request.url;

        // The key in our fileCache is the path without the origin (e.g., /models/Xenova/model.onnx)
        const cacheKey = url.replace(self.location.origin, '');

        const cachedBlob = fileCache.get(cacheKey);
        if (cachedBlob) {
            return new Response(cachedBlob);
        }
        return undefined; // File not found in the provided package.
    },
    put: async () => {},
};

self.onmessage = async e => {
    // We receive modelFiles, not a handle.
    const {
        type,
        modelFiles,
        onnxModelPath,
        modelId,
        task,
        pipelineOptions,
        data,
    } = e.data;

    if (type === 'run') {
        try {
            self.postMessage({
                type: 'status',
                data: 'Populating local model cache...',
            });

            // Clear the cache and populate it with the new files.
            fileCache.clear();
            let onnxFileBuffer = null;
            const onnxFileFullPath = `/models/${modelId}/${onnxModelPath}`;

            for (const [path, buffer] of Object.entries(modelFiles)) {
                fileCache.set(path, new Blob([buffer]));
                if (path === onnxFileFullPath) {
                    onnxFileBuffer = buffer;
                }
            }

            if (pipelineOptions?.device === 'webgpu' && onnxFileBuffer) {
                const commonModelNames = [
                    'model.onnx',
                    'encoder_model.onnx',
                    'decoder_model.onnx',
                    'decoder_with_past_model.onnx',
                ];
                const directoryPath = onnxFileFullPath.substring(
                    0,
                    onnxFileFullPath.lastIndexOf('/') + 1
                );
                const modelBlob = new Blob([onnxFileBuffer]);
                for (const name of commonModelNames) {
                    const aliasPath = `${directoryPath}${name}`;
                    if (!fileCache.has(aliasPath)) {
                        fileCache.set(aliasPath, modelBlob);
                    }
                }
            }

            // --- PIPELINE CREATION/RE-USE LOGIC ---
            const isGpu = pipelineOptions?.device === 'webgpu';
            const needsNewPipeline =
                !currentPipeline ||
                currentModelId !== modelId ||
                JSON.stringify(currentPipelineOptions) !==
                    JSON.stringify(pipelineOptions) ||
                isGpu;

            if (needsNewPipeline) {
                self.postMessage({
                    type: 'status',
                    data: `Creating pipeline (Device: ${
                        pipelineOptions?.device || 'wasm'
                    })...`,
                });
                if (currentPipeline) {
                    await currentPipeline.dispose();
                }
                currentPipeline = await pipeline(
                    task,
                    modelId,
                    pipelineOptions
                );
                currentModelId = modelId;
                currentPipelineOptions = pipelineOptions;

                self.postMessage({
                    type: 'status',
                    data: 'Model loaded. Ready for inference.',
                });
            }

            // --- TRUE BATCHING ---
            // `data` is now an array of data URLs (or a single one in an array)
            // The pipeline function handles both single and array inputs.
            const statusMessage =
                Array.isArray(data) && data.length > 1
                    ? `Running inference on ${data.length} images...`
                    : 'Running inference...';
            self.postMessage({ type: 'status', data: statusMessage });

            const output = await currentPipeline(data, pipelineOptions);

            self.postMessage({
                type: 'status',
                data: 'Post-processing results...',
            });
            const postProcess = taskHandlers[task];
            if (!postProcess) {
                throw new Error(
                    `No post-processing handler found for task: ${task}`
                );
            }

            // The pipeline returns an array of results for a batch, or a single result for a single input.
            // We ensure it's always an array for consistent processing.
            const outputArray = Array.isArray(output) ? output : [output];
            const inputArray = Array.isArray(data) ? data : [data];

            const processingPromises = outputArray.map(
                (singleOutput, index) => {
                    const inputUrl = inputArray[index];
                    return postProcess(singleOutput, inputUrl, pipelineOptions);
                }
            );

            const renderables = await Promise.all(processingPromises);

            // If the original input was not an array, return a single item instead of an array of one.
            const finalData = Array.isArray(data)
                ? renderables
                : renderables[0];

            self.postMessage({ type: 'result', data: finalData });
        } catch (error) {
            console.error(error);
            self.postMessage({
                type: 'error',
                data: `Error: ${error.message}`,
            });
            // Reset pipeline on error
            currentPipeline = null;
            currentModelId = null;
        }
    }
};
