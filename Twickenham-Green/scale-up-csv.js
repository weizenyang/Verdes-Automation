const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');

// Directories
// const inputDirectoryPath = './Arthouse/floorplan/Unit matched types/NEW/S1/csv';  // Replace with the actual input directory path
// const outputDirectoryPath = './Arthouse/floorplan/Unit matched types/NEW/S1/CSV Scaled'; // Replace with the actual output directory path
const inputDirectoryPath = './Floorplan CSV';
const outputDirectoryPath = './Floorplan CSV';

// Constants for scaling
const canvasSize = 4096;
const scaleUpBy = 250;
const scaleFactor = (canvasSize + 2 * scaleUpBy) / canvasSize;

// Ensure the output directory exists
if (!fs.existsSync(outputDirectoryPath)) {
  fs.mkdirSync(outputDirectoryPath, { recursive: true });
}

// Function to scale up positions in the CSV from canvas center
const scaleUpCsv = (inputPath, outputPath, scaleFactor) => {
  const rows = [];

  fs.createReadStream(inputPath)
    .pipe(csv.parse({ headers: false }))
    .on('data', (row) => {
      const tagName = row[0];
      const yPos = (parseFloat(row[1]) - canvasSize / 2) * scaleFactor + canvasSize / 2;
      const xPos = (parseFloat(row[2]) - canvasSize / 2) * scaleFactor + canvasSize / 2;
      rows.push([tagName, yPos, xPos]);
    })
    .on('end', () => {
      const writeStream = fs.createWriteStream(outputPath);
      csv.write(rows, { headers: false }).pipe(writeStream);
      console.log(`File ${inputPath} has been scaled up and saved as ${outputPath}`);
    });
};

// Function to process all CSV files in the input directory
const processDirectory = (inputDir, outputDir, scaleFactor) => {
  fs.readdir(inputDir, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return;
    }

    files.forEach(file => {
      const inputFilePath = path.join(inputDir, file);
      const outputFilePath = path.join(outputDir, path.basename(file, '.csv') + '_scaled.csv');
      if (path.extname(file).toLowerCase() === '.csv') {
        scaleUpCsv(inputFilePath, outputFilePath, scaleFactor);
      }
    });
  });
};

// Process all CSV files in the input directory
processDirectory(inputDirectoryPath, outputDirectoryPath, scaleFactor);
