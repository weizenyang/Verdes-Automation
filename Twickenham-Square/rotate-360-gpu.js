const sharp = require('sharp');
const math = require('mathjs');
const { GPU } = require('gpu.js');

function eulerToRotationMatrix(roll, pitch, yaw) {
    const rollRad = roll * Math.PI / 180;
    const pitchRad = pitch * Math.PI / 180;
    const yawRad = yaw * Math.PI / 180;

    const R_x = [
        [1, 0, 0],
        [0, Math.cos(rollRad), -Math.sin(rollRad)],
        [0, Math.sin(rollRad), Math.cos(rollRad)]
    ];

    const R_y = [
        [Math.cos(pitchRad), 0, Math.sin(pitchRad)],
        [0, 1, 0],
        [-Math.sin(pitchRad), 0, Math.cos(pitchRad)]
    ];

    const R_z = [
        [Math.cos(yawRad), -Math.sin(yawRad), 0],
        [Math.sin(yawRad), Math.cos(yawRad), 0],
        [0, 0, 1]
    ];

    const R = math.multiply(math.multiply(R_z, R_y), R_x);
    const R_flat = R.valueOf().flat();
    return R_flat;
}

function normalizeData(data) {
    const normalizedData = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
        normalizedData[i] = data[i] / 255;
    }
    return normalizedData;
}

async function rotateEquirectangularImage(inputPath, outputPath, roll, pitch, yaw) {
    try {
        const { data, info } = await sharp(inputPath)
            .raw()
            .toBuffer({ resolveWithObject: true });
        const { width, height, channels } = info;

        const rotMat = eulerToRotationMatrix(roll, pitch, yaw);
        if (!rotMat || rotMat.length !== 9) {
            console.error('Invalid rotation matrix:', rotMat);
            return;
        }

        const normalizedData = normalizeData(data);
        if (!normalizedData || normalizedData.length !== width * height * channels) {
            console.error('Invalid normalized data.');
            return;
        }

        console.log('rotMat:', rotMat);
        console.log('rotMat length:', rotMat.length);
        console.log('normalizedData length:', normalizedData.length);

        // Use CPU mode for debugging
        const gpu = new GPU({ mode: 'cpu' });

        const kernel = gpu
            .createKernel(function (data, rotMat) {
                // Access constants directly in CPU mode
                const width = this.constants.width;
                const height = this.constants.height;
                const channels = this.constants.channels;

                const x = this.thread.x;
                const y = this.thread.y;
                const c = this.thread.z;

                const theta = Math.PI * y / height;
                const phi = 2 * Math.PI * x / width;

                const sinTheta = Math.sin(theta);
                const cosTheta = Math.cos(theta);
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);

                const vecCartesian0 = -sinTheta * cosPhi;
                const vecCartesian1 = sinTheta * sinPhi;
                const vecCartesian2 = cosTheta;

                const vecRotated0 =
                    rotMat[0] * vecCartesian0 +
                    rotMat[1] * vecCartesian1 +
                    rotMat[2] * vecCartesian2;
                const vecRotated1 =
                    rotMat[3] * vecCartesian0 +
                    rotMat[4] * vecCartesian1 +
                    rotMat[5] * vecCartesian2;
                const vecRotated2 =
                    rotMat[6] * vecCartesian0 +
                    rotMat[7] * vecCartesian1 +
                    rotMat[8] * vecCartesian2;

                let newTheta = Math.acos(vecRotated2);
                let newPhi = Math.atan2(vecRotated1, -vecRotated0);
                if (newPhi < 0) newPhi += 2 * Math.PI;

                const originY = Math.floor((height * newTheta) / Math.PI);
                const originX = Math.floor((width * newPhi) / (2 * Math.PI));

                if (
                    originX >= 0 &&
                    originX < width &&
                    originY >= 0 &&
                    originY < height
                ) {
                    const index = (originY * width + originX) * channels + c;
                    return data[index];
                } else {
                    return 0;
                }
            })
            .setOutput([width, height, channels])
            .setConstants({ width, height, channels })
            .setPipeline(true);

        const outputTexture = kernel(normalizedData, rotMat);
        const outputArray = outputTexture.toArray();

        console.log('Output array structure:', Array.isArray(outputArray), outputArray.length);

        // Deep inspection of the output array to identify undefined parts
        if (outputArray.length !== height) {
            console.error(`Unexpected height in output array: ${outputArray.length} vs expected ${height}`);
        }

        for (let y = 0; y < height; y++) {
            if (!Array.isArray(outputArray[y])) {
                console.error(`Invalid row at ${y}: Expected array, got ${typeof outputArray[y]}`);
                continue;
            }
            if (outputArray[y].length !== width) {
                console.error(`Unexpected width in row ${y}: ${outputArray[y].length} vs expected ${width}`);
            }
            for (let x = 0; x < width; x++) {
                if (!Array.isArray(outputArray[y][x])) {
                    console.error(`Invalid pixel at (${y}, ${x}): Expected array, got ${typeof outputArray[y][x]}`);
                    continue;
                }
                if (outputArray[y][x].length !== channels) {
                    console.error(`Unexpected channel count at (${y}, ${x}): ${outputArray[y][x].length} vs expected ${channels}`);
                }
            }
        }

        // Flatten the output array
        function flattenOutput(output, width, height, channels) {
            const size = width * height * channels;
            const flatOutput = Buffer.alloc(size);
            let index = 0;

            // Safe access with validation
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    for (let c = 0; c < channels; c++) {
                        const value = output[y]?.[x]?.[c];
                        if (value === undefined) {
                            console.error(`Undefined value at (${y}, ${x}, ${c})`);
                            flatOutput[index++] = 0;  // Default to 0 if value is missing
                        } else {
                            let normalizedValue = value * 255;
                            if (normalizedValue > 255) normalizedValue = 255;
                            if (normalizedValue < 0) normalizedValue = 0;
                            flatOutput[index++] = Math.round(normalizedValue);
                        }
                    }
                }
            }
            return flatOutput;
        }

        const flatOutput = flattenOutput(outputArray, width, height, channels);

        await sharp(flatOutput, {
            raw: {
                width: width,
                height: height,
                channels: channels,
            },
        }).toFile(outputPath);

        console.log(`Rotated image saved to ${outputPath}`);
    } catch (error) {
        console.error('Error rotating image:', error);
    }
}

// Example usage
rotateEquirectangularImage('360 test.jpg', '360_test_rotated.jpg', 0, 0, 90)
    .then(() => console.log('Rotation complete'))
    .catch((err) => console.error('Error rotating image:', err));

module.exports = { rotateEquirectangularImage };