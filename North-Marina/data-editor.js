const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { stringify } = require('csv-stringify/sync');

// Directory to scan if csvFiles is empty
const directoryToScan = './CSV';

// Paths to CSV files
let csvFiles = [];

// Replacement mapping array
const replacementMapping = [
    // ['MasterBathroom', 'MasterBedroomBathroom'],
];

// Deletion mapping array
const deletionMapping = [
    "PodLiving",
    "PodPantry",
    "PodBathroom"
];

const source = ["p3"]
const noPods = ["p1", "p4"]
const withPods = ["p2", "p3"]

// Value to search for in the CSV files
const searchValue = 'Study';

// Function to scan directory for CSV files
function scanDirectoryForCsvFiles(directory) {
    const files = fs.readdirSync(directory);
    return files.filter(file => path.extname(file).toLowerCase() === '.csv')
                .map(file => path.join(directory, file));
}

function checkAndDeleteRow(row, file, columnIndex){
    let values = Object.values(row);

    // Check if the row should be deleted (case insensitive)
    let deleteRow = values.some(value => 
        deletionMapping.some(deletion => 
            value.toLowerCase().includes(deletion.toLowerCase())
        )
    );
        if (!deleteRow) {
                values.forEach((value, index) => {
                    replacementMapping.forEach(([oldValue]) => {
                        const regex = new RegExp(oldValue, 'i');
                        if (regex.test(value)) {
                            columnIndex = index;
                            console.log(`Identified column index for replacement: ${columnIndex}`);

                        }
                    });
                });
            // Replace values in the identified column based on the replacement mapping (case insensitive)
            if (columnIndex >= 0 && columnIndex < values.length) {
                replacementMapping.forEach(([oldValue, newValue]) => {
                    const regex = new RegExp(oldValue, 'i');
                    if (regex.test(values[columnIndex])) {
                        console.log(`Replacing '${values[columnIndex]}' with '${newValue}'`);
                        values[columnIndex] = values[columnIndex].replace(regex, newValue);
                    }
                });
            }
            return values;
        } else {
            console.log(`Deleting row: ${values.join(', ')}`);
        }
}

function checkAndEditRow(row, file, columnIndex){
    let values = Object.values(row);

        // noPods.filter((e) => file.includes(e)).length > 0
        values.forEach((value, index) => {
            replacementMapping.forEach(([oldValue]) => {
                const regex = new RegExp(oldValue, 'i');
                if (regex.test(value)) {
                    columnIndex = index;
                    console.log(`Identified column index for replacement: ${columnIndex}`);
             }
            });
        });

    if (columnIndex >= 0 && columnIndex < values.length) {
        replacementMapping.forEach(([oldValue, newValue]) => {
            const regex = new RegExp(oldValue, 'i');
            if (regex.test(values[columnIndex])) {
                console.log(`Replacing '${values[columnIndex]}' with '${newValue}'`);
                values[columnIndex] = values[columnIndex].replace(regex, newValue);
            }
        });
    }
    return values;
}

function processCsvFiles(csvFiles, processingType) {
    csvFiles.forEach(file => {
        let rows = [];
        let columnIndex = 0;

        console.log(`Processing file: ${file}`);

        fs.createReadStream(file)
            .pipe(csv({ headers: false }))
            .on('data', (row) => {
                // console.log(source.filter((e) => file.includes(e)))

                    if(source.filter((e) => file.includes(e)).length > 0){
                        if(processingType == "no pods"){
                            rows.push(checkAndDeleteRow(row, file, columnIndex))
                        } else if(processingType == "with pods"){
                            rows.push(checkAndEditRow(row, file, columnIndex))
                        } else {
                            console.log("Processing Type is not defined")
                        }
                        
                    } else {
                        rows.push(checkAndEditRow(row, file, columnIndex))
                    }
                    //Remove Undefined fields returned by checkAndDeleteRow()
                    rows = rows.filter((e) => e != undefined)

                
            })
            .on('end', () => {
                const csvContent = stringify(rows);
                if(processingType == "no pods"){
                    noPods.forEach((e) => {
                        if(!fs.existsSync(path.join(path.dirname(file), `/${processingType}`))){
                            fs.mkdirSync(path.join(path.dirname(file), `/${processingType}`))
                        }
                        // console.log(path.basename(file).split('.')[0])
                        const finalName = path.basename(file).split("_").length < 9 ? `${path.basename(file).split('.')[0].split("_").concat(e).join("_")}.${path.basename(file).split('.')[1]}` : path.basename(file).replace("p3", e)
                        const outputFilePath = path.join(path.dirname(file) + `/${processingType}`, `${finalName}`);
                        fs.writeFile(outputFilePath.replace("_p1", ""), csvContent, 'utf8', (err) => {
                            if (err) throw err;
                            console.log(`Updated file saved to ${outputFilePath}`);
                        });
                    })
                } else if (processingType == "with pods"){
                    withPods.forEach((e) => {
                        if(!fs.existsSync(path.join(path.dirname(file), `/${processingType}`))){
                            fs.mkdirSync(path.join(path.dirname(file), `/${processingType}`))
                        }
                        // console.log(path.basename(file).split('.')[0])
                        const finalName = path.basename(file).split("_").length < 9 ? `${path.basename(file).split('.')[0].split("_").concat(e).join("_")}.${path.basename(file).split('.')[1]}` : path.basename(file).replace("p3", e)
                        
                        const outputFilePath = path.join(path.dirname(file) + `/${processingType}`, `${finalName}`);
                        fs.writeFile(outputFilePath, csvContent, 'utf8', (err) => {
                            if (err) throw err;
                            console.log(`Updated file saved to ${outputFilePath}`);
                        });
                    })
                }


            });
    });
}

if (csvFiles.length === 0) {
    csvFiles = scanDirectoryForCsvFiles(directoryToScan);
}

processCsvFiles(csvFiles, "no pods");
processCsvFiles(csvFiles, "with pods");

//Rename all "p1" to ""
const dimNames = fs.readdirSync(path.join(directoryToScan, "no pods"))
dimNames.forEach((e) => {
    if(e.includes("_p1")){
        fs.renameSync(path.join(path.join(directoryToScan, "no pods"), e), path.join(path.join(directoryToScan, "no pods"), e.replace("_p1", "")))
    }
})
console.log("Renamed")
console.log(fs.readdirSync(path.join(directoryToScan, "no pods")))
