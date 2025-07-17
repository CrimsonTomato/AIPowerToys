import {
    env,
    pipeline,
    RawImage,
    SamModel,
    AutoProcessor,
} from '@huggingface/transformers';

// --- THE CORRECT, PROVEN CONFIGURATION ---
env.allowRemoteModels = false;
env.allowLocalModels = true;

// This worker knows nothing about directory handles.
// It will be populated by the main thread.
const fileCache = new Map();

let currentPipeline = null; // Will now also hold custom model/processor for SAM
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
                if (
                    currentPipeline &&
                    typeof currentPipeline.dispose === 'function'
                ) {
                    // Ensure dispose is a function
                    await currentPipeline.dispose();
                }

                // NEW: Handle SAM task with specific model/processor loading
                if (task === 'image-segmentation-with-prompt') {
                    const model = await SamModel.from_pretrained(
                        modelId,
                        pipelineOptions
                    );
                    const processor = await AutoProcessor.from_pretrained(
                        modelId
                    );
                    currentPipeline = { model, processor, isCustom: true }; // Mark as custom for specific handling
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

            // --- DYNAMIC TASK HANDLER IMPORT ---
            let taskHandlerModule;
            try {
                taskHandlerModule = await import(`./tasks/${task}.task.js`);
            } catch (error) {
                console.error(
                    `Dynamic import for task "${task}" failed:`,
                    error
                );
                throw new Error(
                    `Could not load task module for task: "${task}". Make sure a file named "${task}.task.js" exists in the "workers/tasks/" directory.`
                );
            }

            if (!taskHandlerModule.postprocess) {
                throw new Error(
                    `Task module for "${task}" does not export a "postprocess" function.`
                );
            }

            // --- RUN INFERENCE ---
            const statusMessage =
                Array.isArray(data) && data.length > 1
                    ? `Running inference on ${data.length} images...`
                    : 'Running inference...';
            self.postMessage({ type: 'status', data: statusMessage });

            let output;
            let rawOutputForPostprocessing = null; // To pass model's direct output (e.g., scores for SAM)

            // NEW: Custom handling for SAM inference
            if (
                currentPipeline.isCustom &&
                task === 'image-segmentation-with-prompt'
            ) {
                const image = await RawImage.read(data);
                const {
                    image_width,
                    image_height,
                    input_points,
                    input_labels,
                } = pipelineOptions;

                // Scale points from normalized (0-1) to original image dimensions
                const scaledPoints = input_points.map(p => [
                    p[0] * image_width,
                    p[1] * image_height,
                ]);

                const inputs = await currentPipeline.processor(image, {
                    input_points: [scaledPoints],
                    input_labels: [input_labels], // Labels are already a flat array of 0s/1s
                });

                rawOutputForPostprocessing = await currentPipeline.model(
                    inputs
                );

                // Post-process masks using the processor
                output = await currentPipeline.processor.post_process_masks(
                    rawOutputForPostprocessing.pred_masks,
                    inputs.original_sizes,
                    inputs.reshaped_input_sizes
                );
            } else {
                output = await currentPipeline(data, pipelineOptions);
            }

            self.postMessage({
                type: 'status',
                data: 'Post-processing results...',
            });

            // Pass raw output to postprocess function if it exists
            if (rawOutputForPostprocessing) {
                pipelineOptions.raw = rawOutputForPostprocessing;
            }

            const outputBatch = Array.isArray(data) ? output : [output];
            const inputArray = Array.isArray(data) ? data : [data];

            const processingPromises = outputBatch.map(
                (singleResult, index) => {
                    // singleResult could be a RawImage, a Tensor, or other model output
                    const inputUrl = inputArray[index];
                    return taskHandlerModule.postprocess(
                        singleResult,
                        inputUrl,
                        pipelineOptions
                    );
                }
            );

            const renderables = await Promise.all(processingPromises);

            const finalData = Array.isArray(data)
                ? renderables
                : renderables[0];

            // NEW: For SAM, pass both the main data (cutout) and the rawMaskOnly data
            if (
                task === 'image-segmentation-with-prompt' &&
                finalData &&
                finalData.imageData
            ) {
                self.postMessage({
                    type: 'result',
                    data: finalData.imageData,
                    rawMaskOnly: finalData.rawMaskOnly,
                });
            } else {
                self.postMessage({ type: 'result', data: finalData });
            }
        } catch (error) {
            console.error(error);
            self.postMessage({
                type: 'status',
                data: `Error: ${error.message}`,
            });
            currentPipeline = null;
            currentModelId = null;
        }
    }
};
