const sharp = require('sharp');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// Directory paths
const floorplans = './Floorplans/original';
const balcony = './Balconies';
const DIMS = './DIMS/normal';
const flippedDIMS = './DIMS/flipped';
const typeReferencePath = './reference.json';
const unitReferencePath = './unit-reference.json';
const toIgnore = ['.DS_Store', 'ss'];

// Load type reference (required)
const typeReferenceRaw = fsSync.readFileSync(typeReferencePath, 'utf-8');
const typeReferenceData = JSON.parse(typeReferenceRaw);
const typeData = typeReferenceData.types;

// Load unit reference (optional)
let unitData = [];
try {
  const unitReferenceRaw = fsSync.readFileSync(unitReferencePath, 'utf-8');
  unitData = JSON.parse(unitReferenceRaw).units;
} catch (err) {
  console.warn('unit-reference.json not found or invalid; generating all permutations by default.');
  unitData = [];
}

// Expected output config
const DEFAULT_OUTPUT = {
  rotation: [0, 90, 180, 270],
  flip: [false, true]
};

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

function objectify(e, layer, folder) {
  // Strip extension and split into parts
  const base = e.name.split('.')[0];
  const props = base.includes('-')
    ? base.split('-')[1].split('_')
    : base.split('_');

  // If we don’t have at least 4 segments, bail out
  if (props.length < 4) {
    console.error('Unexpected filename format:', e.name, '→ parts:', props);
    return null;  // or throw, or handle as you prefer
  }

  // Determine bedroom raw value from the right index
  const bedroomRaw = props.length > 7
    ? props[5]
    : props[3];

  // Now it’s safe to replace and test for ‘f’
  const bedroomCount = bedroomRaw.replace('f', '');
  const flippedFlag   = bedroomRaw.includes('f');

  // Detect any “[…]” modifiers (e.g. flipped/rotated)
  const sqMatch = e.name.match(/\[(.*?)\]/);
  const mods = sqMatch ? sqMatch[1].split('_') : [];
  const modifications = {
    flip:    mods.includes('flipped'),
    rotation: mods.includes('rotated') ? 180 : 0,
  };

  // Build the typeData object
  let typeObj;
  if (props.length > 7) {
    typeObj = {
      imageType:        `${props[0]}_${props[1]}_${props[2]}`,
      propertyType:     props[3],
      standardOrPremium: props[4],
      bedroomCount,
      flipped:          flippedFlag,
      variant:          props[6],
      schema:           props[7],
      floor:            props[8],
    };
  } else {
    typeObj = {
      imageType:        props[0],
      propertyType:     props[1],
      standardOrPremium: props[2],
      bedroomCount,
      flipped:          flippedFlag,
      variant:          props[4],
      schema:           props[5],
      floor:            props[6],
    };
  }

  return {
    typeData:  typeObj,
    imageData: { pathTo: folder, name: e.name, layer, modifications }
  };
}


function compareData(data1, data2, toIgnore = { keys: ['imageType'] }) {
  const d1 = Object.fromEntries(Object.entries(data1).filter(([k]) => !toIgnore.keys.includes(k)));
  const d2 = Object.fromEntries(Object.entries(data2).filter(([k]) => !toIgnore.keys.includes(k)));
  if (!d1 || !d2) return false;
  if (Object.keys(d1).length !== Object.keys(d2).length) return false;
  for (const key in d1) {
    if (d1[key] !== d2[key]) return false;
  }
  return true;
}

async function compositeImages(baseImageObj, topImagesObj) {
  try {
    const basePath = path.join(baseImageObj.pathTo, baseImageObj.name);
    const baseBuf = await sharp(basePath)
      .resize(4320, 4320)
      .rotate(baseImageObj.config.rotation || 0)
      .flop(baseImageObj.config.flip || false)
      .toBuffer();

    const topBufs = await Promise.all(
      topImagesObj.map(t => sharp(path.join(t.pathTo, t.name))
        .resize(4320, 4320)
        .rotate(t.config.rotation || 0)
        .flop(t.config.flip || false)
        .toBuffer()
      )
    );

    const compositeOpts = [{ input: baseBuf, top: 0, left: 0 }];
    topBufs.forEach(buf => compositeOpts.push({ input: buf, top: 0, left: 0 }));

    const outputDir = './Floorplans/output';
    await fs.mkdir(outputDir, { recursive: true });

    const nameParts = baseImageObj.finalName
      ? Object.values(baseImageObj.finalName)
      : Object.values(baseImageObj.config);
    const outFolder = path.join(outputDir, nameParts.join('_'));
    await fs.mkdir(outFolder, { recursive: true });

    await sharp({ create: { width: 4320, height: 4320, channels: 4, background: { r:0,g:0,b:0,alpha:0 } } })
      .composite(compositeOpts)
      .png()
      .toFile(path.join(outFolder, baseImageObj.name));

    console.log(`Saved ${baseImageObj.name} in ${outFolder}`);
  } catch (err) {
    console.error(`Error compositing ${baseImageObj.name}:`, err);
  }
}

async function layerImages() {
  try {
    const floorFiles = await fs.readdir(floorplans, { withFileTypes: true });
    const balconyFiles = await fs.readdir(balcony, { withFileTypes: true });
    const dimFiles = await fs.readdir(DIMS, { withFileTypes: true });
    const dimFlipFiles = await fs.readdir(flippedDIMS, { withFileTypes: true });

    const Layer = { BaseImage: 'baseImage', Balcony: 'balcony', DIMS: 'dims' };
    const backplateImages = [];

    function validName(e) { return !toIgnore.some(ignore => e.name.includes(ignore)); }

    floorFiles.filter(validName).forEach(e => backplateImages.push(objectify(e, Layer.BaseImage, floorplans)));
    balconyFiles.filter(validName).forEach(e => backplateImages.push(objectify(e, Layer.Balcony, balcony)));
    dimFiles.filter(validName).forEach(e => backplateImages.push(objectify(e, Layer.DIMS, DIMS)));
    dimFlipFiles.filter(validName).forEach(e => backplateImages.push(objectify(e, Layer.DIMS, flippedDIMS)));

    const bases = backplateImages.filter(i => i.imageData.layer === Layer.BaseImage);
    const dims = backplateImages.filter(i => i.imageData.layer === Layer.DIMS);
    const bals = backplateImages.filter(i => i.imageData.layer === Layer.Balcony);

    for (const baseObj of bases) {
      const baseType = baseObj.typeData;
      const key = `${baseType.propertyType}_${baseType.standardOrPremium}_${baseType.bedroomCount}${baseType.flipped?'f':''}_${baseType.variant}_${baseType.schema}_${baseType.floor}`;
      const selType = typeData.find(e => key.includes(e.name));
      const parentRot = selType?.parent?.rotation || 0;

      // Determine rotation options
      let rotOpts;
      if (parentRot > 0) {
        rotOpts = DEFAULT_OUTPUT.rotation;
      } else if (unitData.length > 0) {
        const matches = unitData.filter(u => u.type === key);
        rotOpts = matches.length > 0 ? [...new Set(matches.map(u => u.rotation))] : DEFAULT_OUTPUT.rotation;
      } else {
        rotOpts = DEFAULT_OUTPUT.rotation;
      }

      const perms = generatePermutations({ rotation: rotOpts, flip: DEFAULT_OUTPUT.flip });

      // Gather top images for this base (type match)
      const relevantTops = [
        ...bals.filter(b => compareData(baseType, b.typeData)),
        ...dims.filter(d => compareData(baseType, d.typeData))
      ];

      console.log(relevantTops)

      for (const cfg of perms) {
        const tops = relevantTops.map(img => ({ ...img.imageData, config: cfg }));
        if (tops.length === 0) continue;

        baseObj.imageData.config = { ...cfg };
        if (parentRot > 0) {
          const fn = { ...cfg };
          const flipOffset = fn.flip && ([90,270].includes(parentRot)) ? 180 : 0;
          fn.rotation = normalizeRotation(cfg.rotation + parentRot + flipOffset);
          baseObj.finalName = fn;
        }

        await compositeImages(baseObj.imageData, tops);
      }
    }

    console.log('All images processed successfully.');
  } catch (error) {
    console.error('Error processing images:', error);
  }
}

layerImages();
