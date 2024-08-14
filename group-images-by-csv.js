const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Function to group files based on CSV input
function groupFilesByCSV(csvFilePath, inputDirectoryPath, outputDirectoryPath) {
  const groups = {};

  // Check if the input directory exists
  if (!fs.existsSync(inputDirectoryPath)) {
    console.error(`Input directory does not exist: ${inputDirectoryPath}`);
    return;
  }

  // Check if the output directory exists, create if it doesn't
  if (!fs.existsSync(outputDirectoryPath)) {
    fs.mkdirSync(outputDirectoryPath, { recursive: true });
  }

  // Read the CSV file
  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (row) => {
      const nameToSearch = Object.values(row)[0].replace(/[-_]/g, '');
      const groupName = Object.values(row)[1];

      // Initialize the group list if it doesn't exist
      if (!groups[groupName]) {
        groups[groupName] = [];
      }

      // Search the input directory for files containing the nameToSearch
      fs.readdirSync(inputDirectoryPath).forEach((filename) => {
        const sanitizedFilename = filename.replace(/[-_]/g, '');
        if (sanitizedFilename.includes(nameToSearch)) {
          groups[groupName].push(filename);
          console.log(sanitizedFilename + "" + nameToSearch)
        } else {
            // console.log(sanitizedFilename + "" + nameToSearch)
        }
      });
    })
    .on('end', () => {
      // Create directories and move files
      for (const group in groups) {
        const groupDir = path.join(outputDirectoryPath, group);

        // Create the group directory if it doesn't exist
        if (!fs.existsSync(groupDir)) {
          fs.mkdirSync(groupDir);
        }

        // Move the files to the group directory
        groups[group].forEach((file) => {
          if(file.includes("r10")){
            const oldPath = path.join(inputDirectoryPath, file);
            const newPath = path.join(groupDir, file);
            fs.renameSync(oldPath, newPath);
          }

        });
      }

      console.log('File grouping and moving completed.');
    });
}


// Usage
const csvFilePath = './Arthouse/art_input.csv';
const directoryPath = './Arthouse/floorplan/plans';  // Replace with the actual directory path
const outputPath = './Arthouse/floorplan/segmented - distinct/Unit Name';

groupFilesByCSV(csvFilePath, directoryPath, outputPath);