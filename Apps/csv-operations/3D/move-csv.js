// process-csv.js
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const createCsvWriter = require('csv-writer').createArrayCsvWriter;

// Define input and output directories
const inputDir = path.join(__dirname, 'input');
const outputDir = path.join(__dirname, 'output');

let xOffset = 0
let yOffset = 0

// Create the output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Read all files from the input directory
fs.readdir(inputDir, (err, files) => {
  if (err) {
    console.error(`Error reading input directory (${inputDir}):`, err);
    return;
  }

  // Filter for CSV files
  const csvFiles = files.filter(file => path.extname(file).toLowerCase() === '.csv');
  if (csvFiles.length === 0) {
    console.log(`No CSV files found in ${inputDir}`);
    return;
  }

  // Process each CSV file
  csvFiles.forEach((file) => {
    const inputFilePath = path.join(inputDir, file);
    const outputFilePath = path.join(outputDir, file);
    const rows = [];

    // Parse the CSV file. We set headers to false so we expect arrays,
    // but we'll add a check in case an object is returned.
    fs.createReadStream(inputFilePath)
      .pipe(csvParser({ headers: false }))
      .on('data', (row) => {
        // If the row is not an array, convert it to one.
        if (!Array.isArray(row)) {
          row = Object.values(row);
        }

        if(row[0].toLowerCase().includes("anchorpoint")){
          xOffset = row[1].toFixed(2)
          yOffset = row[2].toFixed(2)
        }

        // // Scale down columns 1, 2, and 3 (i.e., the 2nd, 3rd, and 4th columns)
        // [1, 2, 3].forEach(index => {
        //   if (row[index] !== undefined && !isNaN(row[index] && index == 1)) {
        //     row[index] = Number(row[index]) / 10;
        //   }
        // });

        // rows.push(row);
      })
      .on('end', () => {
        // Write the processed rows to the output CSV file.
        const csvWriter = createCsvWriter({
          path: outputFilePath,
          header: [] // No header row will be written.
        });

        csvWriter.writeRecords(rows)
          .then(() => {
            console.log(`Processed ${file} and saved to ${outputFilePath}`);
          })
          .catch((err) => {
            console.error(`Error writing file ${outputFilePath}:`, err);
          });
      })
      .on('error', (err) => {
        console.error(`Error processing file ${inputFilePath}:`, err);
      });
  });
});
