
const fs = require('fs')
const path = require('path')

const inputPath = "./360 image rotated/Camera CSV Z Offset"
const outputPath = "./360 image rotated/Viewconfig CSV"


function csvOperation(filePath, outputFilePath) {
    try {
        // Read the CSV file content
        const data = fs.readFileSync(filePath, 'utf8');

        // Split the file content into rows
        const rows = data.trim().split('\n');

        // Iterate over each row and split it into columns
        for (let i = 0; i < rows.length; i++) {
            const columns = rows[i].split(',');

            // Extract x, y, z from indices 4, 5, and 6 (as floats)
            const x = parseFloat(columns[4].trim());
            const y = parseFloat(columns[5].trim());
            const z = parseFloat(columns[6].trim());

            // Use the convertRotation function to get the new rotation
            const rotation = convertRotation(path.basename(filePath), columns[0], x, y, z, false);

            // Replace x, y, z values in the CSV with converted rotation if applicable
            if (rotation) {
                columns[4] = rotation.X.toFixed(1); // Keeping the same decimal precision
                columns[5] = rotation.Y.toFixed(1);
                columns[6] = rotation.Z.toFixed(1);

                // Update the row with the new data
                rows[i] = columns.join(',');
                console.log(`Row updated: ${path.basename(filePath)} ${rows[i].split(",")[0]}`);
            }
        }

        // Join the rows back into a single string and write to the output file
        const updatedCSV = rows.join('\n');

        try {
            fs.writeFileSync(outputFilePath, updatedCSV, 'utf8');
        } catch (e) {
            console.log('Error Writing: ' + e);
        }
    } catch (error) {
        console.error('Error reading, editing, or writing CSV:', error);
    }
}

function convertRotation(filename, cameraName, x, y, z, flip) {
    const converted = { X: 0, Y: 0, Z: 0 };
    const roundingMargin = 20;

    // Helper function to compare floating-point numbers with a margin of error
    function isCloseTo(value, target, margin) {
        return Math.abs(value - target) <= margin;
    }

    // -90 0 0 = Y: 0
    if (isCloseTo(x, -90, roundingMargin) && isCloseTo(y, 0, roundingMargin) && isCloseTo(z, 0, roundingMargin)) {
        converted.X = 0;
        converted.Y = 0;
        converted.Z = 0;
    }
    // 90 90 180 = Y: 0 - need to verify
    else if (isCloseTo(x, 90, roundingMargin) && isCloseTo(y, 90, roundingMargin) && isCloseTo(z, 180, roundingMargin)) {
        converted.X = 0;
        converted.Y = 0;
        converted.Z = 0;
    }
    // -90 90 0 = Y: 90
    else if (isCloseTo(x, -90, roundingMargin) && isCloseTo(y, 90, roundingMargin) && isCloseTo(z, 0, roundingMargin)) {
        converted.X = 0;
        converted.Y = !flip ? 90 : -90;
        converted.Z = 0;
    }
    // 90 90 -180 = Y: 90
    else if (isCloseTo(x, 90, roundingMargin) && isCloseTo(y, 90, roundingMargin) && isCloseTo(z, -180, roundingMargin)) {
        converted.X = 0;
        converted.Y = !flip ? 90 : -90;
        converted.Z = 0;
    }
    // 90 0 180 = Y: 180
    else if (isCloseTo(x, 90, roundingMargin) && isCloseTo(y, 0, roundingMargin) && isCloseTo(z, 180, roundingMargin)) {
        converted.X = 0;
        converted.Y = 180;
        converted.Z = 0;
    }
    // 90 0 -180 = Y: 180
    else if (isCloseTo(x, 90, roundingMargin) && isCloseTo(y, 0, roundingMargin) && isCloseTo(z, -180, roundingMargin)) {
        converted.X = 0;
        converted.Y = 180;
        converted.Z = 0;
    }
    // -90 -90 0 = Y: -90
    else if (isCloseTo(x, -90, roundingMargin) && isCloseTo(y, -90, roundingMargin) && isCloseTo(z, 0, roundingMargin)) {
        converted.X = 0;
        converted.Y = !flip ? -90 : 90;
        converted.Z = 0;
    }
    // -90 90 180 = Y: -90 - need to verify
    else if (isCloseTo(x, 90, roundingMargin) && isCloseTo(y, -90, roundingMargin) && isCloseTo(z, 180, roundingMargin)) {
        converted.X = 0;
        converted.Y = !flip ? -90 : 90;
        converted.Z = 0;
    }
    // No recognized combination
    else {
        console.log('CameraRotationConversionError', 
            `Convert Rotation - No recognized combination: x:${x}, y:${y}, z:${z}. Filename:${filename}. Camera Name:${cameraName}`);
    }

    return converted;
}

const files = fs.readdirSync(inputPath)
files.forEach((e) => {
    csvOperation(path.join(inputPath, e), path.join(outputPath, e));
})


