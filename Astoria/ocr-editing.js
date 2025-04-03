
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');



// Function to preprocess the image for better OCR
const preprocessImage = async (imagePath) => {
  return sharp(imagePath)
    .grayscale()
    .toBuffer();
};


const drawBoundingBoxesAndFlippedText = async (flippedImageBuffer, boxes, outputPath, imageName, prefix) => {
  const { width: imageWidth, height: imageHeight } = await sharp(flippedImageBuffer).metadata();

  let mask = sharp({
    create: {
      width: imageWidth,
      height: imageHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
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

  const maskedImageBuffer = await sharp(flippedImageBuffer)
    .composite([{ input: maskBuffer, blend: 'dest-out' }])
    .toBuffer();

  let compositeImages = [];
  for (const box of boxes) {

    // Extract and flip the text box
    let textImage = sharp(flippedImageBuffer).extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    if(prefix.includes("flipped")){
      textImage = textImage.flop()
    }
    
    if(prefix.includes("rotated")){
      textImage = textImage.rotate(180)
    }
      
    textImage = await textImage.toBuffer();
      
    compositeImages.push({
      input: textImage,
      top: box.top,
      left: box.left
    });

    const confidenceText = `Confidence: ${box.confidence}%`;  // Format confidence to 2 decimals
    const textSVG = Buffer.from(`
      <svg width="${imageWidth}" height="${imageHeight}">
        <text x="${box.left}" y="${Math.max(box.top - 20, 10)}" font-size="15" fill="red">${box.text}</text>
        <text x="${box.left}" y="${Math.max(box.top - 5, 20)}" font-size="15" fill="red">${confidenceText}</text>
      </svg>
    `);

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
  if(!fs.existsSync(path.join(outputPath, "flipped"))){
    fs.mkdirSync(path.join(outputPath, "flipped"))
  }

  if(!fs.existsSync(path.join(outputPath, "normal"))){
    fs.mkdirSync(path.join(outputPath, "normal"))
  }

  await sharp(outputBuffer)
    .toFile(path.join(outputPath, `${prefix.includes("flipped") ? "flipped" : "normal"}/[${prefix}]-${imageName}`));

  console.log(`Image saved as [${prefix}]-${imageName}`);
};

async function parseSVGMask(svgPath) {
  const svgData = fs.readFileSync(svgPath, 'utf8');
  const parser = new xml2js.Parser();

  // Parse SVG and extract bounding boxes
  const svgJson = await parser.parseStringPromise(svgData);
  const boxes = [];

  // Assuming rectangles represent areas of interest
  const rects = svgJson.svg.rect;
  rects.forEach(rect => {
    let x = Math.round(rect.$.x);
    let y = Math.round(rect.$.y);
    let width = Math.round(rect.$.width);
    let height = Math.round(rect.$.height);

// Check for a `transform` attribute and look for `rotate()`
if (rect.$.transform) {
  const rotateMatch = /rotate\(([^)]+)\)/.exec(rect.$.transform);
  if (rotateMatch) {
    const angle = parseFloat(rotateMatch[1]);
    const radians = angle * (Math.PI / 180);

    // Calculate the center of the rectangle
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    // Calculate the new corners after rotation
    const corners = [
      { x: x - centerX, y: y - centerY },                   // Top-left
      { x: x + width - centerX, y: y - centerY },           // Top-right
      { x: x - centerX, y: y + height - centerY },          // Bottom-left
      { x: x + width - centerX, y: y + height - centerY }   // Bottom-right
    ].map(corner => {
      return {
        x: centerX + corner.x * Math.cos(radians) - corner.y * Math.sin(radians),
        y: centerY + corner.x * Math.sin(radians) + corner.y * Math.cos(radians)
      };
    });

    // Find the new bounding box
    const minX = Math.min(...corners.map(corner => corner.x));
    const maxX = Math.max(...corners.map(corner => corner.x));
    const minY = Math.min(...corners.map(corner => corner.y));
    const maxY = Math.max(...corners.map(corner => corner.y));

    // Update x, y, width, and height to the new bounding box
    x = Math.round(minX);
    y = Math.round(minY);
    width = Math.round(maxX - minX);
    height = Math.round(maxY - minY);
  }
}

boxes.push({
  left: x,
  top: y,
  width: width,
  height: height,
  text: "Custom Box"
});
});

return boxes;
}

const performOCR = async (imagePath, outputPath, SVGDirPath) => {
  const preprocessedImageBuffer = await preprocessImage(imagePath);
  const image = sharp(preprocessedImageBuffer);
  const metadata = await image.metadata();
  const imageWidth = metadata.width;
  const imageHeight = metadata.height;
  try {
    const recognizeText = async (image) => {
      const { data: { words, lines, symbols } } = await Tesseract.recognize(image, 'eng', {
        logger: m => m,
        langPath: '../scripts',
        tessedit_pageseg_mode: Tesseract.PSM.AUTO_OSD,
        dpi: 700
      });

      var newLines = lines.map(thisLine => ({
        text: thisLine.text,
        bbox: thisLine.bbox, // The bounding box (x0, x1, y0, y1)
        confidence: thisLine.confidence  // Confidence level
      }));

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

      const temp = [...newWords];
      return temp;
    };

    const rotateImage = async (imagePath, degrees) => {
      const buffer = await sharp(imagePath).rotate(degrees).flatten({ background: { r: 0, g: 0, b: 0 } }).toBuffer();
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
    const mergeIntersectingBoxes = (boxes, width) => {
      const mergedBoxes = [];

      boxes.forEach((box, index) => {
        let merged = false;

        for (let i = 0; i < mergedBoxes.length; i++) {
          const existingBox = mergedBoxes[i];

          // Check if boxes are within 30px horizontally or vertically
          if (
            Math.abs(box.left - existingBox.left) <= width && Math.abs(box.top - existingBox.top) <= width ||    // Vertical proximity
            (box.left + box.width >= existingBox.left - width && box.left <= existingBox.left + existingBox.width + width) && 
            (box.top + box.height >= existingBox.top - width && box.top <= existingBox.top + existingBox.height + width)
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

        if (!merged) {
          mergedBoxes.push({ ...box });
        }
      });

      return mergedBoxes;
    };

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

    // Regex to match patterns like 1.8m
    // const measurementPattern = /\b(?=.*[0-9])(?=.*[mM])[A-Za-z0-9.]+\b|\b[A-Za-z]*[0-9]{2,}[A-Za-z]*\b|\b[A-Za-z]*[mM]+[A-Za-z]*\b/;
    const measurementPattern = /\b(?=.*[0-9])(?=.*[mM])[A-Za-z0-9.]+\b|\b[A-Za-z]*[0-9]{2,}[A-Za-z]*\b|\b[A-Za-z]*[mM]+[A-Za-z]*\b/;
    const textToIgnore = ["(", ")", "em"]
    let boxes = allWords.filter(word => measurementPattern.test(word.text))
    boxes = boxes.filter(word => {
      // Check if the word.text does not include any of the strings in textToIgnore
      return !textToIgnore.some(ignore => word.text.replace(" ", "").includes(ignore.replace(" ", "")));
    })
  } catch(e) {
    console.error("OCR failed to perform")
  }

   try{
    console.log("initiating SVG")
    const allSVGFiles = fs.readdirSync(SVGDirPath).filter(e => !e.toLowerCase().includes("ds_store"))
    console.log(allSVGFiles)
    const svgPath = allSVGFiles.filter((svgFilename) => imagePath.split(".")[0].includes(svgFilename.split(".")[0]))
    console.log(svgPath)
    console.log(path.extname(svgPath[0]))
    var boxes = []
    if(svgPath.length > 0 && path.extname(svgPath[0]).toLowerCase().includes("svg")){
      try {

        const customBoxes = await parseSVGMask(path.join(SVGDirPath, svgPath[0]))
        console.log(customBoxes)
        boxes = [...boxes, ...customBoxes]
        console.log(`${customBoxes.length} boxes added for ${imagePath}`)
      } catch (e){
        console.log(path.join(SVGDirPath, svgPath[0]))
        console.log(e)
      }
    }

    // Merge overlapping boxes within 30px proximity
    // boxes = mergeIntersectingBoxes(boxes, 10);


    // Flop() image horizontally and get buffer
    // const originalImageBuffer = await sharp(preprocessedImageBuffer).toBuffer();
    const baseName = path.basename(imagePath)
    const outputFolder = path.join(outputPath, "normal")
    fs.copyFileSync(imagePath, path.join(outputFolder, baseName))
    const flippedImageBuffer = await sharp(preprocessedImageBuffer).flop().toBuffer();
    const rotated180ImageBuffer = await sharp(preprocessedImageBuffer).rotate(180).toBuffer();
    const flippedRotated180ImageBuffer = await sharp(preprocessedImageBuffer).flop().rotate(180).toBuffer();

    // Flop() boxes across image center
    const flipCoordinatesHorizontally = (box, imageWidth) => {
      const centerX = box.left + box.width / 2;
      const newLeft = imageWidth - centerX - box.width / 2;
      return {
        ...box,
        left: newLeft
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

    const flippedRotateCoordinates180 = (box, imageWidth, imageHeight) => {
      // First, flip horizontally
      const centerX = box.left + box.width / 2;
      const flippedLeft = imageWidth - centerX - box.width / 2;
    
      // Then apply 180-degree rotation on the flipped box
      return {
        top: imageHeight - box.top - box.height,
        left: imageWidth - flippedLeft - box.width,
        width: box.width,
        height: box.height,
        text: box.text
      };
    };

    const flippedBoxes = boxes.map(box => flipCoordinatesHorizontally(box, imageWidth));

    // Log recognized text with bounding boxes
    flippedBoxes.forEach(box => {
      console.log(`Recognized text: "${box.text}" at [left: ${box.left}, top: ${box.top}, width: ${box.width}, height: ${box.height}]`);
    });

    await drawBoundingBoxesAndFlippedText(flippedImageBuffer, flippedBoxes, outputPath, path.basename(imagePath), "flipped");
    console.log(`OCR and bounding box drawing complete for ${imagePath}`);

    const rotated180boxes = boxes.map(box => rotateCoordinates180(box, imageWidth, imageHeight))
    await drawBoundingBoxesAndFlippedText(rotated180ImageBuffer, rotated180boxes, outputPath, path.basename(imagePath), "rotated");

    const flippedRotated180boxes = boxes.map(box => flippedRotateCoordinates180(box, imageWidth, imageHeight))
    await drawBoundingBoxesAndFlippedText(flippedRotated180ImageBuffer, flippedRotated180boxes, outputPath, path.basename(imagePath), "flipped_rotated");
  } catch (err) {
    console.error("SVG Loading failed to perform");
    console.error(err)
  }
};




// Function to process all images in a directory
const processDirectory = async (directoryPath, outputPath, customSVGDir) => {

  

  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return;
    }

    files.forEach(file => {
      const filePath = path.join(directoryPath, file);
      if (path.extname(file).toLowerCase() === '.png' || path.extname(file).toLowerCase() === '.jpg' || path.extname(file).toLowerCase() === '.jpeg') {
        performOCR(filePath, outputPath, customSVGDir);
      }
    });
  });
};

// Specify the path to your directory and the output directory
const SVGDirectoryPath = './DIMS/mask';
const directoryPath = './DIMS/original';
const outputPath = './DIMS';

// Create output directory if it doesn't exist
if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath);
}

processDirectory(directoryPath, outputPath, SVGDirectoryPath);
