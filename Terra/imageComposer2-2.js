const sharp = require('sharp');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// Directory paths
// const baseImageDir = './Arthouse/floorplan/segmented - distinct/POLISHED/S1 240806'
const floorplans = './Floorplans/original';
const balcony = './Balconies';
const DIMS = './DIMS/normal';
const flippedDIMS = './DIMS/flipped';
const typeReferencePath = "./reference.json"
const unitReferencePath = "./unit-reference.json"
const toIgnore = [".DS_Store", "ss"]


const typeReference = fsSync.readFileSync(typeReferencePath)
const typeReferenceData = JSON.parse(typeReference);
// const unitReference = fsSync.readFileSync(unitReferencePath)
// const unitReferenceData = JSON.parse(unitReference);
const typeData = typeReferenceData.types
// const unitData = unitReferenceData.units

let expectedOutput = {
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

function normalizeRotation(rotation) {
  return ((rotation % 360) + 360) % 360;
}

const objectify = (e, layer, folder) => {
  const squareBracketMatch = e.name.match(/\[(.*?)\]/)
  const tempModifications = squareBracketMatch ? squareBracketMatch[1].split("_"): [];
  const properties = tempModifications.length > 0 ? e.name.split("-")[1].split(".")[0].split("_") : e.name.split(".")[0].split("_")
  
  let modifications = {
    flip : tempModifications.includes("flipped"),
    rotation : tempModifications.includes("rotated") ? 180 : 0
  }
  
  console.log(properties)
  const bedroomData = properties.length > 7 ? {
    bedroomCount: properties[5].replace("f", ""),
    flipped: properties[5].includes("f") ? true : false,
  } : {
    bedroomCount: properties[3].replace("f", ""),
    flipped: properties[3].includes("f") ? true : false,
  }

  const object = properties.length > 7 ? {
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
  } : {
    typeData : {
      imageType: `${properties[0]}`,
      propertyType: properties[1],
      standardOrPremium: properties[2],
      bedroomCount: bedroomData.bedroomCount,
      flipped: bedroomData.flipped,
      variant: properties[4],
      schema: properties[5],
      floor: properties[6],
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


function compareData(data1, data2, toIgnore = {keys: ["imageType"]}) {

  const data1Filtered = Object.fromEntries(Object.entries(data1).filter(([key]) => !toIgnore.entries?.includes(key)));
  const data2Filtered = Object.fromEntries(Object.entries(data2).filter(([key]) => !toIgnore.entries?.includes(key)));

  // Early return if either data is null or undefined
  if (!data1Filtered || !data2Filtered) {
    console.log(data1Filtered ? "data2 is null or undefined" : "data1 is null or undefined");
    return false;
  }

  // Check if both objects have the same number of keys
  if (Object.keys(data1Filtered).length !== Object.keys(data2Filtered).length) {
    // console.log(data1)
    // console.log(data2)
    // console.log("Key length mismatch, returning false");
    return false;
  }

  // Compare values for each key in data1
  for (let key in data1Filtered) {
    if(toIgnore.keys?.includes(key)){
      continue;
    }
    if (data1Filtered[key] !== data2Filtered[key]) {
      // console.log(`${key} doesn't match: ${data1[key]} !== ${data2[key]}`);
      return false;
    }
  }

  // Compare values for each key in data2 (in case of extra keys)
  for (let key in data2Filtered) {
    if(toIgnore.keys?.includes(key)){
      continue;
    }
    if (data1Filtered[key] !== data2Filtered[key]) {
      // console.log(`${key} doesn't match: ${data1[key]} !== ${data2[key]}`);
      return false;
    }
  }

  console.log("Data1 and Data2 matched!");
  return true;
}

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

    const thisConfig = baseImageObj
    console.log(thisConfig.name)
    const filteredConfig = typeData.filter(e => thisConfig.name.includes(e.name))
    console.log("Filtered")
    console.log(filteredConfig[0].parent.rotation)
    console.log(thisConfig.config.rotation)

    const finalRotation = filteredConfig[0].parent.rotation + thisConfig.config.rotation


    baseImageObj.config.rotation = normalizeRotation(finalRotation)
    
    console.log(baseImageObj.config.rotation)
    console.log("Final Name")
    console.log(baseImageObj.finalName)

    const folderNames = path.join(outputDir, baseImageObj.finalName ? Object.values(baseImageObj.finalName).join("_") : Object.values(baseImageObj.config).join("_"));
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

    function nameContainsWords(name, words) {
        return words.some(word => name.includes(word));
    }

    baseImage.forEach((e) => {
      console.log(e)
      if(!nameContainsWords(e.name, toIgnore)){
        const imageObject = objectify(e, Layer.BaseImage, floorplans);
        console.log(imageObject)
        backplateImages.push(imageObject);
      }

    });

    balconyImage.forEach((e) => {
      if(!nameContainsWords(e.name, toIgnore)){
        // let normalizedNames = e
        // normalizedNames.name = e.name.replace("balcony", "backplate_image_floorplan")
        const imageObject = objectify(e, Layer.Balcony, balcony)
        backplateImages.push(imageObject);
      }

    });

    DIM.forEach((e) => {
      if(!nameContainsWords(e.name, toIgnore)){
        // let normalizedNames = e
        // normalizedNames.name = e.name.replace("dims", "backplate_image_floorplan")
        const imageObject = objectify(e, Layer.DIMS, DIMS)
        backplateImages.push(imageObject);
      }

    });

    DIMFlipped.forEach((e) => {
      if(!nameContainsWords(e.name, toIgnore)){
        // let normalizedNames = e
        // normalizedNames.name = e.name.replace("dims", "backplate_image_floorplan")
        const imageObject = objectify(e, Layer.DIMS, flippedDIMS)
        backplateImages.push(imageObject);
      }
    });

    

    const thisBaseImages = backplateImages.filter(e => e.imageData.layer === Layer.BaseImage);
    const thisDIM = backplateImages.filter(e => e.imageData.layer === Layer.DIMS);
    const thisBalcony = backplateImages.filter(e => e.imageData.layer === Layer.Balcony);

    const imageGroup = thisBaseImages.map((baseImage) => {
      const group = {
        baseImage,
        topImages: [ ...thisBalcony.filter(balcony => compareData(baseImage.typeData, balcony.typeData)), ...thisDIM.filter(dim => compareData(baseImage.typeData, dim.typeData))]
      };
      return group;
    });

    console.log(imageGroup)

    for (const group of imageGroup) {
      try{
        const baseImage = group.baseImage.imageData;
        const baseType = group.baseImage.typeData
        const selectedType = typeData.filter((e) => `${baseType.propertyType}_${baseType.standardOrPremium}_${baseType.bedroomCount}${baseType.flipped ? "f" : ""}_${baseType.variant}_${baseType.schema}_${baseType.floor}`.includes(e.name))[0]
        console.log(selectedType)
        console.log(`${baseType.propertyType}_${baseType.standardOrPremium}_${baseType.bedroomCount}${baseType.flipped ? "f" : ""}_${baseType.variant}_${baseType.schema}_${baseType.floor}`)
        const parentRotation = selectedType.parent.rotation
        console.log("baseType: " + `${baseType.propertyType}_${baseType.standardOrPremium}_${baseType.bedroomCount}${baseType.flipped ? "f" : ""}_${baseType.variant}_${baseType.schema}_${baseType.floor}`)
        const rotationData = [0, 90, 180, 270]
  
        if(rotationData.length > 0){
          expectedOutput.rotation = rotationData
        }
        const allPermutations = generatePermutations(expectedOutput);
        console.log(baseImage.name)
        console.log(allPermutations)
  
        // Process each configuration permutation sequentially
        for (const config of allPermutations) {
  
          let thisTopImages = [] //selected top images
  
          let imageRef = group.topImages
  
          const batch0 = imageRef
          .filter(e => e.imageData.layer == Layer.Balcony)
          .map(e => ({
            ...e.imageData,
            config: config
          }));
          thisTopImages.push(...batch0)
          imageRef = imageRef.filter(e => !batch0.some(batchItem => compareData(batchItem, e.imageData)));
  
  
          const batch1 = imageRef
            .filter(e => compareData(config, e.imageData.modifications))
            .map(e => ({
              ...e.imageData,
              config: { flip: false, rotation: 0 }
            }));
            thisTopImages.push(...batch1)
  
            imageRef = imageRef.filter(e => !batch1.some(batchItem => compareData(batchItem, e.imageData)));
  
            if(config.rotation == 90){
              const batch2 = imageRef
              .filter(e => e.imageData.modifications.rotation == 0 && e.imageData.modifications.flip == config.flip)
              .map(e => ({
                ...e.imageData,
                config: { flip: false, rotation: 90 }
              }));
              thisTopImages.push(...batch2)
              imageRef = imageRef.filter(e => !batch2.some(batchItem => compareData(batchItem, e.imageData)));
            }
  
            if(config.rotation == 270){
              const batch3 = imageRef
              .filter(e => e.imageData.modifications.rotation == 180 && e.imageData.modifications.flip == config.flip)
              .map(e => ({
                ...e.imageData,
                config: { flip: false, rotation: 90 }
              }));
              thisTopImages.push(...batch3)
              imageRef = imageRef.filter(e => !batch3.some(batchItem => compareData(batchItem, e.imageData)));
            }
  
          if (thisTopImages.length > 0) {
            // Set configuration to the base image
            baseImage.config = {...config};
  
            if(parentRotation > 0){
              const finalName = {...config}
              const originalRotation = JSON.parse(finalName.rotation)
              const originalFlip = JSON.parse(finalName.flip)
              const flipRotationOffset = originalFlip && (parentRotation == 90 || parentRotation == 270) ? 180 : 0
              console.log(allPermutations)
              console.log(config)
              console.log(`${originalRotation} - ${parentRotation} + ${originalFlip && (parentRotation == 90 || parentRotation == 270) ? 180 : 0}`)
              // console.log(originalRotation - selectedTypeRotation + originalFlip ? 180 : 0)
              finalName.rotation = normalizeRotation(originalRotation + parentRotation + flipRotationOffset)
              baseImage.finalName = {...finalName}
              // baseImage.config = {...config};
              // thisTopImages.forEach((e) => {
              //   e.config = {...config};
              // })
  
              if(baseImage.name.includes("2b_b1") || baseImage.name.includes("2b_b2")){
                console.log("Based Name")
                console.log(baseImage.name)
                console.log(config)
              }
            }
            await compositeImages(baseImage, thisTopImages);
          }
        }
      } catch (e){
        console.log(e)
      }

    }

    console.log('All images processed successfully.');
  } catch (error) {
    console.error('Error processing images:', error);
  }
}

layerImages();