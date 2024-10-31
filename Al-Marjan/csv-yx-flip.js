const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');

// Function to recursively walk through directories synchronously and gather all CSV files
const walkSync = (dir) => {
    let files = [];
    fs.readdirSync(dir).forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            files = files.concat(walkSync(filePath));
        } else if (path.extname(file).toLowerCase() === '.csv') {
            files.push(filePath);
        }
    });
    return files;
};

// Function to flip X and Y positions in the CSV file and write to the new path, preserving subfolder structure
const YXFlipSync = (inputPath, outputPath) => {
    const rows = [];
    const fileContent = fs.readFileSync(inputPath, 'utf8'); // Read the CSV file content synchronously
    
    csv.parseString(fileContent, { headers: false })
        .on('data', (row) => {
            const tagName = row[0];
            const xPosFlipped = parseFloat(row[1]);
            const yPosFlipped = parseFloat(row[2]);
            rows.push([tagName, yPosFlipped, xPosFlipped]); // Swap X and Y positions
        })
        .on('end', () => {
            // Create CSV output stream
            const csvOutput = csv.format({ headers: false });
            const writeStream = fs.createWriteStream(outputPath);

            // Write rows to the CSV stream
            rows.forEach((row) => csvOutput.write(row));
            
            // Pipe the CSV output to the write stream
            csvOutput.pipe(writeStream);
            
            // Ensure we only call `.end()` after piping the data to avoid the "write after end" error
            csvOutput.end();
            
            console.log(`File ${inputPath} has been processed and saved to ${outputPath}`);
        });
};

// Main function to process all CSV files in the input directory
const processCSVFiles = (inputDir, outputDir) => {
    const csvFiles = walkSync(inputDir);
    
    csvFiles.forEach((inputFile) => {
        // Determine the relative path of the input file with respect to the input directory
        const relativePath = path.relative(inputDir, inputFile);
        
        // Create the corresponding output file path
        const outputFile = path.join(outputDir, relativePath);
        
        // Ensure the necessary subdirectories exist
        const outputDirForFile = path.dirname(outputFile);
        if (!fs.existsSync(outputDirForFile)) {
            fs.mkdirSync(outputDirForFile, { recursive: true });
        }

        // Process the CSV file (flip X and Y positions)
        YXFlipSync(inputFile, outputFile);
    });
};

// Directories
const inputDirectoryPath = './CSV/Source';
const outputDirectoryPath = './CSV/YX Flipped';

// Process all CSV files in the input directory
processCSVFiles(inputDirectoryPath, outputDirectoryPath);
