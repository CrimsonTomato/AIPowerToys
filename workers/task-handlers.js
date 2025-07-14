/**
 * Post-processes the output of a depth-estimation model.
 * This logic is moved directly from the old worker.
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
 * A map of task names to their specific post-processing handlers.
 * This allows the main inference worker to be generic.
 */
export const taskHandlers = {
    'depth-estimation': postProcessDepthEstimation,
    // Future handlers for other tasks can be added here.
    // e.g., 'text-generation': (output) => output[0].generated_text,
};
