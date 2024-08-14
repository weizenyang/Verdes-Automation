const fs = require('fs');
const path = require('path');

// Function to group files based on JSON input
function groupFilesByJSON(jsonFilePath, inputDirectoryPath, outputDirectoryPath) {
  // Check if the input directory exists
  if (!fs.existsSync(inputDirectoryPath)) {
    console.error(`Input directory does not exist: ${inputDirectoryPath}`);
    return;
  }

  // Check if the output directory exists, create if it doesn't
  if (!fs.existsSync(outputDirectoryPath)) {
    fs.mkdirSync(outputDirectoryPath, { recursive: true });
  }

  // Read the JSON file
  fs.readFile(jsonFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading JSON file: ${err}`);
      return;
    }

    const jsonData = JSON.parse(data);
    const results = jsonData.results;
    const groups = {};

    // Iterate over each item in the JSON
    results.forEach(item => {
      const nameToSearch = item.aldar_unit_number.toLowerCase().replace(/[-_]/g, '');
      const groupName = `${item.unit_category}_${item.mirror}`;
      console.log(groupName);
      
      // Initialize the group list if it doesn't exist
      if (!groups[groupName]) {
        groups[groupName] = [];
      }

      // Search the input directory for files containing the nameToSearch
      fs.readdirSync(inputDirectoryPath).forEach((filename) => {
        const sanitizedFilename = filename.toLowerCase().replace(/[-_]/g, '');
        if (sanitizedFilename.includes(nameToSearch)) {
          groups[groupName].push(filename);
        }
      });
    });

    // Create directories and move files
    for (const group in groups) {
      if (groups[group].length > 0) {
        const groupDir = path.join(outputDirectoryPath, group);

        // Create the group directory if it doesn't exist
        if (!fs.existsSync(groupDir)) {
          fs.mkdirSync(groupDir);
        }

        // // Move and rename the files to the group directory
        // groups[group].forEach((file, index) => {
        //   const oldPath = path.join(inputDirectoryPath, file);
        //   const newFileName = groups[group].length > 1 ? `${group}_b${index + 1}${path.extname(file)}` : `${group}${path.extname(file)}`;
        //   const newPath = path.join(groupDir, newFileName);
        //   fs.copyFileSync(oldPath, newPath);
        // });

        // Move and rename the files to the group directory
        groups[group].forEach((file, index) => {
          const oldPath = path.join(inputDirectoryPath, file);
          const newFileName = groups[group].length > 1 ? `${group}_b${index + 1}${path.extname(file)}` : `${group}${path.extname(file)}`;
          const newPath = path.join(groupDir, file);
          fs.renameSync(oldPath, newPath);
        });
      }
    }

    console.log('File grouping, moving, and renaming completed.');
  });
}


// Usage
const jsonFilePath = './Arthouse/response.json';
const inputDirectoryPath = './Arthouse/floorplan/plans/SVG Cutouts';  // Replace with the actual directory path
const outputDirectoryPath = './Arthouse/floorplan/segmented - distinct/Untouched';

groupFilesByJSON(jsonFilePath, inputDirectoryPath, outputDirectoryPath);