const { rotateEquirectangularImage } = require('./rotate-360.js');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const cliProgress = require('cli-progress');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

const cameraCSVDir = "./Camera CSV/Scaled";
const inputDirName  = "./360 image";
const outputDirName  = "./360 image rotated";

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
        const data = await readFile(filePath, 'utf8');
        const rows = data.trim().split('\n');

        for (const row of rows) {
            const columns = row.split(',');

            if (columns[0].trim().toLowerCase() === targetName.toLowerCase()) {
                // console.log(`Row found: ${row}`);
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

function findRowAndEditByNameSync(filePath, targetName, newRowData) {
    try {


        // Read the CSV file content
        const data = fs.readFileSync(filePath, 'utf8');

        // Split the file content into rows
        const rows = data.trim().split('\n');

        // Flag to track if a row was edited
        let rowEdited = false;

        // Iterate over each row and split it into columns
        for (let i = 0; i < rows.length; i++) {
            const columns = rows[i].split(',');

            // Check if the first column matches the target name
            if (columns[0].trim().toLowerCase() === targetName.toLowerCase()) {
                // console.log(`Row found: ${rows[i]}`);

                // Replace the entire row with the new data
                rows[i] = newRowData.join(',');

                console.log(`Row updated: ${rows[i]}`);
                rowEdited = true;
                break; // Exit the loop after editing
            }
        }

        if (rowEdited) {
            // Join the rows back into a single string
            const updatedCSV = rows.join('\n');

            try {
                fs.writeFileSync(filePath, updatedCSV, 'utf8');
            } catch(e){
                console.log("Error Writing: " + e);
            }
            

            
        } else {
            console.log(`${filePath} No row found with name: ${targetName}`);
        }
    } catch (error) {
        console.error('Error reading, editing, or writing CSV:', error);
    }
}

// Main function to run the process concurrently
async function processFiles() {
    try {
        const cameraCSVfiles = await readdir(cameraCSVDir);
        const imageFiles = await walk(inputDirName);

        // Initialize cli-progress bar
        const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        progressBar.start(imageFiles.length, 0);

        const promises = imageFiles.map(async (e) => {
            const outputFilePathTest = e.replace("360 image", "360 image rotated");

            try{
                if (!path.basename(e).toLowerCase().includes('example')) {
                    const fullname = path.basename(e).split(".")[0].split("_");
                    const typename = path.basename(e).split("_").slice(3, 8).join("_");
                    const roomname = fullname.slice(8).join("_");
                    const filteredCSVFile = cameraCSVfiles.filter((file) => file.includes(typename));
    
    
                    const outputFilePath = e.replace("360 image", "360 image rotated");
                    console.log(outputFilePath)
                    console.log(filteredCSVFile)
    
                    if (filteredCSVFile.length > 0) {
                        if(!fs.existsSync(path.join(outputDirName , "/Camera CSV"))){
                            fs.mkdirSync(path.join(outputDirName , "/Camera CSV"))
                        }
                        fs.copyFileSync(path.join(cameraCSVDir, filteredCSVFile[0]), path.join(outputDirName + "/Camera CSV", filteredCSVFile[0]))
                        const result = await findRowByNameSync(path.join(cameraCSVDir, filteredCSVFile[0]), roomname);
                        
                        if (result && (result[5] % 90) !== 0) {
                            await rotateEquirectangularImage(e, outputFilePath, 0, 0, parseFloat(result[5]));
                            var editedCSV = result
                            editedCSV[5] = '0'
                            console.log(result)
                            findRowAndEditByNameSync(path.join(outputDirName + "/Camera CSV", filteredCSVFile[0]), editedCSV[0], editedCSV)
                            // console.log('Rotation complete:', outputFilePath);
                        } else {
                            if(!fs.existsSync(path.dirname(outputFilePath))){
                                fs.mkdirSync(path.dirname(outputFilePath), { recursive: true })
                            }
                            fs.copyFileSync(e, outputFilePath);
                        }
                    } else {
                        console.log(typename + " : No CSV found")
                    }
    
                    // Increment progress bar for each file processed
                    progressBar.increment();
                }
            } catch(e){
                console.log("Failure: "  + outputFilePathTest)

            }

        });

        // Run all the promises concurrently
        await Promise.all(promises);
        
        // progressBar.stop(); // Stop the progress bar once all tasks are complete
        console.log('All files processed concurrently');
    } catch (error) {
        console.error('Error processing files:', error);
    }
}

// Run the main function
processFiles();