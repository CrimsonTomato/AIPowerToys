/**
 * Calculates the dimensions and position to draw an image within a canvas
 * while maintaining its aspect ratio ('contain' style).
 * @param {number} canvasWidth - The width of the canvas.
 * @param {number} canvasHeight - The height of the canvas.
 * @param {number} imageWidth - The width of the source image.
 * @param {number} imageHeight - The height of the source image.
 * @returns {{x: number, y: number, width: number, height: number}} The destination drawing parameters.
 */
export function getContainSize(
    canvasWidth,
    canvasHeight,
    imageWidth,
    imageHeight
) {
    const canvasRatio = canvasWidth / canvasHeight;
    const imageRatio = imageWidth / imageHeight;
    let destWidth, destHeight;

    if (imageRatio > canvasRatio) {
        destWidth = canvasWidth;
        destHeight = destWidth / imageRatio;
    } else {
        destHeight = canvasHeight;
        destWidth = destHeight * imageRatio;
    }

    const destX = (canvasWidth - destWidth) / 2;
    const destY = (canvasHeight - destHeight) / 2;

    return { x: destX, y: destY, width: destWidth, height: destHeight };
}
