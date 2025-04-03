const fs = require('fs');
const path = require('path');
const convert = require('fbx2gltf');
const gltfPipeline = require('gltf-pipeline');

// Define input directory containing FBX files and output directory for GLB files.
const inputDir = './input';
const outputDir = './output';

// Create the output directory if it doesn't exist.
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Function to scale a GLB file using gltf-pipeline.
function scaleGlbFile(filePath, scaleFactor) {
  fs.readFile(filePath, (readErr, data) => {
    if (readErr) {
      console.error(`Error reading GLB file ${filePath}:`, readErr);
      return;
    }
    gltfPipeline.processGlb(data, { scale: scaleFactor })
      .then(result => {
        fs.writeFile(filePath, result.glb, writeErr => {
          if (writeErr) {
            console.error(`Error writing scaled GLB file ${filePath}:`, writeErr);
          } else {
            console.log(`Scaled GLB file saved: ${filePath}`);
          }
        });
      })
      .catch(err => {
        console.error(`Error scaling GLB file ${filePath}:`, err);
      });
  });
}

// Read the input directory and process each FBX file.
fs.readdir(inputDir, (err, files) => {
  if (err) {
    console.error(`Error reading directory ${inputDir}:`, err);
    return;
  }

  files.forEach(file => {
    if (path.extname(file).toLowerCase() === '.fbx') {
      const inputFilePath = path.join(inputDir, file);
      // Change extension to .glb for the output.
      const outputFileName = path.basename(file, '.fbx') + '.glb';
      const outputFilePath = path.join(outputDir, outputFileName);

      // Conversion options: Only using '--khr-materials-unlit' here.
      const options = ['--khr-materials-unlit'];
      console.log(`Converting: ${inputFilePath} -> ${outputFilePath}`);
      convert(inputFilePath, outputFilePath, options)
        .then(destPath => {
          console.log(`Successfully converted to ${destPath}`);
          // After conversion, scale the GLB file down by 10x.
          scaleGlbFile(destPath, 0.1);
        })
        .catch(error => {
          console.error(`Failed to convert ${inputFilePath}:`, error);
        });
    }
  });
});
