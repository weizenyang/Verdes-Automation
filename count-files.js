const fs = require('fs').promises;
const path = require('path');

async function countFiles(dir) {
  let fileCount = 0;

  async function countFilesRecursive(directory) {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          await countFilesRecursive(fullPath);
        } else {
          fileCount += 1;
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${directory}:`, error);
    }
  }

  await countFilesRecursive(dir);
  return fileCount;
}

// Directory to start counting files from
const startDir = './Arthouse/floorplan/segmented - distinct/Untouched';

countFiles(startDir)
  .then(fileCount => console.log(`Total number of files: ${fileCount}`))
  .catch(error => console.error('Error counting files:', error));