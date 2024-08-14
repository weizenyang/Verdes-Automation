const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { stringify } = require('csv-stringify/sync');

// Directory to scan if csvFiles is empty
const directoryToScan = './New CSV Resized/Scaled CSV Types';

// Paths to CSV files
let csvFiles = [];

// Replacement mapping array
const replacementMapping = [
    // ['MasterBathroom', 'MasterBedroomBathroom'],
    // ['StudyRoom', 'Office'],
    // ['Bathroom', 'PowderRoom'],
    // ['Utility', 'Laundry'],
    // ['DiningArea', 'DiningRoom'],
    // ['MaidsRoom', 'MaidRoom'],
    // ['MasterBedroomPowderRoom', 'MasterBedroomBathroom'],
];

// Deletion mapping array
const deletionMapping = [
    // 'Laundry',
    // 'Bedroom1Bathroom',
    // 'Bedroom2Bathroom',
    // 'Bedroom3Bathroom',
    // 'Bedroom4Bathroom',
    // 'Bedroom5Bathroom',
];

// Value to search for in the CSV files
const searchValue = 'Study'; // Replace 'targetValue' with the value you want to search for

// Function to scan directory for CSV files
function scanDirectoryForCsvFiles(directory) {
    const files = fs.readdirSync(directory);
    return files.filter(file => path.extname(file).toLowerCase() === '.csv')
                .map(file => path.join(directory, file));
}

// Function to process CSV files
function processCsvFiles(csvFiles, replacements, deletions) {
    csvFiles.forEach(file => {
        let rows = [];
        let columnIndex = 0;
        let searchTermFound = false;

        console.log(`Processing file: ${file}`);

        // Read the CSV file
        fs.createReadStream(file)
            .pipe(csv({ headers: false }))
            .on('data', (row) => {
                let values = Object.values(row);

                // Check if the search value exists in the row
                if (values.some(value => value.toLowerCase().includes(searchValue.toLowerCase()))) {
                    console.log(`Search value '${searchValue}' found in row: ${values.join(', ')}`);
                    searchTermFound = true;
                }

                // Check if the row should be deleted (case insensitive)
                let deleteRow = values.some(value => 
                    deletions.some(deletion => 
                        value.toLowerCase().includes(deletion.toLowerCase())
                    )
                );

                if (!deleteRow) {
                    if (rows.length === 0) {
                        // Identify the column index to replace based on the first row
                        values.forEach((value, index) => {
                            replacements.forEach(([oldValue]) => {
                                const regex = new RegExp(oldValue, 'i');
                                if (regex.test(value)) {
                                    columnIndex = index;
                                    console.log(`Identified column index for replacement: ${columnIndex}`);

                                }
                            });
                        });
                    }
                    // Replace values in the identified column based on the replacement mapping (case insensitive)
                    if (columnIndex >= 0 && columnIndex < values.length) {
                        replacements.forEach(([oldValue, newValue]) => {
                            const regex = new RegExp(oldValue, 'i');
                            if (regex.test(values[columnIndex])) {
                                console.log(`Replacing '${values[columnIndex]}' with '${newValue}'`);
                                values[columnIndex] = values[columnIndex].replace(regex, newValue);
                            }
                        });
                    }
                    rows.push(values);
                } else {
                    console.log(`Deleting row: ${values.join(', ')}`);
                }
            })
            .on('end', () => {
                if (searchTermFound) {
                    console.log(`The search value '${searchValue}' was found in the file: ${file}`);
                }
                // Convert rows back to CSV
                const csvContent = stringify(rows);
                // Save the updated CSV file
                const outputFilePath = path.join(path.dirname(file), `updated_${path.basename(file)}`);
                // fs.writeFile(outputFilePath, csvContent, 'utf8', (err) => {
                //     if (err) throw err;
                //     console.log(`Updated file saved to ${outputFilePath}`);
                // });
            });
    });
}

// Main execution
if (csvFiles.length === 0) {
    csvFiles = scanDirectoryForCsvFiles(directoryToScan);
}

processCsvFiles(csvFiles, replacementMapping, deletionMapping);
