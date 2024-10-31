const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const dirname = "./camera csv"
// Input and output paths
const inputFilePath = path.join(dirname, 'csv_camera_v_s_6b_a_s1.csv');  // Replace 'input.csv' with the actual file name if different
const outputFilePath = path.join(dirname, 'csv_camera_v_s_6b_a_s1_2.csv');  // This will save the corrected file as 'output.csv'

// Function to scale down positions
function scalePositions(row) {
    row[1] = (parseFloat(row[1]) / 10).toFixed(4); // Scale x position
    row[2] = (parseFloat(row[2]) / 10).toFixed(4); // Scale y position
    row[3] = (parseFloat(row[3]) / 10).toFixed(4); // Scale z position
    return row;
}

// Read, process, and write the CSV
fs.createReadStream(inputFilePath)
    .pipe(csv.parse({ headers: false }))
    .transform(scalePositions)
    .pipe(csv.format({ headers: false }))
    .pipe(fs.createWriteStream(outputFilePath))
    .on('end', () => {
        console.log('File has been processed and saved as output.csv');
    })
    .on('error', (error) => {
        console.error('Error processing the file:', error);
    });