import { env, pipeline, RawImage } from '@huggingface/transformers';

// --- CONFIGURATION ---
env.allowRemoteModels = false;
env.allowLocalModels = true;

const fileCache = new Map();
let currentPipeline = null;
let currentModelId = null;
let currentPipelineOptions = null;

env.useCustomCache = true;
env.customCache = {
    match: async request => {
        const url = typeof request === 'string' ? request : request.url;
        const cacheKey = url.replace(self.location.origin, '');
        const cachedBlob = fileCache.get(cacheKey);
        if (cachedBlob) return new Response(cachedBlob);
        return undefined;
    },
    put: async () => {},
};

self.onmessage = async e => {
    const { type, modelFiles, modelId, task, pipelineOptions, data } = e.data;

    if (type === 'run') {
        try {
            self.postMessage({
                type: 'status',
                data: 'Populating local model cache...',
            });
            fileCache.clear();
            for (const [path, buffer] of Object.entries(modelFiles)) {
                fileCache.set(path, new Blob([buffer]));
            }

            // --- DYNAMIC TASK HANDLER IMPORT ---
            const taskHandlerModule = await import(`./tasks/${task}.task.js`);
            if (!taskHandlerModule.postprocess) {
                throw new Error(
                    `Task module for "${task}" does not export a "postprocess" function.`
                );
            }

            // --- PIPELINE CREATION/RE-USE LOGIC ---
            const needsNewPipeline =
                !currentPipeline ||
                currentModelId !== modelId ||
                JSON.stringify(currentPipelineOptions) !==
                    JSON.stringify(pipelineOptions);

            if (needsNewPipeline) {
                self.postMessage({
                    type: 'status',
                    data: 'Creating pipeline...',
                });
                if (
                    currentPipeline &&
                    typeof currentPipeline.dispose === 'function'
                ) {
                    await currentPipeline.dispose();
                }

                // Use custom pipeline creation if available, otherwise use default
                if (taskHandlerModule.createPipeline) {
                    currentPipeline = await taskHandlerModule.createPipeline(
                        modelId,
                        pipelineOptions
                    );
                } else {
                    currentPipeline = await pipeline(
                        task,
                        modelId,
                        pipelineOptions
                    );
                }

                currentModelId = modelId;
                currentPipelineOptions = pipelineOptions;
                self.postMessage({
                    type: 'status',
                    data: 'Model loaded. Ready for inference.',
                });
            }

            // --- RUN INFERENCE ---
            self.postMessage({ type: 'status', data: 'Running inference...' });

            let rawOutput;
            // Use custom run function if available, otherwise use default
            if (taskHandlerModule.run) {
                rawOutput = await taskHandlerModule.run(
                    currentPipeline,
                    data,
                    pipelineOptions
                );
            } else {
                rawOutput = await currentPipeline(data, pipelineOptions);
            }

            // --- POST-PROCESS ---
            self.postMessage({
                type: 'status',
                data: 'Post-processing results...',
            });

            const isBatch = Array.isArray(data);
            const outputBatch = isBatch ? rawOutput : [rawOutput];
            const inputArray = isBatch ? data : [data];

            const processingPromises = outputBatch.map(
                (singleResult, index) => {
                    const inputUrl = inputArray[index];
                    // Pass the pipeline object to postprocess in case it needs it (e.g., for processors)
                    return taskHandlerModule.postprocess(
                        singleResult,
                        inputUrl,
                        pipelineOptions,
                        currentPipeline
                    );
                }
            );

            const renderables = await Promise.all(processingPromises);
            const finalData = isBatch ? renderables : renderables[0];

            // For SAM, the postprocess function now returns an object. We extract the main imageData.
            if (
                task === 'image-segmentation-with-prompt' &&
                finalData?.imageData
            ) {
                self.postMessage({ type: 'result', data: finalData.imageData });
            } else {
                self.postMessage({ type: 'result', data: finalData });
            }
        } catch (error) {
            console.error(error);
            self.postMessage({
                type: 'error',
                data: error.message,
            });
            currentPipeline = null;
            currentModelId = null;
        }
    }
};
