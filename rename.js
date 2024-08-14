const fs = require('fs').promises;
const path = require('path');

// Directories
const sourceDir = '../Arthouse Variation/New Backplates/Upscaled'; // Directory with files to rename
const targetDir = '../Arthouse Variation/New Backplates/Cropped'; // Directory with new names

// Function to rename files
async function renameFiles() {
  try {
    // Read files and directories in the source directory
    const sourceEntries = await fs.readdir(sourceDir, { withFileTypes: true });
    // Read files and directories in the target directory
    const targetEntries = await fs.readdir(targetDir, { withFileTypes: true });

    // Ensure there are target files
    if (targetEntries.length === 0) {
      throw new Error('Target directory is empty.');
    }

    // Filter out folders and get only files from both directories
    const sourceFiles = sourceEntries
      .filter(entry => entry.isFile())
      .map(entry => entry.name);

    const targetFiles = targetEntries
      .filter(entry => entry.isFile())
      .map(entry => entry.name);

    // Rename files in the source directory
    for (let i = 0; i < sourceFiles.length; i++) {
      if (i >= targetFiles.length) {
        console.warn('Not enough target names for all source files.');
        break;
      }

      const sourceFilePath = path.join(sourceDir, sourceFiles[i]);
      const targetFilePath = path.join(sourceDir, targetFiles[i]);

      console.log(`Renaming ${sourceFiles[i]} to ${targetFiles[i]}`);

      // Rename the file
      await fs.rename(sourceFilePath, targetFilePath);
    }

    console.log('Files have been renamed successfully.');
  } catch (error) {
    console.error('Error renaming files:', error);
  }
}

// Execute the function
renameFiles();