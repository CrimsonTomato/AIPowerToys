/**
 * Post-processes the output of a depth-estimation model.
 * The function name is standardized to `postprocess`.
 * @param {object} output - The raw output from the pipeline.
 * @returns {ImageData} A renderable ImageData object.
 */
export async function postprocess(output) {
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
