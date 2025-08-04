import {
    RawImage,
    Tensor,
    SamModel,
    AutoProcessor,
} from '@huggingface/transformers';
import { applyMaskToImageData } from '../../js/ui/utils/displayUtils.js';

/**
 * Custom pipeline creation function for the SAM model.
 * This is called by the generic worker instead of the default pipeline factory.
 * @param {string} modelId The model ID to load.
 * @param {object} options The pipeline options.
 * @returns {Promise<object>} A custom pipeline object with model, processor, and a dispose method.
 */
export async function createPipeline(modelId, options) {
    const model = await SamModel.from_pretrained(modelId, options);
    const processor = await AutoProcessor.from_pretrained(modelId);
    return {
        model,
        processor,
        dispose: async () => {
            if (model?.dispose) await model.dispose();
        },
    };
}

/**
 * Custom inference function for the SAM model.
 * @param {object} pipeline The custom pipeline object from createPipeline.
 * @param {RawImage | string} data The input data (image URL).
 * @param {object} options The pipeline options containing points and labels.
 * @returns {Promise<object>} A combined object containing the raw model output and necessary pre-processing data.
 */
export async function run(pipeline, data, options) {
    const image = await RawImage.read(data);
    const { image_width, image_height, input_points, input_labels } = options;

    // Scale points from normalized (0-1) to original image dimensions
    const scaledPoints = input_points.map(p => [
        p[0] * image_width,
        p[1] * image_height,
    ]);

    const inputs = await pipeline.processor(image, {
        input_points: [scaledPoints],
        input_labels: [input_labels],
    });

    const modelOutput = await pipeline.model(inputs);

    // FIX: Return a combined object with both model output and processor metadata
    return {
        modelOutput: modelOutput,
        original_sizes: inputs.original_sizes,
        reshaped_input_sizes: inputs.reshaped_input_sizes,
    };
}

/**
 * Post-processes the output of the SAM model.
 * @param {object} inferenceResult - The combined result object from the custom `run` function.
 * @param {string} inputUrl - The URL of the original input image.
 * @param {object} options - The pipeline options.
 * @param {object} pipeline - The custom pipeline object, containing the processor.
 * @returns {Promise<{imageData: ImageData, rawMaskOnly: RawImage}>} An object with the final cutout image and the raw mask.
 */
export async function postprocess(
    inferenceResult,
    inputUrl,
    options,
    pipeline
) {
    // FIX: Destructure the combined result object
    const { modelOutput, original_sizes, reshaped_input_sizes } =
        inferenceResult;

    if (!modelOutput || !modelOutput.iou_scores || !modelOutput.pred_masks) {
        throw new Error('Could not find raw model output (masks and scores).');
    }
    if (!pipeline || !pipeline.processor) {
        throw new Error(
            'SAM processor not found in pipeline object for post-processing.'
        );
    }

    // FIX: Use the correct variables passed to the function
    const masks = await pipeline.processor.post_process_masks(
        modelOutput.pred_masks,
        original_sizes,
        reshaped_input_sizes
    );
    const masksTensor = masks[0];
    const scores = modelOutput.iou_scores.data;

    // Select the mask with the highest IoU score
    let bestIndex = 0;
    for (let i = 1; i < scores.length; ++i) {
        if (scores[i] > scores[bestIndex]) {
            bestIndex = i;
        }
    }

    // Manually slice the tensor to extract the best mask
    const squeezed = masksTensor.squeeze(0);
    const [num_masks, height, width] = squeezed.dims;
    const maskDataSize = height * width;
    const bestMaskData = squeezed.data.subarray(
        bestIndex * maskDataSize,
        (bestIndex + 1) * maskDataSize
    );
    const bestMask2DTensor = new Tensor('bool', bestMaskData, [height, width]);
    const bestMaskRawImage = RawImage.fromTensor(bestMask2DTensor.unsqueeze(0));

    // Load original image and apply the mask to its alpha channel
    const imageBitmap = await createImageBitmap(
        await (await fetch(inputUrl)).blob()
    );
    const offscreenCanvas = new OffscreenCanvas(
        imageBitmap.width,
        imageBitmap.height
    );
    const ctx = offscreenCanvas.getContext('2d');
    ctx.drawImage(imageBitmap, 0, 0);
    const originalImageData = ctx.getImageData(
        0,
        0,
        imageBitmap.width,
        imageBitmap.height
    );

    const grayscaleMaskData = new Uint8ClampedArray(
        bestMaskRawImage.data.map(val => val * 255)
    );
    const grayscaleMaskRawImage = new RawImage(
        grayscaleMaskData,
        bestMaskRawImage.width,
        bestMaskRawImage.height,
        1
    );

    const cutoutImageData = applyMaskToImageData(
        originalImageData,
        grayscaleMaskRawImage
    );

    return {
        imageData: cutoutImageData,
        rawMaskOnly: bestMaskRawImage,
    };
}
