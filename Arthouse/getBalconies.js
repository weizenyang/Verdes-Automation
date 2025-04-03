const fs = require('fs');
const path = require('path');

// Change this to your root directory containing the type subfolders
const ROOT_DIR = './floorplan/segmented - distinct/Unit Name - More Types Merged 2'; 
const OUTPUT_CSV = 'output.csv';

// Prepare CSV header
const csvLines = [];
csvLines.push('Unit Name,Type Name,Unique Type Separation?');

// Regular expression to capture "Unit Name" and "Unique Type Separation"
// Assumes filenames like: UnitName [UniqueType].ext
const regex = /^(.*?)\s*\[(.*?)\]/;

function processDirectory(rootDir) {
  // Get all items in the root directory
  const items = fs.readdirSync(rootDir, { withFileTypes: true });
  
  items.forEach(item => {
    if (item.isDirectory()) {
      // This folder name is treated as the "Type Name"
      const typeName = item.name;
      const subfolderPath = path.join(rootDir, typeName);
      
      // Read all files in the subfolder
      const files = fs.readdirSync(subfolderPath, { withFileTypes: true });
      files.forEach(file => {
        if (file.isFile()) {
          const fileName = file.name;
          // Match against the expected filename pattern
          const match = fileName.match(regex);
          if (match) {
            const unitName = match[1].trim();
            const uniqueType = match[2].trim();
            // Wrap fields in quotes to handle commas within names
            csvLines.push(`"${unitName}","${typeName}","${uniqueType}"`);
          } else {
            console.warn(`Could not parse filename: ${fileName}`);
          }
        }
      });
    }
  });
}

// Process the directory
processDirectory(ROOT_DIR);

// Write the CSV content to file (or you could log it to the console)
const csvContent = csvLines.join('\n');
fs.writeFileSync(OUTPUT_CSV, csvContent, 'utf8');

console.log(`CSV file has been generated at: ${OUTPUT_CSV}`);
