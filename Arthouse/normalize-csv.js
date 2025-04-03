

const fs = require('fs');
const path = require('path');

// ---------- CONFIGURATION ----------

const INPUT_DIR = "./Camera CSV/original";    // Directory containing CSV files to process
const OUTPUT_DIR = "./Camera CSV/normalised";    // Directory to write processed CSV files

// For CSVs with no header, use column indices (0-indexed).
// Column index where the anchor value is located.
const IDENTIFIER_INDEX = 0;
// The anchor value to search for in that column.
const ANCHOR_VALUE = 'AnchorObject';
// Array of column indexes to process (subtract the anchor value from these cells).
const COLUMNS_TO_PROCESS = [1, 2]; // Update these indexes as needed

// ---------- HELPER FUNCTIONS ----------

/**
 * Parses a CSV string into an array of rows.
 * Each row is an array of cells.
 * Assumes simple CSV (no embedded commas or quotes).
 */
function parseCSV(csvContent) {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
  const rows = lines.map(line => line.split(',').map(cell => cell.trim()));
  return rows;
}

/**
 * Converts an array of rows (each row an array of cells) back to a CSV string.
 */
function toCSV(rows) {
  return rows.map(row => row.join(',')).join('\n');
}

/**
 * Processes CSV content by:
 *  - Finding the anchor row (where cell at IDENTIFIER_INDEX equals ANCHOR_VALUE).
 *  - For every other row, subtracting the numeric value in selected columns by the anchor row's value.
 */
function processCSVContent(csvContent) {
  const rows = parseCSV(csvContent);

  // Find the anchor row index.
  const anchorRowIndex = rows.findIndex(row => row[IDENTIFIER_INDEX] === ANCHOR_VALUE);
  if (anchorRowIndex === -1) {
    throw new Error(`Anchor row with value "${ANCHOR_VALUE}" not found at column index ${IDENTIFIER_INDEX}.`);
  }
  const anchorRow = rows[anchorRowIndex];

  // For every row (except the anchor), subtract the anchor's numeric value from selected columns.
  const newRows = rows.map((row, idx) => {
    // Leave the anchor row unchanged.
    if (idx === anchorRowIndex) return row;

    const newRow = row.slice();
    COLUMNS_TO_PROCESS.forEach(colIndex => {
      const cellVal = parseFloat(row[colIndex]);
      const anchorVal = parseFloat(anchorRow[colIndex]);
      if (!isNaN(cellVal) && !isNaN(anchorVal)) {
        newRow[colIndex] = (cellVal - anchorVal).toString();
      }
    });
    return newRow;
  });

  return toCSV(newRows);
}

/**
 * Processes a single CSV file:
 *  - Reads the file.
 *  - Processes its content.
 *  - Writes the processed content to the output file.
 */
function processCSVFile(inputFilePath, outputFilePath) {
  try {
    const csvContent = fs.readFileSync(inputFilePath, 'utf8');
    const processedContent = processCSVContent(csvContent);
    fs.writeFileSync(outputFilePath, processedContent, 'utf8');
    console.log(`Processed file: ${path.basename(inputFilePath)}`);
  } catch (err) {
    console.error(`Error processing file ${inputFilePath}: ${err.message}`);
  }
}

// ---------- MAIN SCRIPT ----------

// Ensure the output directory exists.
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Read the input directory and process each CSV file.
fs.readdir(INPUT_DIR, (err, files) => {
  if (err) {
    console.error("Error reading input directory:", err);
    return;
  }
  files.forEach(file => {
    if (path.extname(file).toLowerCase() === '.csv') {
      const inputFilePath = path.join(INPUT_DIR, file);
      const outputFilePath = path.join(OUTPUT_DIR, file);
      processCSVFile(inputFilePath, outputFilePath);
    }
  });
});

