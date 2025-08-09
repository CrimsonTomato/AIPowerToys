import { applyMaskToImageData } from '../../js/ui/utils/displayUtils.js';

/**
 * Post-processes the output of the RMBG-1.4 image-segmentation model.
 * It can either return a black and white mask, or apply the mask to the
 * original image's alpha channel to create a transparent background.
 * @param {Array} output - The raw output from the pipeline.
 * @param {string} inputUrl - The base64 URL of the original input image.
 * @param {object} options - The pipeline options, checked for `return_mask`.
 * @returns {Promise<ImageData>} A renderable ImageData object.
 */
export async function postprocess(output, inputUrl, options) {
    const mask = output[0].mask; // The model returns a RawImage mask

    // Option 1: The user just wants to see the black and white mask.
    if (options.return_mask === true) {
        const rgbaData = new Uint8ClampedArray(mask.width * mask.height * 4);
        for (let i = 0; i < mask.data.length; ++i) {
            const val = mask.data[i];
            rgbaData[i * 4] = val;
            rgbaData[i * 4 + 1] = val;
            rgbaData[i * 4 + 2] = val;
            rgbaData[i * 4 + 3] = 255;
        }
        return new ImageData(rgbaData, mask.width, mask.height);
    }

    // Option 2: Apply the mask to the original image's alpha channel.
    // To do this, we need the original image's pixel data.
    const imageBitmap = await createImageBitmap(
        await (await fetch(inputUrl)).blob()
    );

    // Draw the original image to an offscreen canvas to get its pixel data.
    const offscreenCanvas = new OffscreenCanvas(
        imageBitmap.width,
        imageBitmap.height
    );
    const ctx = offscreenCanvas.getContext('2d');
    ctx.drawImage(imageBitmap, 0, 0);
    const imageData = ctx.getImageData(
        0,
        0,
        imageBitmap.width,
        imageBitmap.height
    );

    // Use the robust utility function to apply the mask. The mask from this
    // pipeline is a RawImage with grayscale values (0-255), which is what
    // the utility function expects.
    return applyMaskToImageData(imageData, mask);
}
