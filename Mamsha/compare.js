const fs = require('fs');
const csv = require('csv-parser');

// Function to read CSV into an array of objects
function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv({ headers: false })) // No headers in the files
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', (error) => reject(error));
  });
}

// Function to compare two CSV files and output the differences
async function compareCSV(file1, file2, outputFile) {
  try {
    const data1 = await readCSV(file1);
    const data2 = await readCSV(file2);

    // Initialize the differences array
    const differences = [];

    // Find the maximum number of rows to compare all available rows
    const maxRows = Math.max(data1.length, data2.length);

    for (let i = 0; i < maxRows; i++) {
      const row1 = data1[i] || {};
      const row2 = data2[i] || {};
      const diffRow = {};

      // Compare each column in the row
      const maxColumns = Math.max(Object.keys(row1).length, Object.keys(row2).length);
      for (let j = 0; j < maxColumns; j++) {
        const colKey = `Column${j + 1}`;
        if (row1[colKey] !== row2[colKey]) {
          diffRow[colKey] = `File1: ${row1[colKey] || ''}, File2: ${row2[colKey] || ''}`;
        } else {
          diffRow[colKey] = ''; // No difference
        }
      }

      // Add the row to differences if it has any difference
      if (Object.values(diffRow).some((value) => value !== '')) {
        differences.push(diffRow);
      }
    }

    // Write the differences to the output CSV file
    const output = fs.createWriteStream(outputFile);
    output.write(Object.keys(differences[0]).join(',') + '\n'); // Write header
    differences.forEach((row) => {
      output.write(Object.values(row).join(',') + '\n');
    });
    output.end();

    console.log(`Differences saved to ${outputFile}`);
  } catch (error) {
    console.error('Error comparing CSV files:', error);
  }
}

// Run the comparison
compareCSV('csv_floorplan_b7-01-09_s1_0_new.csv', 'csv_floorplan_b7-01-09_s1_0.csv', 'differences_between_files.csv');
