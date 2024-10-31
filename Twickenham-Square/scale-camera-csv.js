const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const dirname = "./360 image rotated/Camera CSV"

const files = fs.readdirSync(dirname)


// Function to scale down positions
function scalePositions(row) {
    row[1] = (parseFloat(row[1]) / 10).toFixed(4); // Scale x position
    row[2] = (parseFloat(row[2]) / 10).toFixed(4); // Scale y position
    row[3] = (parseFloat(row[3]) / 10).toFixed(4); // Scale z position
    return row;
}
// Input and output paths

files.forEach((e) => {
    const filename = e.split(".")[0]
    const inputFilePath = path.join(dirname, filename + '.csv');  // Replace 'input.csv' with the actual file name if different
    const outputFilePath = path.join(dirname, filename + "_scaled" + '.csv');  // This will save the corrected file as 'output.csv'
    if(fs.existsSync(inputFilePath)){
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
    }


})




