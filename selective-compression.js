const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');

// Directories
const inputDir = 'output2';
const outputDir = '../Arthouse AI Upscale/Selective Upscaled';
const maskDir = '../Arthouse AI Upscale/Compression Mask 8k'; // Mask images directory
const maxFileSizeKB = 20000; // 1000 KB

// Ensure the output directory exists
fs.ensureDirSync(outputDir);

// Function to process images
async function processImages() {
  try {
    const files = await fs.readdir(inputDir);

    for (const file of files) {
      const inputImagePath = path.join(inputDir, file);
      const fileName = path.parse(file).name;

      // Search for corresponding mask
      const maskFiles = await fs.readdir(maskDir);
      const maskFile = maskFiles.find(mask => fileName.startsWith(path.parse(mask).name));

      if (maskFile) {
        const maskImagePath = path.join(maskDir, maskFile);
        const outputImagePath = path.join(outputDir, `${fileName}.webp`);

        await processImage(inputImagePath, maskImagePath, outputImagePath);
        console.log(`Processed: ${file}`);
      } else {
        console.log(`No mask found for: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error processing images:', error);
  }
}

// Function to process a single image
async function processImage(inputImagePath, maskImagePath, outputImagePath) {
  try {

    // Load the original image and get its metadata
    const originalImage = sharp(inputImagePath);
    const originalBuffer = await originalImage.toBuffer();
    const metadata = await originalImage.metadata();

    let highQuality = 90;
    let lowQuality = 10;
    let finalBuffer;

    while (true) {
      // Compress the original image with high quality for important areas
      const highQualityBuffer = await sharp(originalBuffer)
        .png({ quality: highQuality, compressionLevel: 0}) // High quality compression
        .toBuffer();

      // Compress the original image with low quality for less important areas
      const lowQualityBuffer = await sharp(originalBuffer)
        .png({ quality: lowQuality }) // Low quality compression
        .toBuffer();

      // Load the mask image
      const maskAlpha = await sharp(maskImagePath)
      .extractChannel('red')
      .toBuffer()

      const extractedItem = await sharp(highQualityBuffer)
      .joinChannel(maskAlpha)
      .toBuffer()

      // Composite the high and low quality images using the mask
      finalBuffer = await sharp({
        create: {
          width: metadata.width,
          height: metadata.height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
        .composite([
          { input: lowQualityBuffer },
          { input: extractedItem}
        ])
        .webp({ quality: 100}) // Final output quality to maintain the composition
        .toBuffer();

      // Check if the final image size is within the limit
      const finalSizeKB = finalBuffer.length / 1024;
      if (finalSizeKB <= maxFileSizeKB) {
        break;
      }

      // Reduce the quality
      if (lowQuality > 4) {
        lowQuality -= 2;
      } else if (highQuality > 70) {
        highQuality -= 2;
      } else {
        console.log(`Cannot compress ${inputImagePath} further without excessive quality loss.`);
        break;
      }
    }

    // Save the final image
    await sharp(finalBuffer).toFile(outputImagePath);
    console.log(`LowQuality: ${lowQuality}, HighQuality: ${highQuality}, Output: ${outputImagePath}`);

  } catch (error) {
    console.error('Error processing image:', error);
  }
}

// Start processing
processImages();