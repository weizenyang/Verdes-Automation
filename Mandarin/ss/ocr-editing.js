
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

  // Create a transparent mask using the bounding boxes
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

  // Composite the flipped text and boxes onto the masked image
  let compositeImages = [];
  for (const box of boxes) {
    // Extract and flip the text box
    const textImage = await sharp(flippedImageBuffer)
      .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
      .flop() // Horizontal flip
      .toBuffer();

    compositeImages.push({
      input: textImage,
      top: box.top,
      left: box.left
    });

    // const confidenceText = `Confidence: ${box.confidence}%`;  // Format confidence to 2 decimals
    // const textSVG = Buffer.from(`
    //   <svg width="${imageWidth}" height="${imageHeight}">
    //     <text x="${box.left}" y="${Math.max(box.top - 20, 10)}" font-size="15" fill="red">${box.text}</text>
    //     <text x="${box.left}" y="${Math.max(box.top - 5, 20)}" font-size="15" fill="red">${confidenceText}</text>
    //   </svg>
    // `);

    // compositeImages.push({
    //   input: textSVG,
    //   top: 0,
    //   left: 0
    // });
  }

  // Final composite operation to include the flipped texts and bounding boxes
  const outputBuffer = await sharp(maskedImageBuffer)
    .composite(compositeImages)
    .toBuffer();

  // Write the final image to a file
  await sharp(outputBuffer)
    .toFile(path.join(outputPath, `output_with_flipped_text_${imageName}`));

  console.log(`Image saved as output_with_flipped_text_${imageName}`);
};
// const drawBoundingBoxesAndFlippedText = async (flippedImageBuffer, boxes, outputPath, imageName) => {
//   const { width: imageWidth, height: imageHeight } = await sharp(flippedImageBuffer).metadata();

//   // Create a mask using the bounding boxes
//   let mask = sharp({
//     create: {
//       width: imageWidth,
//       height: imageHeight,
//       channels: 4,
//       background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
//     }
//   }).png();

//   const maskImages = boxes.map(box => ({
//     input: Buffer.from(
//       `<svg width="${imageWidth}" height="${imageHeight}">
//         <rect x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" fill="white" />
//       </svg>`
//     ),
//     top: 0,
//     left: 0
//   }));

//   const maskBuffer = await mask.composite(maskImages).toBuffer();

//   // Apply the mask to the flipped image to remove the regions
//   const maskedImageBuffer = await sharp(flippedImageBuffer)
//     .composite([{ input: maskBuffer, blend: 'dest-out' }])
//     .toBuffer();

//   // Composite the flipped text images onto the masked image
//   let compositeImages = [];
//   for (const box of boxes) {
//     const textImage = await sharp(flippedImageBuffer)
//       .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
//       .flop() // Horizontal flip
//       .toBuffer();

//     compositeImages.push({
//       input: textImage,
//       top: box.top,
//       left: box.left
//     });
//   }

//   const outputBuffer = await sharp(maskedImageBuffer)
//     .composite(compositeImages)
//     .toBuffer();

//   await sharp(outputBuffer).
//   toFile(path.join(outputPath, `output_with_flipped_text_${imageName}`));
// };

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

// // Function to perform OCR on an image
// const performOCR = async (imagePath, outputPath) => {
//   try {
//     const recognizeText = async (image) => {
//       const { data: { words, lines, symbols} } = await Tesseract.recognize(image, 'eng+osd', {
//         logger: m => console.log(m),
//         tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
//       });

//       const temp = [...words, ...lines, ...symbols]
//       return temp;
//     };

//     const rotateImage = async (imagePath, degrees) => {
//       const buffer = await sharp(imagePath).rotate(degrees).toBuffer();
//       return buffer;
//     };

//     const rotateCoordinates = (box, degrees, imageWidth, imageHeight) => {
//       switch (degrees) {
//         case 90:
//           return {
//             top: imageWidth - box.left - box.width,
//             left: box.top,
//             width: box.height,
//             height: box.width,
//             text: box.text
//           };
//         case 180:
//           return {
//             top: imageHeight - box.top - box.height,
//             left: imageWidth - box.left - box.width,
//             width: box.width,
//             height: box.height,
//             text: box.text
//           };
//         case 270:
//           return {
//             top: box.left,
//             left: imageHeight - box.top - box.height,
//             width: box.height,
//             height: box.width,
//             text: box.text
//           };
//         default:
//           return box;
//       }
//     };

//     const preprocessedImageBuffer = await preprocessImage(imagePath);
//     const image = sharp(preprocessedImageBuffer);
//     const metadata = await image.metadata();
//     const imageWidth = metadata.width;
//     const imageHeight = metadata.height;

//     const rotations = [0, 90, 180, 270];
//     let allWords = [];

//     for (let degrees of rotations) {
//       const rotatedImageBuffer = await rotateImage(imagePath, degrees);
//       const words = await recognizeText(rotatedImageBuffer);
//       const rotatedWords = words.map(word => {
        
//         let {x0, x1, y0, y1} = word.bbox
//         let width = x1 - x0

//         const widthLimit = 500
//         if(width > widthLimit){
//           const centerX = parseInt(x0 + (width / 2))

//           x0 = centerX - (widthLimit / 2)
//           x1 = centerX + (widthLimit / 2)
//           width = widthLimit
//         }
        
//         return rotateCoordinates({
//         top: y0,
//         left: x0,
//         width: width,
//         height: y1 - y0,
//         text: word.text
//       }, degrees, imageWidth, imageHeight)});
//       allWords = allWords.concat(rotatedWords);
//     }

//     // Regular expression to match patterns like 1.8m
//     const measurementPattern = /\b\d+(\.\d+)?\s?m\b/;
//     const boxes = allWords.filter(word => measurementPattern.test(word.text));

//     // Flip image horizontally and get buffer
//     const flippedImageBuffer = await sharp(preprocessedImageBuffer).flop().toBuffer();

//     // Adjust coordinates for the horizontal flip
//     const flippedBoxes = boxes.map(box => flipCoordinatesHorizontally(box, imageWidth));

//     // Log recognized text with bounding boxes
//     flippedBoxes.forEach(box => {
//       console.log(`Recognized text: "${box.text}" at [left: ${box.left}, top: ${box.top}, width: ${box.width}, height: ${box.height}]`);
//     });

//     await drawBoundingBoxesAndFlippedText(flippedImageBuffer, flippedBoxes, outputPath, path.basename(imagePath));
//     console.log(`OCR and bounding box drawing complete for ${imagePath}`);
//   } catch (err) {
//     console.error('Error:', err);
//   }
// };

// /\b(?=.*[0-9])(?=.*[mM])[A-Za-z0-9.]+\b|\b[A-Za-z]*[0-9]+[A-Za-z]*\b|\b[A-Za-z]*[mM]+[A-Za-z]*\b/;

const performOCR = async (imagePath, outputPath) => {
  try {
    const recognizeText = async (image) => {
      const { data: { words, lines, symbols } } = await Tesseract.recognize(image, 'eng', {
        logger: m => m,
        langPath: '../scripts',
        tessedit_pageseg_mode: Tesseract.PSM.AUTO_OSD,
        dpi: 500
      });

      var newWords = words.map(thisWord => ({
        text: thisWord.text,
        bbox: thisWord.bbox, // The bounding box (x0, x1, y0, y1)
        confidence: thisWord.confidence  // Confidence level
      }));

      var newSymbol = symbols.map(thisSymbol => ({
        text: thisSymbol.text,
        bbox: thisSymbol.bbox, // The bounding box (x0, x1, y0, y1)
        confidence: thisSymbol.confidence  // Confidence level
      }));

      const temp = [...newWords, ...newSymbol ];
      return temp;
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
            text: box.text,
            confidence: box.confidence
          };
        case 180:
          return {
            top: imageHeight - box.top - box.height,
            left: imageWidth - box.left - box.width,
            width: box.width,
            height: box.height,
            text: box.text,
            confidence: box.confidence
          };
        case 270:
          return {
            top: box.left,
            left: imageHeight - box.top - box.height,
            width: box.height,
            height: box.width,
            text: box.text,
            confidence: box.confidence
          };
        default:
          return box;
      }
    };

    // Function to detect if two boxes intersect within 30px and merge them
    const mergeIntersectingBoxes = (boxes) => {
      const mergedBoxes = [];

      boxes.forEach((box, index) => {
        let merged = false;

        for (let i = 0; i < mergedBoxes.length; i++) {
          const existingBox = mergedBoxes[i];

          // Check if boxes are within 30px horizontally or vertically
          if (
            Math.abs(box.left - existingBox.left) <= 30 && Math.abs(box.top - existingBox.top) <= 30 ||    // Vertical proximity
            (box.left + box.width >= existingBox.left - 30 && box.left <= existingBox.left + existingBox.width + 30) && 
            (box.top + box.height >= existingBox.top - 30 && box.top <= existingBox.top + existingBox.height + 30)
          ) {
            // Merge boxes by adjusting the bounding box to fit both
            existingBox.left = Math.min(box.left, existingBox.left);
            existingBox.top = Math.min(box.top, existingBox.top);
            existingBox.width = Math.max(box.left + box.width, existingBox.left + existingBox.width) - existingBox.left;
            existingBox.height = Math.max(box.top + box.height, existingBox.top + existingBox.height) - existingBox.top;
            existingBox.text += ` ${box.text}`; // Combine the text
            merged = true;
            break;
          }
        }

        // If no existing box could be merged, add the box as a new one
        if (!merged) {
          mergedBoxes.push({ ...box });
        }
      });

      return mergedBoxes;
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
      const rotatedWords = words.map(word => {
        
        let { x0, x1, y0, y1 } = word.bbox;
        let width = x1 - x0;
        let height = y1 - y0;

        const widthLimit = 180;
        if (width > widthLimit) {
          const centerX = parseInt(x0 + (width / 2));

          x0 = centerX - (widthLimit / 2);
          x1 = centerX + (widthLimit / 2);
          width = widthLimit;
        }

        const heightLimit = 70;
        if (height > heightLimit) {
          const centerY = parseInt(y0 + (height / 2));

          y0 = centerY - (heightLimit / 2);
          y1 = centerY + (heightLimit / 2);
          height = heightLimit;
        }

        return rotateCoordinates({
          top: y0,
          left: x0,
          width: width,
          height: height,
          text: word.text,
          confidence: word.confidence
        }, degrees, imageWidth, imageHeight);
      });
      allWords = allWords.concat(rotatedWords);
    }

    // Regular expression to match patterns like 1.8m
    const measurementPattern = /\b(?=.*[0-9])(?=.*[mM])[A-Za-z0-9.]+\b|\b[A-Za-z]*[0-9]{2,}[A-Za-z]*\b|\b[A-Za-z]*[mM]+[A-Za-z]*\b/;
    let boxes = allWords.filter(word => measurementPattern.test(word.text));

    // Merge overlapping boxes within 30px proximity
    boxes = mergeIntersectingBoxes(boxes);

    // Flip image horizontally and get buffer
    const flippedImageBuffer = await sharp(preprocessedImageBuffer).flop().toBuffer();

    // Adjust coordinates for the horizontal flip using aggregate box center
    const flipCoordinatesHorizontally = (box, imageWidth) => {
      const centerX = box.left + box.width / 2;
      const newLeft = imageWidth - centerX - box.width / 2;
      return {
        ...box,
        left: newLeft
      };
    };

    const flippedBoxes = boxes.map(box => flipCoordinatesHorizontally(box, imageWidth));

    // Log recognized text with bounding boxes
    flippedBoxes.forEach(box => {
      console.log(`Recognized text: "${box.text}" at [left: ${box.left}, top: ${box.top}, width: ${box.width}, height: ${box.height}]`);
    });

    await drawBoundingBoxesAndFlippedText(flippedImageBuffer, flippedBoxes, outputPath, path.basename(imagePath), true);
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
const directoryPath = '../OCR Test/Balcony Dim PNG/Images to flip';
const outputPath = '../OCR Test/Balcony Dim PNG/Flipped';

// Create output directory if it doesn't exist
if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath);
}

processDirectory(directoryPath, outputPath);
