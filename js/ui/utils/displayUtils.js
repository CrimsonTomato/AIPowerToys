/**
 * Converts a RawImage (e.g., from Hugging Face Transformers) to a renderable ImageData object.
 * Handles both grayscale (2D) and RGB/RGBA (3D) RawImages.
 * @param {RawImage} rawImage - The RawImage object to convert.
 * @returns {ImageData} A renderable ImageData object.
 */
export function createImageDataFromRawImage(rawImage) {
    const { data, width, height, channels } = rawImage;
    const rgbaData = new Uint8ClampedArray(width * height * 4);

    if (channels === 1) {
        // Grayscale
        for (let i = 0; i < width * height; ++i) {
            const val = data[i];
            rgbaData[i * 4] = val;
            rgbaData[i * 4 + 1] = val;
            rgbaData[i * 4 + 2] = val;
            rgbaData[i * 4 + 3] = 255;
        }
    } else if (channels === 3) {
        // RGB
        for (let i = 0; i < width * height; ++i) {
            rgbaData[i * 4] = data[i * 3];
            rgbaData[i * 4 + 1] = data[i * 3 + 1];
            rgbaData[i * 4 + 2] = data[i * 3 + 2];
            rgbaData[i * 4 + 3] = 255;
        }
    } else if (channels === 4) {
        // RGBA
        for (let i = 0; i < width * height; ++i) {
            rgbaData[i * 4] = data[i * 4];
            rgbaData[i * 4 + 1] = data[i * 4 + 1];
            rgbaData[i * 4 + 2] = data[i * 4 + 2];
            rgbaData[i * 4 + 3] = data[i * 4 + 3];
        }
    } else {
        throw new Error(`Unsupported RawImage channel count: ${channels}`);
    }

    return new ImageData(rgbaData, width, height);
}

/**
 * Applies a grayscale mask to an ImageData object's alpha channel, effectively
 * cutting out the masked area.
 * @param {ImageData} imageData - The original ImageData object.
 * @param {RawImage} mask - The grayscale mask as a RawImage (values 0-255).
 * @returns {ImageData} A new ImageData object with the mask applied to the alpha channel.
 */
export function applyMaskToImageData(imageData, mask) {
    const newImageData = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
    );

    const maskData = mask.data;
    const widthRatio = mask.width / imageData.width;
    const heightRatio = mask.height / imageData.height;

    for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
            const targetIndex = y * imageData.width + x;

            // Find the corresponding pixel in the (potentially larger) mask
            const maskX = Math.floor(x * widthRatio);
            const maskY = Math.floor(y * heightRatio);
            const maskIndex = maskY * mask.width + maskX;

            // Set the alpha value of the output pixel to the mask's grayscale value
            newImageData.data[targetIndex * 4 + 3] = maskData[maskIndex];
        }
    }
    return newImageData;
}

/**
 * Overlays a semi-transparent colored mask onto an existing ImageData object.
 * The mask is assumed to be boolean (0 or 1).
 * @param {ImageData} imageData - The original ImageData object to draw on.
 * @param {RawImage} mask - The boolean mask as a RawImage (values 0 or 1).
 * @param {number[]} color - The RGBA color array for the mask (e.g., [R, G, B, A]).
 * @returns {ImageData} A new ImageData object with the blended mask.
 */
export function blendMaskOntoImageData(imageData, mask, color) {
    const newImageData = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
    );

    const maskData = mask.data;
    const widthRatio = mask.width / imageData.width;
    const heightRatio = mask.height / imageData.height;

    for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
            const targetIndex = y * imageData.width + x;

            const maskX = Math.floor(x * widthRatio);
            const maskY = Math.floor(y * heightRatio);
            const maskIndex = maskY * mask.width + maskX;

            if (maskData[maskIndex] === 1) {
                const a = color[3] / 255;
                const a_ = 1 - a;
                const i4 = targetIndex * 4;
                newImageData.data[i4] =
                    newImageData.data[i4] * a_ + color[0] * a;
                newImageData.data[i4 + 1] =
                    newImageData.data[i4 + 1] * a_ + color[1] * a;
                newImageData.data[i4 + 2] =
                    newImageData.data[i4 + 2] * a_ + color[2] * a;
            }
        }
    }
    return newImageData;
}
