const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Directory paths
const bottomImageDir = '../Arthouse Variation/New Backplates/Original';
const topImageDir = '../Arthouse Variation/New Backplates/Upscaled';
const maskImageDir = 'path/to/mask-images-directory'; // Mask images directory

// Function to layer images
async function layerImages() {
  try {
    // Read directories with file types
    const bottomEntries = await fs.readdir(bottomImageDir, { withFileTypes: true });
    const topEntries = await fs.readdir(topImageDir, { withFileTypes: true });

    // Filter out directories and get only files
    const bottomImageFiles = bottomEntries
      .filter(entry => entry.isFile())
      .map(entry => entry.name);

    const topImageFiles = topEntries
      .filter(entry => entry.isFile())
      .map(entry => entry.name);

    // Process only files that are present in both directories
    for (const bottomImageFile of bottomImageFiles) {
      if (!topImageFiles.includes(bottomImageFile)) {
        console.warn(`No matching top image for ${bottomImageFile}`);
        continue;
      }

      // Construct the full paths
      const bottomImagePath = path.join(bottomImageDir, bottomImageFile);
      const topImagePath = path.join(topImageDir, bottomImageFile); // Assuming filenames match

      // Check if a mask image exists for the current bottom image
      const maskImagePath = path.join(maskImageDir, bottomImageFile);
      console.log(bottomImagePath);
      console.log(topImagePath);
      console.log(maskImagePath);

      // Load and resize the bottom image
      const bottomImage = await sharp(bottomImagePath)
        .resize(8640, 8640)
        .toBuffer();

      // Load and resize the top image
      const topImage = await sharp(topImagePath)
        .resize(5840, 5840)
        .toBuffer();

      // Calculate the coordinates to center the top image on the bottom image
      const left = (4320 - 2920);
      const top = (4320 - 2920);

      // Check if a mask image exists and load it if available
      let compositeOptions = { input: topImage, top, left };
      if (await fs.access(maskImagePath).then(() => true).catch(() => false)) {
        const maskImage = await sharp(maskImagePath)
          .resize(2180, 2180)
          .toBuffer();

        compositeOptions = {
          ...compositeOptions,
          blend: 'dest-in',
          mask: {
            input: maskImage,
            top: 0,
            left: 0,
          }
        };
        console.log("Mask Done");
      }

      // Composite the images and save as PNG without compression artifacts
      const finalImage = await sharp(bottomImage)
        .composite([compositeOptions])
        .png({ compressionLevel: 0 }) // Use compressionLevel: 0 for no compression artifacts
        .toFile(`floorplan_type_variation/${path.parse(bottomImageFile).name}.png`);

      console.log(`Image processing complete for ${bottomImageFile}:`, finalImage);
    }

    console.log('All images processed successfully.');
  } catch (error) {
    console.error('Error processing images:', error);
  }
}

// Execute the function
layerImages();