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
        const cachedBlob = fileCache.get(request);
        if (cachedBlob) {
            return new Response(cachedBlob);
        }
        return undefined; // File not found in the provided package.
    },
    put: async () => {},
};

self.onmessage = async e => {
    // We receive modelFiles, not a handle.
    const { type, modelFiles, modelId, task, pipelineOptions, data } = e.data;

    if (type === 'run') {
        try {
            self.postMessage({
                type: 'status',
                data: 'Populating local model cache...',
            });

            // Clear the cache and populate it with the new files.
            fileCache.clear();
            for (const [path, buffer] of Object.entries(modelFiles)) {
                fileCache.set(path, new Blob([buffer]));
            }

            self.postMessage({
                type: 'status',
                data: 'Creating pipeline from local files...',
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
