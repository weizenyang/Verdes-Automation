const { rotateEquirectangularImage } = require('./rotate-360-gpu.js');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

const cameraCSVDir = "./Camera CSV";

// Walk function to read files in a directory recursively
async function walk(dir) {
    let results = [];
    const list = await readdir(dir);
    const pending = list.map(async (file) => {
        const filePath = path.resolve(dir, file);
        const fileStat = await stat(filePath);
        if (fileStat.isDirectory()) {
            const res = await walk(filePath);
            results = results.concat(res);
        } else {
            results.push(filePath);
        }
    });
    await Promise.all(pending);
    return results;
}

// Synchronous function to find a row by the name in the first column
async function findRowByNameSync(filePath, targetName) {
    try {
        // Read the file content synchronously
        const data = await readFile(filePath, 'utf8');

        // Split the file content into rows
        const rows = data.trim().split('\n');

        // Iterate over each row and split it into columns
        for (const row of rows) {
            const columns = row.split(',');

            if (columns[0].trim().toLowerCase() === targetName.toLowerCase()) {
                console.log(`Row found: ${row}`);
                return columns;
            }
        }

        console.log(`No row found with name: ${targetName}`);
        return null;
    } catch (error) {
        console.error('Error reading or parsing CSV:', error);
        return null;
    }
}

// Main function to run the process concurrently
async function processFiles() {
    try {
        const cameraCSVfiles = await readdir(cameraCSVDir);
        const imageFiles = await walk("./360 image rotated");

        const promises = imageFiles.map(async (e) => {
            if (!path.basename(e).toLowerCase().includes('example')) {
                const fullname = path.basename(e).split(".")[0].split("_");
                const typename = path.basename(e).split("_").slice(3, 8).join("_");
                const roomname = fullname.slice(8).join("_");
                const filteredCSVFile = cameraCSVfiles.filter((file) => file.includes(typename));
                
                if (filteredCSVFile.length > 0) {
                    const result = await findRowByNameSync(path.join(cameraCSVDir, filteredCSVFile[0]), roomname);
                    
                    if (result && (result[5] % 90) !== 0 && (result[5] % 90) !== -0) {
                        const outputFilePath = `${e.split(".")[0]}_rotated.${e.split(".")[1]}`;
                        await rotateEquirectangularImage(e, outputFilePath, 0, 0, parseFloat(result[5]));
                        console.log('Rotation complete:', outputFilePath);
                    }
                }
            }
        });

        // Run all the promises concurrently
        await Promise.all(promises);
        console.log('All files processed concurrently');
    } catch (error) {
        console.error('Error processing files:', error);
    }
}

// Run the main function
processFiles();