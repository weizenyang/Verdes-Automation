const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const parseCubeLUT = require('./cubeParser');

async function applyLUT(imagePath, lutPath, outputImagePath) {
  try {
    const { lut, size } = parseCubeLUT(lutPath);
    const image = await loadImage(imagePath);

    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, image.width, image.height);
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
    // Read the .CUBE LUT file
    const { lut, size } = parseCubeLUT(lutPath);

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    // Read all files in the input directory
    const files = fs.readdirSync(inputDir);

    // Process each file in the directory
    for (const file of files) {
      const filePath = path.join(inputDir, file);
      const outputImagePath = path.join(outputDir, file);

      // Check if it's a file and an image (you can add more extensions if needed)
      if (fs.statSync(filePath).isFile() && (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png'))) {
        await applyLUT(filePath, lutPath, outputImagePath);
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