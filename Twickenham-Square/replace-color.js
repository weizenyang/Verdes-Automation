const sharp = require('sharp');

/**
 * Check if a pixel color is within the tolerance range of the target color.
 * @param {Array} pixel - [r, g, b] of the pixel.
 * @param {Array} targetColor - [r, g, b] of the target color to replace.
 * @param {number} tolerance - Tolerance level for color matching.
 * @returns {boolean} - True if the pixel is within the tolerance range, false otherwise.
 */
function isWithinTolerance(pixel, targetColor, tolerance) {
    return Math.abs(pixel[0] - targetColor[0]) <= tolerance &&
           Math.abs(pixel[1] - targetColor[1]) <= tolerance &&
           Math.abs(pixel[2] - targetColor[2]) <= tolerance;
}

/**
 * Replace a color in an image with a specified tolerance using Sharp.js.
 * @param {string} inputPath - Path to the input image.
 * @param {string} outputPath - Path to save the modified image.
 * @param {Array} targetColor - [r, g, b] color to be replaced.
 * @param {Array} replaceColor - [r, g, b] color to replace with.
 * @param {number} tolerance - Tolerance level for color matching.
 */
async function replaceColorWithTolerance(inputPath, outputPath, targetColor, replaceColor, tolerance) {
    try {
        // Read the image as raw data
        const { data, info } = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
        const { width, height, channels } = info;

        // Create a new buffer for the output image
        const outputBuffer = Buffer.from(data);

        // Iterate over each pixel
        for (let i = 0; i < data.length; i += channels) {
            const pixel = [data[i], data[i + 1], data[i + 2]]; // [r, g, b]

            // Check if the pixel color is within tolerance
            if (isWithinTolerance(pixel, targetColor, tolerance)) {
                outputBuffer[i] = replaceColor[0]; // Replace red channel
                outputBuffer[i + 1] = replaceColor[1]; // Replace green channel
                outputBuffer[i + 2] = replaceColor[2]; // Replace blue channel
            }
        }

        // Write the modified data back to an image
        await sharp(outputBuffer, {
            raw: {
                width: width,
                height: height,
                channels: channels,
            }
        }).toFile(outputPath);

        console.log(`Image saved to ${outputPath} with color replaced.`);
    } catch (error) {
        console.error('Error processing the image:', error);
    }
}

module.exports = {replaceColorWithTolerance}

// // Example usage
// const inputPath = 'input.png';
// const outputPath = 'output.png';
// const targetColor = [255, 0, 0]; // Color to replace (red)
// const replaceColor = [0, 255, 0]; // New color (green)
// const tolerance = 50; // Tolerance level

// replaceColorWithTolerance(inputPath, outputPath, targetColor, replaceColor, tolerance);