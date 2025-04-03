const fs = require("fs");
const sharp = require("sharp");
const path = require("path");

const input = "../tower-floorplate/original";
const output = "../tower-floorplate/output";
const configPath = "./tower-floorplate.json";

const files = fs.readdirSync(input);
const configFile = fs.readFileSync(configPath);
const config = JSON.parse(configFile);

const numberOfSections = 5;

// Separate base images from top images based on the underscore count in file names.
var baseImages = files.filter((e) => e.split("_").length < numberOfSections);
console.log("Base Images:", baseImages);

var topImages = files.filter((e) => e.split("_").length > numberOfSections - 1);
console.log("Top Images:", topImages);

// A set to keep track of which top images have been processed.
let processedTopImages = new Set();

async function loadImages(imageFile, transformations) {
  console.log("Transformations:", transformations);
  const thisImagePath = path.join(input, imageFile);
  const { width, height } = { width: 4320, height: 4320 };

  let loadedImage = sharp(thisImagePath).resize(width, height);

  if (Object.keys(transformations).includes("flipY")) {
    loadedImage = loadedImage.flop(transformations.flipY);
  }
  console.log("FlipY:", transformations.flipY);
  if (Object.keys(transformations).includes("flipX")) {
    loadedImage = loadedImage.flip(transformations.flipX);
  }
  console.log("FlipX:", transformations.flipX);

  if (Object.keys(transformations).includes("rotate") && transformations.rotate !== 0) {
    // Rotate with transparent background and crop centered to the target dimensions.
    loadedImage = await loadedImage
      .rotate(transformations.rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    const { width: rotatedWidth, height: rotatedHeight } = await sharp(loadedImage).metadata();
    const cropX = Math.max(0, (rotatedWidth - width) / 2);
    const cropY = Math.max(0, (rotatedHeight - height) / 2);

    loadedImage = sharp(loadedImage).extract({
      left: Math.round(cropX),
      top: Math.round(cropY),
      width: width,
      height: height,
    });
  }

  return await loadedImage.toBuffer();
}

async function compositeImages(topImage, bottomImage) {
  if (!fs.existsSync(output)) {
    fs.mkdirSync(output);
  }

  const loadedTopImage = await loadImages(topImage.image, topImage.config);
  const loadedBottomImage = await loadImages(bottomImage.image, bottomImage.config);

  const compositeOptions = [
    { input: loadedBottomImage, top: 0, left: 0 },
    { input: loadedTopImage, top: 0, left: 0 },
  ];

  const ext = path.extname(topImage.image).toLowerCase();
  let baseName = path.basename(topImage.image, ext);

  // If duplicate info is provided, replace the original marker with the duplicate value.
  if (topImage.config.duplicate && topImage.config.duplicateOriginal) {
    baseName = baseName.replace(topImage.config.duplicateOriginal, topImage.config.duplicate);
  } else {
    // Otherwise, replace the tower type with the tower name.
    baseName = baseName.replace(topImage.config.type, topImage.config.name);
  }
  const outputPath = path.join(output, `${baseName}.webp`);

  console.log("Processing composite:");
  console.log("Top Image: " + topImage.image);
  console.log("Bottom Image: " + bottomImage.image);
  console.log("Output Path: " + outputPath);

  await sharp({
    create: {
      width: 4320,
      height: 4320,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(compositeOptions)
    .webp(90)
    .toFile(outputPath)
    .then(info => {
      console.log(`Processed image saved: ${outputPath}`);
    })
    .catch(error => {
      console.log(error);
    });
}

// Helper: Try to match a tower configuration if the filename contains the tower name.
function getTowerConfigForFile(filename) {
  for (const tower of config.towers) {
    if (filename.includes(tower.name)) {
      return tower;
    }
  }
  return null;
}

const towers = config.towers;
towers.forEach((tower) => {
  // Find the base (bottom) image using the tower's name.
  let selectedBaseImage = baseImages.find((baseImage) => baseImage.includes(tower.name));
  if (!selectedBaseImage) {
    console.log("Base image not found for tower: " + tower.name);
    return;
  }

  // If the tower includes duplicate mappings, process each mapping.
  if (tower.duplicate && Array.isArray(tower.duplicate)) {
    tower.duplicate.forEach((dupMapping) => {
      // Find the original top image using the tower type and the duplicate mapping's "original" marker.
      let originalTopImage = topImages.find(
        (img) => img.includes(tower.type) && img.includes(dupMapping.original)
      );
      if (!originalTopImage) {
        console.log(`Original top image not found for tower ${tower.name} with marker ${dupMapping.original}`);
        return;
      }

      // ---- Generate the original composite image ----
      const baseImageConfig = { flip: false, rotate: 0, x: 0, y: 0 };
      const topImageOriginalConfig = {
        flipX: tower.flipX,
        flipY: tower.flipY,
        rotate: tower.rotate,
        x: tower.x,
        y: tower.y,
        type: tower.type,
        name: tower.name
      };
      compositeImages({ image: originalTopImage, config: topImageOriginalConfig }, { image: selectedBaseImage, config: baseImageConfig });
      processedTopImages.add(originalTopImage);

      // ---- Generate duplicate composite images ----
      dupMapping.duplicate.forEach((dupValue) => {
        const topImageDupConfig = {
          flipX: tower.flipX,
          flipY: tower.flipY,
          rotate: tower.rotate,
          x: tower.x,
          y: tower.y,
          type: tower.type,
          name: tower.name,
          duplicate: dupValue,
          duplicateOriginal: dupMapping.original
        };
        // Check if a duplicate file already exists in the input folder.
        const duplicateFileCandidate = topImages.find(
          (img) => img.includes(tower.type) && img.includes(dupValue)
        );
        if (duplicateFileCandidate) {
          console.log(`Using duplicate file from input folder for tower ${tower.name} with marker ${dupValue}`);
          compositeImages({ image: duplicateFileCandidate, config: topImageDupConfig }, { image: selectedBaseImage, config: baseImageConfig });
          processedTopImages.add(duplicateFileCandidate);
        } else {
          // Fall back to using the original top image with duplicate config.
          compositeImages({ image: originalTopImage, config: topImageDupConfig }, { image: selectedBaseImage, config: baseImageConfig });
          processedTopImages.add(originalTopImage);
        }
      });
    });
  } else {
    // For towers without duplicate mappings, process all top images that match the tower type.
    let selectedTopImages = topImages.filter((topImage) => topImage.includes(tower.type));
    console.log(tower.type);
    if (selectedTopImages && selectedTopImages.length > 0) {
      console.log("Selected Base Image: " + selectedBaseImage);
      console.log("Selected Top Images:", selectedTopImages);
      selectedTopImages.forEach((topImage) => {
        const baseImageConfig = { flip: false, rotate: 0, x: 0, y: 0 };
        const topImageConfig = {
          flipX: tower.flipX,
          flipY: tower.flipY,
          rotate: tower.rotate,
          x: tower.x,
          y: tower.y,
          type: tower.type,
          name: tower.name,
        };
        compositeImages({ image: topImage, config: topImageConfig }, { image: selectedBaseImage, config: baseImageConfig });
        processedTopImages.add(topImage);
      });
    } else {
      console.log("Failed: selectedBaseImage " + tower.name + " | " + "selectedTopImages " + tower.type);
    }
  }
});

// --- Process Unreferenced Files ---
// This function checks for any top images that were not processed in the towers loop.
function getBaseImageForTop(topFile) {
  const ext = path.extname(topFile);
  const baseName = path.basename(topFile, ext);
  const parts = baseName.split("_");
  // Remove the last part (assumed marker) to build candidate base image name.
  parts.pop();
  return parts.join("_") + ext;
}

function processUnreferencedFiles() {
  topImages.forEach((topFile) => {
    if (!processedTopImages.has(topFile)) {
      console.log(`Processing unreferenced top image: ${topFile}`);
      
      // Check if the filename contains a tower name. If yes, use that tower's config.
      const towerConfig = getTowerConfigForFile(topFile);
      let topConfig;
      if (towerConfig) {
        topConfig = {
          flipX: towerConfig.flipX,
          flipY: towerConfig.flipY,
          rotate: towerConfig.rotate,
          x: towerConfig.x,
          y: towerConfig.y,
          type: towerConfig.type,
          name: towerConfig.name
        };
      } else {
        // Otherwise, use a default transformation configuration.
        topConfig = {
          flipX: false,
          flipY: false,
          rotate: 0,
          x: 0,
          y: 0,
          type: "default",
          name: "default"
        };
      }
      
      // Try to find a matching base image by stripping the marker.
      const candidateBase = getBaseImageForTop(topFile);
      let selectedBaseImage = baseImages.find((baseImage) => baseImage === candidateBase);
      if (!selectedBaseImage) {
        console.log(`No matching base image found for unreferenced top image: ${topFile}`);
        return;
      }
      const baseImageConfig = { flip: false, rotate: 0, x: 0, y: 0 };
      compositeImages({ image: topFile, config: topConfig }, { image: selectedBaseImage, config: baseImageConfig });
      processedTopImages.add(topFile);
    }
  });
}

processUnreferencedFiles();
