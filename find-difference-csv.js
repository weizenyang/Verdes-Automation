const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Function to read files from a directory
const getFiles = (dirPath) => {
  return fs.readdirSync(dirPath).map(file => path.join(dirPath, file));
};

// Function to read filenames from CSV
const getFilenamesFromCSV = (csvPath) => {
  return new Promise((resolve, reject) => {
    const filenames = [];
    fs.createReadStream(csvPath)
      .pipe(csv({ headers: false }))
      .on('data', (row) => filenames.push(Object.values(row)[0]))
      .on('end', () => resolve(filenames))
      .on('error', reject);
  });
};

// Function to compare filenames in target directory based on CSV
const compareFiles = async (csvPath, targetDir) => {
  const sourceFilenames = await getFilenamesFromCSV(csvPath);
  const targetFiles = getFiles(targetDir).map(file => path.basename(file));
  
  const missingInDir = [];
  const foundFiles = [];
  const missingInCSV = [];

  const cleanedSourceFilenames = sourceFilenames.map(file => file.toLowerCase().split(".")[0]);
  const cleanedTargetFiles = targetFiles.map(file => file.toLowerCase());

  cleanedSourceFilenames.forEach((sourceFilename, index) => {
    const isFileFound = cleanedTargetFiles.some(targetFile => {
      return targetFile.includes(sourceFilename);
    });

    if (!isFileFound) {
      missingInDir.push(sourceFilenames[index]);
    } else {
      foundFiles.push(sourceFilenames[index]);
    }
  });

  cleanedTargetFiles.forEach((targetFile, index) => {
    const isFileInCSV = cleanedSourceFilenames.some(sourceFilename => {
        if(!sourceFilename.toLowerCase().includes("flipped")){
            return targetFile.includes(sourceFilename);
        }
      
    });

    if (!isFileInCSV) {
        if(!targetFiles[index].toLowerCase().includes("flipped")){
            missingInCSV.push(targetFiles[index]);
        }
      
    }
  });

  console.log('Files in CSV but missing in directory:', missingInDir);
  console.log('Files found in both CSV and directory:', foundFiles);
  console.log('Files in directory but missing in CSV:', missingInCSV);
};

// Usage example:
const csvFilePath = './expectedfiles.csv';
const targetDirectory = './Arthouse/floorplan/segmented - distinct/POLISHED/S2/DIMS';

compareFiles(csvFilePath, targetDirectory)
  .then(() => console.log('Comparison completed'))
  .catch(err => console.error('Error comparing files:', err));
