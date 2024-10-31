const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Directory paths
// const baseImageDir = './Arthouse/floorplan/segmented - distinct/POLISHED/S1 240806'
const floorplans = './Floorplans/original';
const balcony = './Balconies';
const DIMS = './DIMS/normal';
const flippedDIMS = './DIMS/flipped';

const expectedOutput = {
  rotation: [0, 90, 180, 270],
  flip: [false, true]
}

function generatePermutations(config) {
  const keys = Object.keys(config);
  const result = [];

  function helper(index, current) {
    if (index === keys.length) {
      result.push({ ...current });
      return;
    }
    const key = keys[index];
    for (const value of config[key]) {
      current[key] = value;
      helper(index + 1, current);
    }
  }

  helper(0, {});
  return result;
}

const objectify = (e, layer, folder) => {
  const squareBracketMatch = e.name.match(/\[(.*?)\]/)
  const tempModifications = squareBracketMatch ? squareBracketMatch[1].split("_"): [];
  const properties = tempModifications.length > 0 ? e.name.split("-")[1].split(".")[0].split("_") : e.name.split(".")[0].split("_")
  let modifications = {
    flip : tempModifications.includes("flipped"),
    rotation : tempModifications.includes("rotated") ? 180 : 0
  }
  
  const bedroomData = {
    bedroomCount: properties[5].replace("f", ""),
    flipped: properties[5].includes("f") ? true : false,
  }

  const object = {
    typeData : {
      imageType: `${properties[0]}_${properties[1]}_${properties[2]}`,
      propertyType: properties[3],
      standardOrPremium: properties[4],
      bedroomCount: bedroomData.bedroomCount,
      flipped: bedroomData.flipped,
      variant: properties[6],
      schema: properties[7],
      floor: properties[8],
    },
    imageData: {
      pathTo: folder,
      name: e.name,
      layer: layer,
      modifications: modifications
    }
  }
  return object
}


function compareData(data1, data2) {

  for (let key in data1) {
    if (data1[key] !== data2[key]) {
      // console.log(`${imageData1.name}:${imageData2.name} ${key} doesnt match ${typeData1[key]}:${typeData2[key]}` )
      return false;
    }
  }
  // console.log(`${imageData1.name} matched ${imageData2.name}!`)
  return true;
}

// async function compositeImages(baseImage, topImages){
//   const left = 0;
//   const top = 0;

//   const loadedBaseImage = await sharp(baseImage)
//   .resize(4320, 4320)
//   .rotate(180)
//   .toBuffer();

//   const loadedTopImage = await Promise.all(
//     topImages.map(async (topImage) => {
//       return await sharp(path.join(topImage.pathTo, topImage.name))
//         .resize(4320, 4320)
//         .rotate(rotateTop ? 180 : 0)
//         .flop(flopTop)
//         .toBuffer();
//     })
//   )

//   const compositeOptions = [
//     { input: loadedBaseImage, top, left },
//   ];

//   const topComposites = loadedTopImage.map((e) => { return {input: loadedBaseImage, top, left}})

//   compositeOptions = [...compositeOptions, ...topComposites]

// }

async function compositeImages(baseImageObj, topImagesObj) {
  try {
    const baseImagePath = path.join(baseImageObj.pathTo, baseImageObj.name);
    const loadedBaseImage = await sharp(baseImagePath)
      .resize(4320, 4320)
      .rotate(baseImageObj.config.rotation || 0)
      .flop(baseImageObj.config.flip || false)
      .toBuffer();

    const loadedTopImages = await Promise.all(
      topImagesObj.map(async (topImage) => {
        return await sharp(path.join(topImage.pathTo, topImage.name))
          .resize(4320, 4320)
          .rotate(topImage.config.rotation || 0)
          .flop(topImage.config.flip || false)
          .toBuffer();
      })
    );

    const compositeOptions = [{ input: loadedBaseImage, top: 0, left: 0 }];
    loadedTopImages.forEach((topImageBuffer) => {
      compositeOptions.push({ input: topImageBuffer, top: 0, left: 0 });
    });

    // Ensure the output directory exists
    const outputDir = "./Floorplans/output";
    await fs.mkdir(outputDir, { recursive: true });

    // Generate the output folder based on config values
    const folderNames = path.join(outputDir, Object.values(baseImageObj.config).join("_"));
    await fs.mkdir(folderNames, { recursive: true });

    console.log(`Merging ${baseImageObj.name} [${Object.values(baseImageObj.config).join("_")}]`);

    await sharp({
      create: {
        width: 4320,
        height: 4320,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite(compositeOptions)
      .png()
      .toFile(path.join(folderNames, baseImageObj.name));
    
    console.log(`Image ${baseImageObj.name} saved successfully for config ${Object.values(baseImageObj.config).join("_")}`);
  } catch (error) {
    console.error(`Error in compositing images for ${baseImageObj.name}:`, error);
  }
}


// Function to layer images
async function layerImages() {
  try {
    const allPermutations = generatePermutations(expectedOutput);

    // Read directories with file types
    const baseImage = await fs.readdir(floorplans, { withFileTypes: true });
    const balconyImage = await fs.readdir(balcony, { withFileTypes: true });
    const DIM = await fs.readdir(DIMS, { withFileTypes: true });
    const DIMFlipped = await fs.readdir(flippedDIMS, { withFileTypes: true });

    const Layer = {
      BaseImage: 'baseImage',
      Balcony: 'balcony',
      DIMS: 'dims'
    };

    const backplateImages = [];

    baseImage.forEach((e) => {
      const imageObject = objectify(e, Layer.BaseImage, floorplans);
      backplateImages.push(imageObject);
    });

    balconyImage.forEach((e) => {
      const imageObject = objectify(e, Layer.Balcony, balcony);
      backplateImages.push(imageObject);
    });

    DIM.forEach((e) => {
      const imageObject = objectify(e, Layer.DIMS, DIMS);
      backplateImages.push(imageObject);
    });

    DIMFlipped.forEach((e) => {
      const imageObject = objectify(e, Layer.DIMS, flippedDIMS);
      backplateImages.push(imageObject);
    });

    const thisBaseImages = backplateImages.filter(e => e.imageData.layer === Layer.BaseImage);
    const thisDIM = backplateImages.filter(e => e.imageData.layer === Layer.DIMS);
    const thisBalcony = backplateImages.filter(e => e.imageData.layer === Layer.Balcony);

    const imageGroup = thisBaseImages.map((baseImage) => {
      const group = {
        baseImage,
        topImages: thisDIM.filter(dim => compareData(baseImage.typeData, dim.typeData))
      };
      return group;
    });

    for (const group of imageGroup) {
      const baseImage = group.baseImage.imageData;

      // Process each configuration permutation sequentially
      for (const config of allPermutations) {

        let thisTopImages = [] //selected top images

        thisTopImages = thisBalcony.map(e => ({
          ...e.imageData,
          config: config
        }));

        //Default Orientations
        const batch1 = group.topImages
          .filter(e => compareData(config, e.imageData.modifications))
          .map(e => ({
            ...e.imageData,
            config: { flip: false, rotation: 0 }
          }));
          console.log(batch1)
          thisTopImages.push(...batch1)

          if(config.rotation == 90){
            const batch2 = group.topImages
            .filter(e => e.imageData.modifications.rotation == 0 && e.imageData.modifications.flip == config.flip)
            .map(e => ({
              ...e.imageData,
              config: { flip: false, rotation: 90 }
            }));
            
            thisTopImages.push(...batch2)
          }

          if(config.rotation == 270){
            const batch3 = group.topImages
            .filter(e => e.imageData.modifications.rotation == 180 && e.imageData.modifications.flip == config.flip)
            .map(e => ({
              ...e.imageData,
              config: { flip: false, rotation: 90 }
            }));

            thisTopImages.push(...batch3)
          }
          console.log(thisTopImages)



        if (thisTopImages.length > 0) {
          // Set configuration to the base image
          baseImage.config = config;
          await compositeImages(baseImage, thisTopImages);
        }
      }
    }

    console.log('All images processed successfully.');
  } catch (error) {
    console.error('Error processing images:', error);
  }
}


    // const topImageFiles = DIM
    //   .filter(entry => entry.isFile() && !entry.name.toLowerCase().includes('Flipped'))
    //   .map(entry => entry.name.toLowerCase());
    //   console.log(baseImageFiles)

    // // Process only files that are present in both directories
    // for (const baseImageFile of baseImageFiles) {
    //   const bottomFileBaseName = baseImageFile.split('_')[0].toLowerCase();
    //   var level 
    //   if(baseImageFile.includes("Upper")){
    //     level = "Upper"
    //   } else if(baseImageFile.includes("Lower")) {
    //     level = "Lower"
    //   } else {
    //     level = ""
    //   }
    //   const matchingTopImageFile = topImageFiles.find(topFile => topFile.toLowerCase().includes(level == "" ? bottomFileBaseName : bottomFileBaseName + "_" + level));

    //   if (!matchingTopImageFile) {
    //     console.warn(`No matching top image for ${baseImageFile}`);
    //     continue;
    //   }

    //   // Construct the full paths
    //   const baseImagePath = path.join(baseImageDir, baseImageFile);
    //   const topImagePath = path.join(topImageDir, matchingTopImageFile);
    //   const topFlippedImagePath = path.join(topImageDir, `Flipped_${matchingTopImageFile}`);






    //   // Load and resize the top image


    //   // Calculate the coordinates to center the top image on the bottom image
    //   const left = 0;
    //   const top = 0;

    //   // Create composite options for normal and flipped images
    //   const compositeOptions = [
    //     { input: baseImage, top, left },
    //     { input: topImage, top, left }
    //   ];

    //   const compositeOptionsFlipped = [
    //     { input: baseImageFlipped, top, left },
    //     { input: topFlippedImage, top, left }
    //   ];
    //   console.log(matchingTopImageFile)
    //   // Composite the images and save as PNG without compression artifacts


    //   async function createImage(){
    //     const finalImage = await sharp(baseImage)
    //     .composite(compositeOptions)
    //     .png({ compressionLevel: 7 }) // Use compressionLevel: 0 for no compression artifacts
    //     .toFile(path.join(baseImageDir + "/DIMS 180", `${path.parse(baseImageFile).name}.png`));
    //     console.log(topImage)
    //     console.log(path.join(baseImageDir + "/DIMS 180", `${path.parse(baseImageFile).name}.png`))

    //   console.log(`Image processing complete for ${baseImageFile}:`, finalImage);

    //   // Composite the flipped images and save as PNG without compression artifacts
    //   const finalFlippedImage = await sharp(baseImage)
    //     .composite(compositeOptionsFlipped)
    //     .png({ compressionLevel: 7 }) // Use compressionLevel: 0 for no compression artifacts
    //     .toFile(path.join(baseImageDir + "/DIMS 180", `${path.parse(baseImageFile).name}_Flipped.png`));
    //     console.log(topImage)
    //     console.log(path.join(baseImageDir + "/DIMS 180", `${path.parse(baseImageFile).name}_Flipped.png`))
    //   console.log(`Flipped image processing complete for ${baseImageFile}:`, finalFlippedImage);
    //   }

    //   // if(matchingTopImageFile.toLowerCase().includes("2bra1")){
    //     createImage()
    //   // } 
      

    // }



// Execute the function
layerImages();