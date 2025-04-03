/**
 * singleFileCompositor.js
 */
const { Worker, isMainThread, parentPort } = require('worker_threads');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const sharp = require('sharp');

// --------------------------------------------------
// Shared Helpers (both main and worker will need these)
// --------------------------------------------------

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

function compareData(data1, data2, toIgnore = {keys: ["imageType"]}) {
  const data1Filtered = Object.fromEntries(
    Object.entries(data1).filter(([key]) => !toIgnore.entries?.includes(key))
  );
  const data2Filtered = Object.fromEntries(
    Object.entries(data2).filter(([key]) => !toIgnore.entries?.includes(key))
  );

  if (!data1Filtered || !data2Filtered) {
    return false;
  }
  if (Object.keys(data1Filtered).length !== Object.keys(data2Filtered).length) {
    return false;
  }

  for (let key in data1Filtered) {
    if (toIgnore.keys?.includes(key)) continue;
    if (data1Filtered[key] !== data2Filtered[key]) {
      return false;
    }
  }
  for (let key in data2Filtered) {
    if (toIgnore.keys?.includes(key)) continue;
    if (data1Filtered[key] !== data2Filtered[key]) {
      return false;
    }
  }

  return true;
}

function objectify(e, layer, folder) {
  const squareBracketMatch = e.name.match(/\[(.*?)\]/);
  const tempModifications = squareBracketMatch ? squareBracketMatch[1].split("_"): [];
  const properties = tempModifications.length > 0
    ? e.name.split("-")[1].split(".")[0].split("_")
    : e.name.split(".")[0].split("_");

  let modifications = {
    flip : tempModifications.includes("flipped"),
    rotation : tempModifications.includes("rotated") ? 180 : 0
  };

  const bedroomData = properties.length > 7
    ? {
        bedroomCount: properties[5].replace("f", ""),
        flipped: properties[5].includes("f") ? true : false,
      }
    : {
        bedroomCount: properties[3].replace("f", ""),
        flipped: properties[3].includes("f") ? true : false,
      };

  const object = properties.length > 7
    ? {
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
    : {
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
      };

  return object;
}

// --------------------------------------------------
// Worker-Specific Function (compositing images) 
// --------------------------------------------------
async function compositeImages(task) {
  try {
    const {
      baseImageObj,      // { pathTo, name, config: { rotation, flip } }
      topImages,         // Array of { pathTo, name, config: {...} }
      outputDir,
      finalRotationOffset
    } = task;

    const baseImagePath = path.join(baseImageObj.pathTo, baseImageObj.name);
    const loadedBaseImage = await sharp(baseImagePath)
      .resize(4320, 4320)
      .rotate(baseImageObj.config.rotation || 0)
      .flop(baseImageObj.config.flip || false)
      .toBuffer();

    const loadedTopImages = await Promise.all(
      topImages.map(async (topImage) => {
        const topImagePath = path.join(topImage.pathTo, topImage.name);
        return sharp(topImagePath)
          .resize(4320, 4320)
          .rotate(topImage.config.rotation || 0)
          .flop(topImage.config.flip || false)
          .toBuffer();
      })
    );

    const compositeOptions = [{ input: loadedBaseImage, top: 0, left: 0 }];
    loadedTopImages.forEach((buf) => {
      compositeOptions.push({ input: buf, top: 0, left: 0 });
    });

    await fs.mkdir(outputDir, { recursive: true });

    // Combine parent's rotation offset if needed
    function normalizeRotation(rotation) {
      return ((rotation % 360) + 360) % 360;
    }
    const finalRotation = normalizeRotation(
      (baseImageObj.config.rotation || 0) + (finalRotationOffset || 0)
    );
    baseImageObj.config.rotation = finalRotation;

    const folderNames = path.join(outputDir, Object.values(baseImageObj.config).join("_"));
    await fs.mkdir(folderNames, { recursive: true });

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

    return {
      success: true,
      message: `Composited ${baseImageObj.name} with config: ${Object.values(baseImageObj.config).join("_")}`
    };
  } catch (error) {
    return {
      success: false,
      message: `Error compositing ${task?.baseImageObj?.name}: ${error.message}`
    };
  }
}

// --------------------------------------------------
// isMainThread ? => Main Thread : Worker Thread
// --------------------------------------------------

if (isMainThread) {
  // =======================
  // MAIN THREAD LOGIC
  // =======================
  (async () => {
    try {
      const floorplans = './Floorplans/original';
      const balcony = './Balconies';
      const DIMS = './DIMS/normal';
      const flippedDIMS = './DIMS/flipped';
      const outputDir = './Floorplans/output';
      
      // If you have a JSON file reference, do it here:
      // const jsonFilePath = "./reference.json"
      // const jsonText = fsSync.readFileSync(jsonFilePath)
      // const jsonData = JSON.parse(jsonText);
      // const typeData = jsonData.types
      // const unitData = jsonData.units

      const expectedOutput = {
        rotation: [0, 90, 180, 270],
        flip: [false, true]
      };

      const allPermutations = generatePermutations(expectedOutput);

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

      const thisBaseImages = backplateImages.filter(
        (e) => e.imageData.layer === Layer.BaseImage
      );
      const thisDIM = backplateImages.filter(
        (e) => e.imageData.layer === Layer.DIMS
      );
      const thisBalcony = backplateImages.filter(
        (e) => e.imageData.layer === Layer.Balcony
      );

      const imageGroup = thisBaseImages.map((baseImage) => ({
        baseImage,
        topImages: [
          ...thisBalcony.filter((balcony) =>
            compareData(baseImage.typeData, balcony.typeData)
          ),
          ...thisDIM.filter((dim) =>
            compareData(baseImage.typeData, dim.typeData)
          )
        ]
      }));

      // Build tasks: each task is a combination of baseImage + config + matching topImages
      const tasks = [];
      for (const group of imageGroup) {
        const baseImgData = group.baseImage.imageData;
        for (const config of allPermutations) {
          let thisTopImages = [];
          let imageRef = group.topImages;

          // Matches your layering logic
          const batch0 = imageRef
            .filter((e) => e.imageData.layer === Layer.Balcony)
            .map((e) => ({ ...e.imageData, config }));
          thisTopImages.push(...batch0);
          imageRef = imageRef.filter(
            (e) => !batch0.some((batchItem) => compareData(batchItem, e.imageData))
          );

          const batch1 = imageRef
            .filter((e) => compareData(config, e.imageData.modifications))
            .map((e) => ({
              ...e.imageData,
              config: { flip: false, rotation: 0 }
            }));
          thisTopImages.push(...batch1);
          imageRef = imageRef.filter(
            (e) => !batch1.some((batchItem) => compareData(batchItem, e.imageData))
          );

          if (config.rotation === 90) {
            const batch2 = imageRef
              .filter(
                (e) =>
                  e.imageData.modifications.rotation === 0 &&
                  e.imageData.modifications.flip === config.flip
              )
              .map((e) => ({
                ...e.imageData,
                config: { flip: false, rotation: 90 }
              }));
            thisTopImages.push(...batch2);
            imageRef = imageRef.filter(
              (e) => !batch2.some((batchItem) => compareData(batchItem, e.imageData))
            );
          }

          if (config.rotation === 270) {
            const batch3 = imageRef
              .filter(
                (e) =>
                  e.imageData.modifications.rotation === 180 &&
                  e.imageData.modifications.flip === config.flip
              )
              .map((e) => ({
                ...e.imageData,
                config: { flip: false, rotation: 90 }
              }));
            thisTopImages.push(...batch3);
            imageRef = imageRef.filter(
              (e) => !batch3.some((batchItem) => compareData(batchItem, e.imageData))
            );
          }

          if (thisTopImages.length > 0) {
            tasks.push({
              baseImageObj: {
                pathTo: baseImgData.pathTo,
                name: baseImgData.name,
                config
              },
              topImages: thisTopImages,
              outputDir,
              finalRotationOffset: 0 // If you want to add an extra offset
            });
          }
        }
      }

      console.log(`Total tasks to process: ${tasks.length}`);

      // Spawn multiple workers (use up to # of CPU cores, or limit)
      const numCPUs = os.cpus().length;
      const numWorkers = Math.min(numCPUs, 4); 
      const workers = [];
      for (let i = 0; i < numWorkers; i++) {
        // We'll spawn the same file but in "worker mode"
        workers.push(new Worker(__filename));
      }

      // Helper to chunk tasks
      function chunkArray(array, size) {
        const results = [];
        for (let i = 0; i < array.length; i += size) {
          results.push(array.slice(i, i + size));
        }
        return results;
      }

      const chunks = chunkArray(tasks, Math.ceil(tasks.length / numWorkers));

      // We'll wait on an array of promises for all workers
      const workerPromises = workers.map((worker, index) => {
        const chunk = chunks[index] || [];
        return new Promise((resolve) => {
          worker.on('message', (results) => {
            // results is an array of result objects
            results.forEach((r) => {
              if (!r.success) {
                console.error(r.message);
              } else {
                console.log(r.message);
              }
            });
            resolve();
          });
          worker.on('error', (err) => {
            console.error(`Worker error: ${err}`);
            resolve();
          });
          worker.on('exit', (code) => {
            if (code !== 0) {
              console.error(`Worker stopped with exit code ${code}`);
            }
          });
          // Send chunk to worker
          worker.postMessage(chunk);
        });
      });

      // Wait for all
      await Promise.all(workerPromises);

      console.log('All tasks processed successfully via multithreading!');
    } catch (error) {
      console.error('Error in main thread:', error);
    }
  })();
} else {
  // =======================
  // WORKER THREAD LOGIC
  // =======================
  parentPort.on('message', async (taskList) => {
    // taskList is an array of tasks for this worker
    const results = [];
    for (const task of taskList) {
      const result = await compositeImages(task);
      results.push(result);
    }
    // Send back once we've processed all tasks
    parentPort.postMessage(results);
  });
}
