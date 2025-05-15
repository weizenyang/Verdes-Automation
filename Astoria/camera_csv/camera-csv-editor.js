const fs = require('fs');
const path = require('path');

const inputFilePath = 'csv_camera_a_s_3b_a1m_s1.csv'; // Input CSV path
const outputFilePath = 'modified_csv_camera_a_s_3b_a1m_s1.csv'; // Output CSV path

// Read the file
fs.readFile(inputFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading the file:', err);
    return;
  }

  // Split CSV data into rows
  const rows = data.split('\n');

  // Process the rows
  const modifiedRows = rows.map((row, index) => {
    // Skip empty rows
    if (!row.trim()) return row;

    // Split each row into columns
    const columns = row.split(',');

    // Ignore the header row
    if (index === 0) return row;

    // Access and modify the second and third columns
    columns[1] = (parseFloat(columns[1]) - 3500).toFixed(2); // Subtract 0 (no change) from second column
    columns[2] = (parseFloat(columns[2]) - 17500).toFixed(2); // Subtract 17000 from third column

    // Join columns back into a row
    return columns.join(',');
  });

  // Join rows back into a CSV string
  const modifiedCsv = modifiedRows.join('\n');

  // Write the modified CSV to a new file
  fs.writeFile(outputFilePath, modifiedCsv, 'utf8', (err) => {
    if (err) {
      console.error('Error writing the file:', err);
      return;
    }
    console.log(`Modified CSV saved to: ${outputFilePath}`);
  });
});
