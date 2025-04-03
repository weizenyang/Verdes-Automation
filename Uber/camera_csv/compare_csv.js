const fs = require('fs');

// Paths to input files
const inputFile1 = 'input/csv_camera_a_s_3b_a1m_s1.csv'; // First CSV
const inputFile2 = 'replacement/csv_camera_a_s_3b_a1m_s1.csv'; // Second CSV

// Function to compare two CSV files
function compareCsv() {
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

      // Ensure both files have the same number of rows
      const maxRows = Math.max(rows1.length, rows2.length);

      for (let i = 0; i < maxRows; i++) {
        const row1 = rows1[i] ? rows1[i].split(',') : [];
        const row2 = rows2[i] ? rows2[i].split(',') : [];

        const maxColumns = Math.max(row1.length, row2.length);

        // Compare each column in the row
        for (let j = 0; j < maxColumns; j++) {
          const value1 = row1[j] || '';
          const value2 = row2[j] || '';

          if (value1 !== value2) {
            console.log(
              `Difference at Row ${i + 1}, Column ${j + 1}: File1(${value1}), File2(${value2})`
            );
          }
        }
      }
    });
  });
}

compareCsv();
