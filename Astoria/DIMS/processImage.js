const sharp = require('sharp');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// Helper: Parse the SVG and extract rect attributes.
function parseSVG(svgContent) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(svgContent, (err, result) => {
      if (err) return reject(err);
      // Assume the <rect> elements are direct children of <svg>
      const rects = (result.svg && result.svg.rect) || [];
      // Each rect's attributes are stored in the '$' property.
      const rectAttributes = rects.map(rect => rect['$']);
      resolve(rectAttributes);
    });
  });
}

// Process one image/mask pair:
//  - imagePath: full path to the base image.
//  - maskPath: full path to the corresponding SVG mask.
//  - outputPath: full path where the final composite image will be saved.
async function processPair(imagePath, maskPath, outputPath) {
  try {
    // Read the base image buffer.
    const imageBuffer = await fs.readFile(imagePath);
    // Ensure the base image has an alpha channel.
    const baseImage = sharp(imageBuffer).ensureAlpha();
    
    // Read and parse the SVG mask.
    const svgContent = await fs.readFile(maskPath, 'utf8');
    const rects = await parseSVG(svgContent);
    
    // Filter rects: only select those with height > width.
    const selectedRects = rects.filter(r => {
      const width = parseFloat(r.width);
      const height = parseFloat(r.height);
      return height > width;
    });
    
    console.log(`Processing ${path.basename(imagePath)}: Found ${selectedRects.length} rect(s) with h > w.`);
    
    // --- Step 1: Prepare rotated overlays.
    const rotatedOverlays = [];
    for (const rect of selectedRects) {
      const x = Math.round(parseFloat(rect.x));
      const y = Math.round(parseFloat(rect.y));
      const width = Math.round(parseFloat(rect.width));
      const height = Math.round(parseFloat(rect.height));
      
      // Validate dimensions.
      if (width <= 0 || height <= 0) {
        console.error("Invalid dimensions for rect:", rect);
        continue;
      }
      
      try {
        // Extract the region from the base image, rotate it by 180° and ensure an alpha channel.
        const rotatedBuffer = await sharp(imageBuffer)
          .extract({ left: x, top: y, width, height })
          .rotate(180)
          .ensureAlpha()
          .toBuffer();
          
        rotatedOverlays.push({
          input: rotatedBuffer,
          top: y,
          left: x
        });
      } catch (e) {
        console.error("Error extracting and rotating region:", rect, e);
      }
    }
    
    // --- Step 2: Clear the selected regions in the base image using white boxes with dest-out.
    const clearOverlays = [];
    for (const rect of selectedRects) {
      const x = Math.round(parseFloat(rect.x));
      const y = Math.round(parseFloat(rect.y));
      const width = Math.round(parseFloat(rect.width));
      const height = Math.round(parseFloat(rect.height));
      
      try {
        // Create a white rectangle (fully opaque) of the same size.
        const whiteBoxBuffer = await sharp({
          create: {
            width,
            height,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          }
        })
          .png()
          .toBuffer();
          
        clearOverlays.push({
          input: whiteBoxBuffer,
          top: y,
          left: x,
          blend: 'dest-out'
        });
      } catch (e) {
        console.error("Error creating white box for rect:", rect, e);
      }
    }
    
    // First, composite the clear overlays to remove content (clear the areas).
    let compositeImage = await baseImage.composite(clearOverlays).toBuffer();
    
    // Then, composite the rotated overlays on top (default blend mode 'over').
    compositeImage = await sharp(compositeImage)
      .composite(rotatedOverlays)
      .png()
      .toBuffer();
    
    // Save the final composite image.
    await fs.writeFile(outputPath, compositeImage);
    console.log(`Saved processed image to ${outputPath}`);
  } catch (err) {
    console.error(`Error processing pair for ${imagePath} and ${maskPath}:`, err);
  }
}

async function main() {
  // Update directory paths as needed.
  const imagesDir = path.join(__dirname, 'original');
  const masksDir = path.join(__dirname, 'mask');
  const outputDir = path.join(__dirname, 'rotated');
  
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (e) {
    console.error("Error creating output directory:", e);
  }
  
  // Supported image extensions.
  const supportedExts = new Set(['.png', '.jpg', '.jpeg', '.webp']);
  
  let imageFiles;
  try {
    imageFiles = (await fs.readdir(imagesDir)).filter(file => supportedExts.has(path.extname(file).toLowerCase()));
  } catch (e) {
    console.error("Error reading images directory:", e);
    return;
  }
  
  if (imageFiles.length === 0) {
    console.log("No images found in", imagesDir);
    return;
  }
  
  // Process each image and its corresponding mask (mask file should have the same basename with .svg extension)
  for (const imageFile of imageFiles) {
    const baseName = path.parse(imageFile).name;
    const imagePath = path.join(imagesDir, imageFile);
    const maskPath = path.join(masksDir, baseName + '.svg');
    
    if (!fsSync.existsSync(maskPath)) {
      console.log(`No mask found for ${imageFile} in ${masksDir}. Skipping.`);
      continue;
    }
    
    const outputPath = path.join(outputDir, imageFile);
    await processPair(imagePath, maskPath, outputPath);
  }
}

main().catch(err => console.error(err));
