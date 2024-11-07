const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const parseCubeLUT = require('./cubeParser');

async function applyLUT(imagePath, lutPath, outputImagePath) {
  try {
    const { lut, size } = parseCubeLUT(lutPath);
    const image = await loadImage(imagePath);

    const targetWidth = 4000;
    const targetHeight = 2000;

    const canvas = createCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      const ri = Math.min(Math.floor(r * (size - 1)), size - 1);
      const gi = Math.min(Math.floor(g * (size - 1)), size - 1);
      const bi = Math.min(Math.floor(b * (size - 1)), size - 1);

      const lutIndex = ri + gi * size + bi * size * size;

      data[i] = Math.round(lut[lutIndex].r * 255);
      data[i + 1] = Math.round(lut[lutIndex].g * 255);
      data[i + 2] = Math.round(lut[lutIndex].b * 255);
    }

    ctx.putImageData(imageData, 0, 0);

    const out = fs.createWriteStream(outputImagePath);
    const stream = canvas.createJPEGStream();
    stream.pipe(out);
    out.on('finish', () => console.log(`Processed image saved: ${outputImagePath}`));
  } catch (error) {
    console.error('Error applying LUT:', error);
  }
}

async function applyLUTToDirectory(inputDir, lutPath, outputDir) {
  try {
    const { lut, size } = parseCubeLUT(lutPath);

    const filesAndDirs = fs.readdirSync(inputDir, { withFileTypes: true });

    for (const fileOrDir of filesAndDirs) {
      const inputPath = path.join(inputDir, fileOrDir.name);
      const outputPath = path.join(outputDir, fileOrDir.name);

      if (fileOrDir.isDirectory()) {
        // Recursively process subdirectories
        await applyLUTToDirectory(inputPath, lutPath, outputPath);
      } else if (fileOrDir.isFile()) {
        // Check if it's an image file (only JPG, JPEG, PNG)
        if (/\.(jpg|jpeg|png)$/i.test(fileOrDir.name)) {
          // Ensure output directory exists
          await fs.mkdir(path.dirname(outputPath), { recursive: true });

          // Process image file
          await applyLUT(inputPath, lutPath, outputPath);
        } else {
          console.warn(`Skipping non-image file: ${fileOrDir.name}`);
        }
      }
    }

    console.log('All images processed successfully.');
  } catch (error) {
    console.error('Error applying LUT to directory:', error);
  }
}

const inputDir = './soluis-images/JPG/no terrace';
const lutPath = 'Verdes Correction 1.CUBE';
const outputDir = './soluis-images/Edited/LUT JPG Contrasty';

applyLUTToDirectory(inputDir, lutPath, outputDir);
