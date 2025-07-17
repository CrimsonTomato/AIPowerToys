import { RawImage, Tensor } from '@huggingface/transformers';
import { applyMaskToImageData } from '../../js/ui/utils/displayUtils.js';

/**
 * Post-processes the output of a segment-anything model.
 * It overlays the highest-scoring mask on top of the original image.
 * @param {Array} output - The raw output from the pipeline, an array containing one multi-channel Tensor (the mask).
 * @param {string} inputUrl - The base64 URL of the original input image.
 * @param {object} options - The pipeline options, which includes the raw model output (`raw`).
 * @returns {Promise<{imageData: ImageData, rawMaskOnly: RawImage}>} An object containing the default output ImageData (cutout) and the raw mask for alternative visualizations.
 */
export async function postprocess(output, inputUrl, options) {
    const raw = options.raw;
    if (!raw || !raw.iou_scores || !raw.pred_masks) {
        throw new Error(
            'Could not find raw model output (masks and scores) in pipeline options.'
        );
    }

    const scores = raw.iou_scores.data;
    const masksTensor = output[0]; // The single Tensor from the output array.

    // Select the mask with the highest IoU score
    let bestIndex = 0;
    for (let i = 1; i < scores.length; ++i) {
        if (scores[i] > scores[bestIndex]) {
            bestIndex = i;
        }
    }

    // Manual TENSOR SLICING:
    // 1. Squeeze the batch dimension (dim 0) -> [num_masks, height, width]
    // 2. Extract the data for the best mask using subarray
    // 3. Create a new 2D Tensor from this data with the correct shape
    // 4. Unsqueeze to 3D [1, height, width] as RawImage.fromTensor expects 3D for boolean
    const [num_masks, height, width] = masksTensor.squeeze(0).dims; // Get dimensions after first squeeze
    const maskDataSize = height * width;
    const startOffset = bestIndex * maskDataSize;
    const endOffset = startOffset + maskDataSize;

    // Get the raw data of the squeezed tensor (which is Uint8Array for bool type)
    const bestMaskRawData = masksTensor
        .squeeze(0)
        .data.subarray(startOffset, endOffset);

    // Create a new 2D tensor from the extracted data.
    const bestMask2DTensor = new Tensor('bool', bestMaskRawData, [
        height,
        width,
    ]);

    // fromTensor with boolean data expects a 3D tensor [C, H, W]. Add a channel dimension of size 1.
    const bestMask3DTensor = bestMask2DTensor.unsqueeze(0);

    const bestMaskRawImage = RawImage.fromTensor(bestMask3DTensor);

    // Load the original image to draw on for the 'cutout' output
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

    // Create the 'cutout' image data (transparent background)
    // We convert the boolean mask (0 or 1) to a grayscale 0-255 mask for applyMaskToImageData
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

    // Return both the default output (cutout) and the raw mask for other visualization modes
    return {
        imageData: cutoutImageData,
        rawMaskOnly: bestMaskRawImage, // Store this for client-side rendering of other modes
    };
}
