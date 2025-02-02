const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const { parse } = require('csv-parse/sync');

const typesFileDir = "./Room Label/All Types"
const typeCorrectedFileDir = "./Room Label/typeCorrected"
const unitFileDir = "./Room Label/Unit Label"
const inputFileDir = "./Room Label/Original"

const floorplans = './Floorplans/original';
const balcony = './Balconies';
const DIMS = './DIMS/normal';
const flippedDIMS = './DIMS/flipped';
const jsonFilePath = "./reference.json"
const unitJsonFilePath = "./unit-reference.json"

const jsonText = fs.readFileSync(jsonFilePath)
const jsonData = JSON.parse(jsonText);
const typeData = jsonData.types


const unitJsonText = fs.readFileSync(unitJsonFilePath)
const unitJsonData = JSON.parse(unitJsonText);
const unitData = unitJsonData.units


let allLabelFiles = fs.readdirSync(inputFileDir)

const unfinishedUnits = []
const unfinishedTypes = []
let promises = []

const editName = (e, outputName) => {
  let editedName;
  if(!outputName){
    editedName = e.replace("csv_floorplan", "backplate_image_floorplan").replace(".csv", "_0.csv")
  } else {
    editedName = e.replace("backplate_image_floorplan", "csv_floorplan").replace("_0.csv", ".csv")
  }
  return editedName
}

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
  //{
  //  rotation: 90,
  //  flip: true
  //}
}

function editCSV(file, config){
  // console.log(file)
  // console.log(editNames(file))
  const folderNames = path.join(typesFileDir, Object.values(config).join("_"));
  fs.mkdirSync(folderNames, { recursive: true });

  const filteredConfig = typeData.filter(e => editName(file, false).includes(e.name))
  // console.log("Filtered")
  // console.log(filteredConfig[0].parent.rotation)
  // console.log(config.rotation)

  const finalRotation = filteredConfig[0].parent.rotation + config.rotation

  console.log(config)

  let csvData = fs.readFileSync(path.join(inputFileDir, file), 'utf-8');
  // RotateCSV based on type + unit rotation
  csvData = rotateCSV(csvData, normalizeRotation(finalRotation))
  if(config.flip){
    csvData = flipCSV(csvData, "y")
    if(config.rotation == 90 || config.rotation == 270){
      csvData = rotateCSV(csvData, 180)
    }
  }


  saveCSV(csvData, path.join(folderNames, editName(file, false)))
}

const allPermutations = generatePermutations(expectedOutput)
allLabelFiles.forEach((e) => {
  console.log(e)
  //Create all rotation permutations
  allPermutations.forEach((config) => {
    editCSV(e, config)
  })

})

function normalizeRotation(rotation) {
  return ((rotation % 360) + 360) % 360;
}

//Normalize Type Data
// typeData.forEach((e) => {
//     if(e.offset.rotation < 360){
//         console.log(e.name)

//         let rotation = e.offset.rotation;
//         const flip = e.offset.flip;
//         const flipVariations = [flip, !flip]

//         flipVariations.map((thisFlip, i) => {
//           try{

//             if(i == 1 && (rotation == 90 || rotation == 270)){
//               rotation += 180
//               rotation = normalizeRotation(rotation)
//             }

//             // if(rotation == 0 || rotation == 180){
//             //   rotation += 180
//             //   rotation = normalizeRotation(rotation)
//             // }

//             const folderName = [rotation, thisFlip].join("_")

//             console.log(folderName)
//             const targetFolder = path.join(typesFileDir, folderName)
//             const files = fs.readdirSync(targetFolder)
//             const subFolder = i == 1 ? "Normal" : "Flipped"

//             const outputWSubfolder = path.join(typeCorrectedFileDir, subFolder)
    
//             const selectedFile = files.filter(fileName => fileName.includes(e.parent.name))[0]

//             const renamed = selectedFile.replace(e.parent.name, e.name)

//             if(!fs.existsSync(outputWSubfolder)){
//               fs.mkdirSync(outputWSubfolder)
//             }

//             fs.copyFileSync(path.join(targetFolder, selectedFile), path.join(outputWSubfolder, renamed))


//           } catch (error){
//             console.log(error)
//           }
//         })
//     }

// })

unitData.forEach((unit) => {
  const flipData = unit.name.toLowerCase().includes("b2") ? !unit.flip : unit.flip
  const typeParentRotation = typeData.filter(e => e.name == unit.type)[0].parent.rotation
  const typeOffsetRotation = typeData.filter(e => e.name == unit.type)[0].offset.rotation
  const rotate = unit.rotation - typeParentRotation - typeOffsetRotation
  
  const subfolder = `${rotate}_${flipData}`
  const selectedFolder = path.join(typesFileDir, subfolder)
  // const selectedFolder = path.join(typeCorrectedFileDir, subfolder)
  console.log(`${unit.name} | Rotate: ${rotate} | Flip: ${flipData}` )
  const selectedTypeImage = fs.readdirSync(selectedFolder).filter(e => e.includes(unit.type))[0]


  if(selectedTypeImage){
    console.log(`${unit.name} is processed`)
    console.log(selectedFolder)
    console.log(selectedTypeImage)
    const name = unit.name.toLowerCase()
    const tower = name.split("-")[0]
    const level = name.split("-")[1].length > 3 ? name.split("-")[1].substr(0, 2) : `0${name.split("-")[1].substr(0, 1)}`
    const unitNumber = name.split("-")[1].slice(-2)
    const selectedTypeImagePath = path.join(selectedFolder, selectedTypeImage)
    // const finalName = selectedTypeImage.replace(unit.type, [[tower, level, unitNumber].join("-"), unit.type].join("_"))
    const finalName = selectedTypeImage.replace(unit.type, [[tower, level, unitNumber].join("-"), unit.type.split("_")[4]].join("_"))
    try {
      // fs.writeFileSync(selectedImageBuffer, path.join(outputFilePath, finalName))
      const newPromise = exportUnitLabel(selectedTypeImagePath, path.join(unitFileDir, editName(finalName.split(".")[0], true)))
      promises.push(newPromise)
    } catch (e) {
      console.error(e)
      if(!unfinishedUnits.includes(unit.name)){
        unfinishedUnits.push(unit.name)
      }
      if(!unfinishedTypes.includes(unit.type)){
        unfinishedTypes.push(unit.type)
      }
    }

  } else {
    // console.log(`${unit.name} is not processed`)
    console.log(unit.name)
    if(!unfinishedUnits.includes(unit.name)){
      unfinishedUnits.push(unit.name)
    }
    if(!unfinishedTypes.includes(unit.type)){
      unfinishedTypes.push(unit.type)
    }
    
  }
})

async function exportUnitLabel(inputPath, outputPath){
  return new Promise((resolve, reject) => {
    try {
      const buffer = fs.readFileSync(inputPath)
      fs.writeFileSync(`${outputPath}.csv`, buffer)
      resolve()
    } catch (error) {
      console.log(error)
      reject(error)
    }

  })

}

Promise.all(promises)
.then((resolve, reject) => {
  if(reject){
    console.error(reject)
  }
  if(unfinishedUnits.length > 0){
    // console.error("Some images failed to process:", error)
    console.log(unfinishedUnits)
    console.log(unfinishedUnits.length + " not processed")
    console.log(unfinishedTypes)
    console.log(unfinishedTypes.length + " not processed")
    console.log("Total Units " + unitData.length)
  } else {
    console.log("All CSVs have been processed successfully.")
  }
})
.catch((error) => {
  console.error("Some images failed to process:", error)
  console.log(unfinishedUnits)
  console.log(unfinishedUnits.length + " not processed")
  console.log(unfinishedTypes)
  console.log(unfinishedTypes.length + " not processed")
  console.log("Total Units " + unitData.length)
});


if(unfinishedUnits.length > 0){
  console.log(unfinishedUnits)
} else {
  console.log("All units done with no hiccups :)")
}

function rotateCSV(csv, rotationAngle) {
  const canvasSize = 4096;
  const radians = (Math.PI / 180) * rotationAngle; // Convert degrees to radians
  const center = canvasSize / 2; // Center of rotation

  // Read and parse CSV synchronously
  const csvData = csv;
  const parsedData = parse(csvData, { columns: false, trim: true });

  const transformRow = (row) => {
      const y = parseFloat(row[1]) - center; // Translate to center
      const x = parseFloat(row[2]) - center;

      // Apply rotation formula
      const xRotated = x * Math.cos(radians) - y * Math.sin(radians);
      const yRotated = x * Math.sin(radians) + y * Math.cos(radians);

      // Translate back from center
      let finalX = xRotated + center;
      let finalY = yRotated + center;

      if(rotationAngle == 180){
        //Standard label size on the web client * scale to be set (Coordinate with engineers)
        finalY -= 60
      }

      if(rotationAngle == 270){
        //Standard label size on the web client * scale to be set (Coordinate with engineers)
        finalX += 40
        finalY -= 30
      }

      if(rotationAngle == 90){
        //Standard label size on the web client * scale to be set (Coordinate with engineers)
        finalX -= 40
        finalY -= 30
      }

      // Return as an array to format into CSV later
      return [row[0], finalY, finalX, ...row.slice(3)];
  };

  // Apply the transformation and join rows into CSV format
  const transformedData = parsedData.map(transformRow);
  const csvOutput = transformedData.map(row => row.join(',')).join('\n');

  return csvOutput; // Return rotated data as a CSV string
}

function flipCSV(csv, axis) {
  const canvasSize = 4096;

  // Read and parse CSV synchronously
  const csvData = csv;
  const parsedData = parse(csvData, { columns: false, trim: true });

  const transformRow = (row) => {
      const y = parseFloat(row[1]);
      const x = parseFloat(row[2]);

      let flippedX = x;
      let flippedY = y;

      if (axis === 'x') {
          flippedY = canvasSize - y; // Flip on X-axis
      } else if (axis === 'y') {
          flippedX = canvasSize - x; // Flip on Y-axis
      } else {
          console.log(csv)
          throw new Error('Invalid axis selection. Use "x" or "y".');
      }

      return [row[0], flippedY, flippedX, ...row.slice(3)];
  };

  // Apply transformation and join rows into CSV format
  const transformedData = parsedData.map(transformRow);
  const csvOutput = transformedData.map(row => row.join(',')).join('\n');

  return csvOutput; // Return transformed data as a CSV string
}

function saveCSV(csvOutput, outputFilePath) {
  try {
      fs.writeFileSync(outputFilePath, csvOutput, 'utf-8'); // Save the CSV output to the file
      console.log(`CSV file successfully saved to ${outputFilePath}`);
  } catch (error) {
      console.error('Error saving CSV file:', error);
  }
}


