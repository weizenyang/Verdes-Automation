const fs = require('fs');
const path = require('path');

// ---------- CONFIGURATION ----------
const INPUT_DIR = "./input";        // Directory containing CSV files to process
const OUTPUT_DIR = "./output";  // Directory to write processed CSV files

// Ensure the output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ---------- Main Processing ----------
fs.readdir(INPUT_DIR, (err, files) => {
  if (err) {
    console.error("Error reading input directory:", err);
    process.exit(1);
  }
  files.forEach(file => {
    if (path.extname(file).toLowerCase() === '.csv') {
      const inputFilePath = path.join(INPUT_DIR, file);
      const outputFilePath = path.join(OUTPUT_DIR, file);
      fs.readFile(inputFilePath, 'utf8', (err, data) => {
        if (err) {
          console.error(`Error reading file ${inputFilePath}:`, err);
          return;
        }
        // Split into lines
        const lines = data.split(/\r?\n/);
        // Process each line by splitting on comma and removing spaces from each cell
        const processedLines = lines.map(line => {
          // Skip empty lines
          if (!line) return line;
          // For a robust CSV parser you might use a library. Here we assume simple comma-delimited values.
          const cells = line.split(',').map(cell => cell.replace(/ /g, ''));
          return cells.join(',');
        });
        const outputData = processedLines.join('\n');
        fs.writeFile(outputFilePath, outputData, 'utf8', err => {
          if (err) {
            console.error(`Error writing file ${outputFilePath}:`, err);
          } else {
            console.log(`Processed file: ${file}`);
          }
        });
      });
    }
  });
});
