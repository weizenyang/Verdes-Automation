const sharp = require('sharp');
const math = require('mathjs');
const fs = require('fs');

function eulerToRotationMatrix(roll, pitch, yaw) {
    const rollRad = roll * Math.PI / 180;
    const pitchRad = pitch * Math.PI / 180;
    const yawRad = yaw * Math.PI / 180;

    const R_x = math.matrix([
        [1, 0, 0],
        [0, Math.cos(rollRad), -Math.sin(rollRad)],
        [0, Math.sin(rollRad), Math.cos(rollRad)]
    ]);

    const R_y = math.matrix([
        [Math.cos(pitchRad), 0, Math.sin(pitchRad)],
        [0, 1, 0],
        [-Math.sin(pitchRad), 0, Math.cos(pitchRad)]
    ]);

    const R_z = math.matrix([
        [Math.cos(yawRad), -Math.sin(yawRad), 0],
        [Math.sin(yawRad), Math.cos(yawRad), 0],
        [0, 0, 1]
    ]);

    // R = Rz * Ry * Rx
    return math.multiply(R_z, math.multiply(R_y, R_x));
}

function rotatePixel(pixel, rotMat, width, height) {
    const theta = Math.PI * pixel[0] / height;
    const phi = 2 * Math.PI * pixel[1] / width;

    const vecCartesian = [
        -Math.sin(theta) * Math.cos(phi),
        Math.sin(theta) * Math.sin(phi),
        Math.cos(theta)
    ];

    const vecRotated = math.multiply(rotMat, vecCartesian).valueOf();

    const newTheta = Math.acos(vecRotated[2]);
    let newPhi = Math.atan2(vecRotated[1], -vecRotated[0]);
    if (newPhi < 0) newPhi += 2 * Math.PI;

    const newPixel = [
        Math.floor(height * newTheta / Math.PI),
        Math.floor(width * newPhi / (2 * Math.PI))
    ];

    return newPixel;
}

async function rotateEquirectangularImage(inputPath, outputPath, roll, pitch, yaw) {
    const { data, info } = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;

    const outputBuffer = Buffer.alloc(width * height * channels);
    const rotMat = eulerToRotationMatrix(roll, pitch, yaw);

    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const [originI, originJ] = rotatePixel([i, j], rotMat, width, height);

            if (originI >= 0 && originI < height && originJ >= 0 && originJ < width) {
                const srcIndex = (originI * width + originJ) * channels;
                const destIndex = (i * width + j) * channels;

                for (let c = 0; c < channels; c++) {
                    outputBuffer[destIndex + c] = data[srcIndex + c];
                }
            }
        }
    }

    await sharp(outputBuffer, {
        raw: {
            width: width,
            height: height,
            channels: channels
        }
    }).toFile(outputPath);

    console.log(`Rotated image saved to ${outputPath}`);
}

// // Example usage
// rotateEquirectangularImage('360 test.jpg', '360 test - rotated.jpg', 0, 0, 90)
//     .then(() => console.log('Rotation complete'))
//     .catch(err => console.error('Error rotating image:', err));

module.exports = {rotateEquirectangularImage}