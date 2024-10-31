const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Directory paths
// const bottomImageDir = './Arthouse/floorplan/segmented - distinct/POLISHED/S1 240806'
const bottomImageDir = './Arthouse/floorplan/segmented - distinct/POLISHED/S2 240806';
// const topImageDir = './OCR Test/New';
const topImageDir = './OCR Test/New 180';

// Function to layer images
async function layerImages() {
  try {
    // Read directories with file types
    const bottomEntries = await fs.readdir(bottomImageDir, { withFileTypes: true });
    const topEntries = await fs.readdir(topImageDir, { withFileTypes: true });

    // Filter out directories and get only files
    const bottomImageFiles = bottomEntries
      .filter(entry => entry.isFile())
      .map(entry => entry.name.toLowerCase());
      console.log(bottomImageFiles)

    const topImageFiles = topEntries
      .filter(entry => entry.isFile() && !entry.name.toLowerCase().includes('Flipped'))
      .map(entry => entry.name.toLowerCase());
      console.log(bottomImageFiles)

    // Process only files that are present in both directories
    for (const bottomImageFile of bottomImageFiles) {
      const bottomFileBaseName = bottomImageFile.split('_')[0].toLowerCase();
      var level 
      if(bottomImageFile.includes("Upper")){
        level = "Upper"
      } else if(bottomImageFile.includes("Lower")) {
        level = "Lower"
      } else {
        level = ""
      }
      const matchingTopImageFile = topImageFiles.find(topFile => topFile.toLowerCase().includes(level == "" ? bottomFileBaseName : bottomFileBaseName + "_" + level));

      if (!matchingTopImageFile) {
        console.warn(`No matching top image for ${bottomImageFile}`);
        continue;
      }

      // Construct the full paths
      const bottomImagePath = path.join(bottomImageDir, bottomImageFile);
      const topImagePath = path.join(topImageDir, matchingTopImageFile);
      const topFlippedImagePath = path.join(topImageDir, `Flipped_${matchingTopImageFile}`);


      // Load and resize the bottom image
      const bottomImage = await sharp(bottomImagePath)
        .resize(4320, 4320)
        .rotate(180)
        .toBuffer();

      const bottomImageFlipped = await sharp(bottomImagePath)
        .resize(4320, 4320)
        .flop()
        .rotate(180)
        .toBuffer();

      // Load and resize the top image
      const topImage = await sharp(topImagePath)
        .resize(4320, 4320)
        .toBuffer();

      const topFlippedImage = await sharp(topFlippedImagePath)
        .resize(4320, 4320)
        .toBuffer();

      // Calculate the coordinates to center the top image on the bottom image
      const left = 0;
      const top = 0;

      // Create composite options for normal and flipped images
      const compositeOptions = [
        { input: bottomImage, top, left },
        { input: topImage, top, left }
      ];

      const compositeOptionsFlipped = [
        { input: bottomImageFlipped, top, left },
        { input: topFlippedImage, top, left }
      ];
      console.log(matchingTopImageFile)
      // Composite the images and save as PNG without compression artifacts


      async function createImage(){
        const finalImage = await sharp(bottomImage)
        .composite(compositeOptions)
        .png({ compressionLevel: 7 }) // Use compressionLevel: 0 for no compression artifacts
        .toFile(path.join(bottomImageDir + "/DIMS 180", `${path.parse(bottomImageFile).name}.png`));
        console.log(topImage)
        console.log(path.join(bottomImageDir + "/DIMS 180", `${path.parse(bottomImageFile).name}.png`))

      console.log(`Image processing complete for ${bottomImageFile}:`, finalImage);

      // Composite the flipped images and save as PNG without compression artifacts
      const finalFlippedImage = await sharp(bottomImage)
        .composite(compositeOptionsFlipped)
        .png({ compressionLevel: 7 }) // Use compressionLevel: 0 for no compression artifacts
        .toFile(path.join(bottomImageDir + "/DIMS 180", `${path.parse(bottomImageFile).name}_Flipped.png`));
        console.log(topImage)
        console.log(path.join(bottomImageDir + "/DIMS 180", `${path.parse(bottomImageFile).name}_Flipped.png`))
      console.log(`Flipped image processing complete for ${bottomImageFile}:`, finalFlippedImage);
      }

      // if(matchingTopImageFile.toLowerCase().includes("2bra1")){
        createImage()
      // } 
      

    }

    console.log('All images processed successfully.');
  } catch (error) {
    console.error('Error processing images:', error);
  }
}

// Execute the function
layerImages();