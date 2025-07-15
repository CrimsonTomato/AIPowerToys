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
    const { type, modelFiles, onnxModelPath, modelId, task, pipelineOptions, data } = e.data;

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

            // --- FINAL, ROBUST FIX FOR WEBGPU ---
            // The WebGPU backend can be particular about filenames. It might look for 'model.onnx',
            // 'encoder_model.onnx', etc. The key insight is that it looks for these files
            // in the SAME DIRECTORY as the main model file.
            if (pipelineOptions?.device === 'webgpu' && onnxFileBuffer) {
                const commonModelNames = [
                    'model.onnx',
                    'encoder_model.onnx',
                    'decoder_model.onnx',
                    'decoder_with_past_model.onnx',
                ];

                // Extract the directory path from the full path of the selected model variant.
                // e.g., for `/models/id/onnx/model_fp16.onnx`, this gets `/models/id/onnx/`
                const directoryPath = onnxFileFullPath.substring(0, onnxFileFullPath.lastIndexOf('/') + 1);

                const modelBlob = new Blob([onnxFileBuffer]);

                for (const name of commonModelNames) {
                    // Create the full alias path within the correct directory.
                    const aliasPath = `${directoryPath}${name}`;

                    // Do not overwrite if a file with this name already exists.
                    // This is important for models with separate encoder/decoder files.
                    if (!fileCache.has(aliasPath)) {
                        fileCache.set(aliasPath, modelBlob);
                        console.log(`AI PowerToys (WebGPU Fix): Aliased ${onnxFileFullPath} to ${aliasPath}`);
                    }
                }
            }
            // --- END FIX ---


            self.postMessage({
                type: 'status',
                data: `Creating pipeline (Device: ${
                    pipelineOptions?.device || 'wasm'
                })...`,
            });

            // The pipeline call now works because the cache is ready.
            currentPipeline = await pipeline(task, modelId, pipelineOptions);
            currentModelId = modelId;
            self.postMessage({
                type: 'status',
                data: 'Model loaded. Ready for inference.',
            });

            self.postMessage({ type: 'status', data: 'Running inference...' });
            const output = await currentPipeline(data, pipelineOptions);

            self.postMessage({
                type: 'status',
                data: 'Post-processing result...',
            });
            const postProcess = taskHandlers[task];
            if (!postProcess) {
                throw new Error(
                    `No post-processing handler found for task: ${task}`
                );
            }

            // Pass the original data (inputUrl) and options to the handler
            const renderable = await postProcess(output, data, pipelineOptions);

            self.postMessage({ type: 'result', data: renderable });
        } catch (error) {
            console.error(error);
            self.postMessage({
                type: 'status',
                data: `Error: ${error.message}`,
            });
        }
    }
};