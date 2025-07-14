/**
 * Post-processes the output of a depth-estimation model.
 * @param {object} output - The raw output from the pipeline.
 * @returns {ImageData} A renderable ImageData object.
 */
function postProcessDepthEstimation(output) {
    const depth = output.depth;
    const rgbaData = new Uint8ClampedArray(depth.width * depth.height * 4);
    for (let i = 0; i < depth.data.length; ++i) {
        const val = depth.data[i];
        rgbaData[i * 4] = val;
        rgbaData[i * 4 + 1] = val;
        rgbaData[i * 4 + 2] = val;
        rgbaData[i * 4 + 3] = 255;
    }
    return new ImageData(rgbaData, depth.width, depth.height);
}

/**
 * Post-processes the output of an image-to-image model (like upscaling).
 * Converts a RawImage (RGB) to a renderable ImageData (RGBA).
 * @param {RawImage} output - The raw output from the pipeline.
 * @returns {ImageData} A renderable ImageData object.
 */
function postProcessImageToImage(output) {
    const { data, width, height } = output;
    const rgbaData = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; ++i) {
        // Get the RGB values for the current pixel.
        const r = data[i * 3];
        const g = data[i * 3 + 1];
        const b = data[i * 3 + 2];

        // Set the RGBA values for the current pixel.
        rgbaData[i * 4] = r;
        rgbaData[i * 4 + 1] = g;
        rgbaData[i * 4 + 2] = b;
        rgbaData[i * 4 + 3] = 255; // Alpha channel (fully opaque)
    }
    return new ImageData(rgbaData, width, height);
}

/**
 * A map of task names to their specific post-processing handlers.
 * This allows the main inference worker to be generic.
 */
export const taskHandlers = {
    'depth-estimation': postProcessDepthEstimation,
    'image-to-image': postProcessImageToImage,
};
