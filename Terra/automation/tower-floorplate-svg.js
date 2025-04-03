const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const svgpath = require("svgpath");

const input = "../SVGs/input";
const output = "../SVGs/output";
const configPath = "./tower-floorplate.json";

// Read file list and configuration
const files = fs.readdirSync(input);
const configFile = fs.readFileSync(configPath, "utf8");
const config = JSON.parse(configFile);

// Filter for SVG files only.
const svgFiles = files.filter(file => path.extname(file).toLowerCase() === ".svg");
console.log("All SVG Files:");
console.log(svgFiles);

/**
 * Applies SVG path transformations and updates internal id attributes.
 * 
 * For every <path> element, it applies:
 *   - If flipY is true: mirror horizontally using scale(-1,1) then translate(SIZE,0)
 *   - If flipX is true: mirror vertically using scale(1,-1) then translate(0,SIZE)
 *   - If rotate is nonzero: rotate around the center (CENTER, CENTER)
 * 
 * Then, for every element with an id starting with idPrefix,
 * it splits the id by "_" and:
 *   - If there are 3 parts, replaces it entirely with newFileBase.
 *   - If there are 4 parts, replaces the first three parts with newFileBase and retains the fourth.
 *
 * @param {string} svgContent - The original SVG XML.
 * @param {Object} transformations - { flipX, flipY, rotate }.
 * @param {string} newFileBase - The new base string (e.g. "Terra_b1_05").
 * @param {string} idPrefix - The prefix to match in internal IDs (e.g. "Terra_b1").
 * @returns {string} - The updated SVG XML.
 */
function transformAndRenameSvg(svgContent, transformations, newFileBase, idPrefix) {
  const SIZE = 4320;
  const CENTER = SIZE / 2;

  const $ = cheerio.load(svgContent, { xmlMode: true });
  
  $("path").each((i, elem) => {
    let d = $(elem).attr("d");
    if (d) {
      let sp = svgpath(d);
      if (transformations.flipY) {
        sp = sp.scale(-1, 1).translate(SIZE, 0);
      }
      if (transformations.flipX) {
        sp = sp.scale(1, -1).translate(0, SIZE);
      }
      if (transformations.rotate) {
        sp = sp.rotate(transformations.rotate, CENTER, CENTER);
      }
      $(elem).attr("d", sp.toString());
    }
  });
  
  $("[id]").each((i, elem) => {
    let id = $(elem).attr("id");
    if (id && id.startsWith(idPrefix)) {
      const parts = id.split("_");
      let newId;
      if (parts.length === 3) {
        newId = newFileBase;
      } else if (parts.length === 4) {
        newId = `${newFileBase}_${parts[3]}`;
      } else {
        newId = id;
      }
      $(elem).attr("id", newId);
    }
  });
  
  return $.xml();
}

// Ensure the output directory exists.
if (!fs.existsSync(output)) {
  fs.mkdirSync(output, { recursive: true });
}

/*
 * For each tower configuration in the JSON, we expect input files to follow:
 *   "<project>_<tower.type>_<number>.svg"
 * For example, with project "Terra" and tower.type "b1", an input might be "Terra_b1_03.svg".
 */
config.towers.forEach(tower => {
  const fileRegex = new RegExp(`^(${config.project}_${tower.type}_)(\\d+)(\\.svg)$`, 'i');
  
  const towerSvgFiles = svgFiles.filter(file => file.match(fileRegex));
  console.log(`Processing tower: ${tower.name} (type: ${tower.type})`);
  console.log("Matching input files:", towerSvgFiles);
  
  let originals = new Set();
  tower.duplicate.forEach(dupGroup => {
    originals.add(dupGroup.original);
  });
  
  // --- Duplicate Processing ---
  tower.duplicate.forEach(dupGroup => {
    const originalSuffix = dupGroup.original; 
    const duplicateSuffixes = dupGroup.duplicate; 
    
    towerSvgFiles.forEach(svgFile => {
      const match = svgFile.match(fileRegex);
      if (match && match[2] === originalSuffix) {
        const filePrefix = match[1]; 
        const ext = match[3];        
        
        // Always process the original file (transform it)
        {
          const newFileBase = `${filePrefix}${originalSuffix}`;
          const newFileName = `${newFileBase}${ext}`;
          const outputPath = path.join(output, newFileName);
          const originalSvgContent = fs.readFileSync(path.join(input, svgFile), "utf8");
          const transformations = {
            flipX: tower.flipX,
            flipY: tower.flipY,
            rotate: tower.rotate
          };
          const idPrefix = `${config.project}_${tower.type}`;
          const updatedSvg = transformAndRenameSvg(originalSvgContent, transformations, newFileBase, idPrefix);
          fs.writeFileSync(outputPath, updatedSvg, "utf8");
          console.log(`Processed original SVG saved to ${outputPath}`);
        }
        
        // Process duplicates (always transform from the same original source)
        duplicateSuffixes.forEach(newSuffix => {
          const newFileBase = `${filePrefix}${newSuffix}`;
          const newFileName = `${newFileBase}${ext}`;
          const outputPath = path.join(output, newFileName);
          
          const originalSvgContent = fs.readFileSync(path.join(input, svgFile), "utf8");
          const transformations = {
            flipX: tower.flipX,
            flipY: tower.flipY,
            rotate: tower.rotate
          };
          const idPrefix = `${config.project}_${tower.type}`;
          const updatedSvg = transformAndRenameSvg(originalSvgContent, transformations, newFileBase, idPrefix);
          fs.writeFileSync(outputPath, updatedSvg, "utf8");
          console.log(`Processed duplicate SVG saved to ${outputPath}`);
        });
      }
    });
  });
  
  // --- Default Processing ---
  towerSvgFiles.forEach(svgFile => {
    const match = svgFile.match(fileRegex);
    if (match && !originals.has(match[2])) {
      const filePrefix = match[1];
      const origSuffix = match[2];
      const ext = match[3];
      const newFileBase = `${filePrefix}${origSuffix}`;
      const outputPath = path.join(output, svgFile);
      
      const originalSvgContent = fs.readFileSync(path.join(input, svgFile), "utf8");
      const transformations = {
        flipX: tower.flipX,
        flipY: tower.flipY,
        rotate: tower.rotate
      };
      const idPrefix = `${config.project}_${tower.type}`;
      const updatedSvg = transformAndRenameSvg(originalSvgContent, transformations, newFileBase, idPrefix);
      
      fs.writeFileSync(outputPath, updatedSvg, "utf8");
      console.log(`Processed default SVG saved to ${outputPath}`);
    }
  });
});
