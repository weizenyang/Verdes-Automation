
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Function to preprocess the image for better OCR
const preprocessImage = async (imagePath) => {
  return sharp(imagePath)
    .grayscale()
    // .resize(3000) // Resize to make text larger
    //.normalize() // Improve contrast
    .toBuffer();
};

// Function to draw bounding boxes and flipped text
const drawBoundingBoxesAndFlippedText = async (flippedImageBuffer, boxes, outputPath, imageName) => {
  const { width: imageWidth, height: imageHeight } = await sharp(flippedImageBuffer).metadata();

  // Create a mask using the bounding boxes
  let mask = sharp({
    create: {
      width: imageWidth,
      height: imageHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
    }
  }).png();

  const maskImages = boxes.map(box => ({
    input: Buffer.from(
      `<svg width="${imageWidth}" height="${imageHeight}">
        <rect x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" fill="white" />
      </svg>`
    ),
    top: 0,
    left: 0
  }));

  const maskBuffer = await mask.composite(maskImages).toBuffer();

  // Apply the mask to the flipped image to remove the regions
  const maskedImageBuffer = await sharp(flippedImageBuffer)
    .composite([{ input: maskBuffer, blend: 'dest-out' }])
    .toBuffer();

  // Composite the flipped text images onto the masked image
  let compositeImages = [];
  for (const box of boxes) {
    const textImage = await sharp(flippedImageBuffer)
      .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
      .flop() // Horizontal flip
      .toBuffer();

    compositeImages.push({
      input: textImage,
      top: box.top,
      left: box.left
    });
  }

  const outputBuffer = await sharp(maskedImageBuffer)
    .composite(compositeImages)
    .toBuffer();

  await sharp(outputBuffer).
  toFile(path.join(outputPath, `output_with_flipped_text_${imageName}`));
};

// Function to flip coordinates horizontally
const flipCoordinatesHorizontally = (box, imageWidth) => {
  return {
    top: box.top,
    left: imageWidth - box.left - box.width,
    width: box.width,
    height: box.height,
    text: box.text
  };
};

const rotateCoordinates180 = (box, imageWidth, imageHeight) => {
  return {
    top: imageHeight - box.top - box.height,
    left: imageWidth - box.left - box.width,
    width: box.width,
    height: box.height,
    text: box.text
  };
};

// Function to perform OCR on an image
const performOCR = async (imagePath, outputPath) => {
  try {
    const recognizeText = async (image) => {
      const { data: { words } } = await Tesseract.recognize(image, 'eng', {
        logger: m => console.log(m)
      });
      return words;
    };

    const rotateImage = async (imagePath, degrees) => {
      const buffer = await sharp(imagePath).rotate(degrees).toBuffer();
      return buffer;
    };

    const rotateCoordinates = (box, degrees, imageWidth, imageHeight) => {
      switch (degrees) {
        case 90:
          return {
            top: imageWidth - box.left - box.width,
            left: box.top,
            width: box.height,
            height: box.width,
            text: box.text
          };
        case 180:
          return {
            top: imageHeight - box.top - box.height,
            left: imageWidth - box.left - box.width,
            width: box.width,
            height: box.height,
            text: box.text
          };
        case 270:
          return {
            top: box.left,
            left: imageHeight - box.top - box.height,
            width: box.height,
            height: box.width,
            text: box.text
          };
        default:
          return box;
      }
    };

    const preprocessedImageBuffer = await preprocessImage(imagePath);
    const image = sharp(preprocessedImageBuffer);
    const metadata = await image.metadata();
    const imageWidth = metadata.width;
    const imageHeight = metadata.height;

    const rotations = [0, 90, 180, 270];
    let allWords = [];

    for (let degrees of rotations) {
      const rotatedImageBuffer = await rotateImage(imagePath, degrees);
      const words = await recognizeText(rotatedImageBuffer);
      const rotatedWords = words.map(word => rotateCoordinates({
        top: word.bbox.y0,
        left: word.bbox.x0,
        width: word.bbox.x1 - word.bbox.x0,
        height: word.bbox.y1 - word.bbox.y0,
        text: word.text
      }, degrees, imageWidth, imageHeight));
      allWords = allWords.concat(rotatedWords);
    }

    // Regular expression to match patterns like 1.8m
    const measurementPattern = /\b\d+(\.\d+)?\s?m\b/;
    const boxes = allWords.filter(word => measurementPattern.test(word.text));

    // Flip image horizontally and get buffer
    const flippedImageBuffer = await sharp(preprocessedImageBuffer).flop().toBuffer();

    // Adjust coordinates for the horizontal flip
    const flippedBoxes = boxes.map(box => flipCoordinatesHorizontally(box, imageWidth));

    // Log recognized text with bounding boxes
    flippedBoxes.forEach(box => {
      console.log(`Recognized text: "${box.text}" at [left: ${box.left}, top: ${box.top}, width: ${box.width}, height: ${box.height}]`);
    });

    await drawBoundingBoxesAndFlippedText(flippedImageBuffer, flippedBoxes, outputPath, path.basename(imagePath));
    console.log(`OCR and bounding box drawing complete for ${imagePath}`);
  } catch (err) {
    console.error('Error:', err);
  }
};


// Function to process all images in a directory
const processDirectory = async (directoryPath, outputPath) => {
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return;
    }

    files.forEach(file => {
      const filePath = path.join(directoryPath, file);
      if (path.extname(file).toLowerCase() === '.png' || path.extname(file).toLowerCase() === '.jpg' || path.extname(file).toLowerCase() === '.jpeg') {
        performOCR(filePath, outputPath);
      }
    });
  });
};

// Specify the path to your directory and the output directory
const directoryPath = './OCR Test/Balcony Dim PNG/Images to flip';
const outputPath = './OCR Test/Balcony Dim PNG/Flipped';

// Create output directory if it doesn't exist
if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath);
}

processDirectory(directoryPath, outputPath);
