const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Function to preprocess the image for better OCR
const preprocessImage = async (imagePath, degrees = 0) => {
  return sharp(imagePath)
    .rotate(degrees) // Rotate the image
    .grayscale()
    .resize(5000) // Resize to make text larger
    .normalize() // Improve contrast
    .toBuffer();
};

// Function to log recognized text from an image
const logRecognizedText = async (imagePath) => {
  try {
    const recognizeText = async (image) => {
      const { data: { text, words } } = await Tesseract.recognize(image, 'eng', {
        lang: 'eng', // Specify the language
        tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.,', // Whitelist characters
        oem: Tesseract.OEM.LSTM_ONLY, // Use LSTM model only
        tessedit_pageseg_mode: Tesseract.PSM.AUTO, // Page segmentation mode
        logger: m => console.log(m),
        dpi: 300 // Set DPI
      });
      return { text, words };
    };

    const rotations = [0, 90, 180, 270];
    for (let degrees of rotations) {
      const preprocessedImageBuffer = await preprocessImage(imagePath, degrees);
      const { text, words } = await recognizeText(preprocessedImageBuffer);
      console.log(`Recognized text from ${imagePath} rotated by ${degrees} degrees:\n${text}`);

      // Regular expression to match patterns like 1.8m
      const measurementPattern = /\b\d+(\.\d+)?\s?m\b/;
      const boxes = words.filter(word => measurementPattern.test(word.text));

      await drawBoundingBoxes(preprocessedImageBuffer, boxes, path.dirname(imagePath), path.basename(imagePath, path.extname(imagePath)) + `_rotated_${degrees}_with_bounding_boxes`);
    }
  } catch (err) {
    console.error('Error:', err);
  }
};

// Function to draw bounding boxes on the image
const drawBoundingBoxes = async (imageBuffer, boxes, outputPath, imageName) => {
  const { width: imageWidth, height: imageHeight } = await sharp(imageBuffer).metadata();
  
  let svgRects = '';
  boxes.forEach(box => {
    svgRects += `<rect x="${box.bbox.x0}" y="${box.bbox.y0}" width="${box.bbox.x1 - box.bbox.x0}" height="${box.bbox.y1 - box.bbox.y0}" fill="none" stroke="red" stroke-width="4"/>`;
  });

  const svgImage = `
    <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
      <image x="0" y="0" width="${imageWidth}" height="${imageHeight}" href="data:image/png;base64,${imageBuffer.toString('base64')}" />
      ${svgRects}
    </svg>`;

  await sharp(Buffer.from(svgImage)).toFile(path.join(outputPath, `${imageName}.png`));
};


// Example usage
const inputImagePath = './OCR Test/Balcony_S1_Cropped/Cropped-2BRMB1_B3.png'; // Replace with the actual image path
logRecognizedText(inputImagePath);
