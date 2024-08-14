const fs = require('fs');
const path = require('path');

const renameFiles = (sourceDir, targetDir) => {
  // List all files in source and target directories
  const sourceFiles = fs.readdirSync(sourceDir);
  const targetFiles = fs.readdirSync(targetDir);

  // Create a mapping based on the current filenames without extensions
  const sourceMapping = new Map(sourceFiles.map((file, i)=> [i, path.parse(file).name]));
  const targetMapping = new Map(targetFiles.map((file, i) => [i, path.parse(file).name]));

  // Loop through the source files and rename the corresponding target files
  sourceMapping.forEach((key, sourceFile) => {
    console.log(targetMapping)
    if (targetMapping.has(key)) {
      
      const targetFile = targetMapping.get(key);
      const targetFileExt = path.extname(targetFile);
      const newTargetFileName = path.parse(sourceFile).name + targetFileExt;
      const newTargetFile = path.join(targetDir, newTargetFileName);
      const oldTargetFile = path.join(targetDir, targetFile);

      fs.renameSync(oldTargetFile, newTargetFile);
      console.log(`Renamed ${oldTargetFile} to ${newTargetFile}`);
    } else {
      console.log(`No matching target file for ${sourceFile}`);
    }
  });
};

// Usage example:
const sourceDirectory = './Arthouse/floorplan/segmented - distinct/POLISHED/S2/DIMS';
const targetDirectory = './OCR Test/Balcony_S1_test';

renameFiles(sourceDirectory, targetDirectory);
