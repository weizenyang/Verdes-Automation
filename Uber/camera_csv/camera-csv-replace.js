const fs = require('fs');
const path = require('path');

// Paths to the input CSV files
const inputFile1 = 'input/csv_camera_a_s_3b_a2m_s1.csv'; // Base CSV
const inputFile2 = 'replacement/csv_camera_a_s_3b_a2m_s1.csv'; // Replacement values
const outputFilePath = 'output/modified_csv_camera_a_s_3b_a2m_s1.csv'; // Output CSV

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
  
        // Create a lookup map for replacements based on the first column
        const replacementMap = {};
        rows2.forEach(row => {
          const columns = row.split(',');
          const name = columns[0]; // First column as key
          if (name) {
            replacementMap[name] = [columns[1], columns[2]]; // Store second and third column values
          }
        });
  
        // Process the first CSV file and apply replacements
        const updatedRows = rows1.map(row => {
          const columns = row.split(',');
          const name = columns[0]; // First column as the key
          if (replacementMap[name]) {
            columns[1] = replacementMap[name][0]; // Replace second column
            columns[2] = replacementMap[name][1]; // Replace third column
          }
          return columns.join(','); // Join back into a CSV row
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
