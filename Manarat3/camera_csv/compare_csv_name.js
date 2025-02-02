const fs = require('fs');

// Paths to input files
const inputFile1 = 'input/csv_camera_a_s_3b_a2m_s1.csv'; // First CSV
const inputFile2 = 'replacement/csv_camera_a_s_3b_a2m_s1.csv'; // Second CSV


// Function to compare two CSV files by name and log numeric differences for columns 2 and 3
function compareCsvNumericDifference() {
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

      // Split files into rows
      const rows1 = data1.split('\n').filter(row => row.trim() !== ''); // Remove empty lines
      const rows2 = data2.split('\n').filter(row => row.trim() !== '');

      // Create lookup maps for both files based on the first column (name)
      const map1 = createLookupMap(rows1);
      const map2 = createLookupMap(rows2);

      // Compare rows by name
      const allNames = new Set([...Object.keys(map1), ...Object.keys(map2)]); // Union of all names

      allNames.forEach(name => {
        const row1 = map1[name] || [];
        const row2 = map2[name] || [];

        // Ensure rows have at least two columns for comparison
        const value1Col2 = parseFloat(row1[1] || '0');
        const value2Col2 = parseFloat(row2[1] || '0');
        const value1Col3 = parseFloat(row1[2] || '0');
        const value2Col3 = parseFloat(row2[2] || '0');

        // Prepare a compact log line for differences
        let logLine = `${name}:`;

        if (value1Col2 !== value2Col2) {
          logLine += ` Col2 Diff(${value2Col2 - value1Col2})`;
        }
        if (value1Col3 !== value2Col3) {
          logLine += ` Col3 Diff(${value2Col3 - value1Col3})`;
        }

        // Only log if there are differences
        if (logLine !== `${name}:`) {
          console.log(logLine.trim());
        }
      });
    });
  });
}

// Helper function to create a lookup map by the first column (name)
function createLookupMap(rows) {
  const map = {};
  rows.forEach(row => {
    const columns = row.split(',');
    const name = columns[0]; // First column is the key
    if (name) {
      map[name] = columns; // Store the entire row as an array
    }
  });
  return map;
}

// Run the comparison
compareCsvNumericDifference();

