const fs = require('fs');
const path = require('path');

// Paths to input and output files
const inputFile1 = 'input/csv_camera_a_s_3b_a1m_s1.csv'; // Base CSV
const inputFile2 = 'replacement/csv_camera_a_s_3b_a1m_s1.csv'; // Replacement values
const outputFilePath = 'output'; // Output CSV

// Main logic to process the CSV files
function processCsv() {
  fs.readFile(inputFile1, 'utf8', (err, data1) => {
    if (err) {
      console.error('Error reading the first file:', err);
      return;
    }

    fs.readFile(inputFile2, 'utf8', (err, data2) => {
      if (err) {
        console.error('Error reading the second file:', err);
        return;
      }

      // Split both files into rows
      const rows1 = data1.split('\n').filter(row => row.trim() !== ''); // Remove empty lines
      const rows2 = data2.split('\n').filter(row => row.trim() !== '');

      // Create a lookup map for the second file
      const replacementMap = {};
      rows2.forEach(row => {
        const columns = row.split(',');
        const name = columns[0]; // First column as key
        replacementMap[name] = columns; // Store the entire row as an array
      });

      // Process the first CSV file and log differences
      const updatedRows = rows1.map(row => {
        const columns = row.split(',');
        const name = columns[0]; // First column as the key
        const replacementRow = replacementMap[name];

        if (replacementRow) {
          // Log differences for each column
          columns.forEach((value, index) => {
            const replacementValue = replacementRow[index];
            if (replacementValue && value !== replacementValue && index > 2) {
              console.log(
                `Difference in "${name}" - Column ${index + 1}: Original(${value}), Replacement(${replacementValue})`
              );
            }
          });

          // Replace columns with the replacement values
          return replacementRow.join(',');
        }
        return row; // Keep original row if no match is found
      });

      // Write the updated rows to the output CSV
      fs.writeFile(outputFilePath, updatedRows.join('\n'), 'utf8', (err) => {
        if (err) {
          console.error('Error writing the updated CSV:', err);
          return;
        }
        console.log(`Updated CSV saved to: ${outputFilePath}`);
      });
    });
  });
}

processCsv();
