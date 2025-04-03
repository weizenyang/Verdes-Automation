const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const sharp = require('sharp');

const outputFilePath = "./Unit Floorplans"
const outputCSVFilePath = "./Floorplan CSV/output"
const inputFileDir = "./Floorplans/output"
const jsonFilePath = './unit-reference.json';
const csvFolderPath = './Arthouse/floorplan/Unit matched types/NEW/S2 240806 Flipped/csv5';

const jsonText = fs.readFileSync(jsonFilePath)
const jsonData = JSON.parse(jsonText);
const typeData = jsonData.types
const unitData = jsonData.units

const unfinishedUnits = []
const unfinishedTypes = []
let promises = []

unitData.forEach((unit) => {
  const flipData = unit.flip
  
  const rotation = unit.rotation
  const subfolder = `${rotation}_${flipData}`
  console.log(subfolder)
  // const subfolder = flipData ? "Flipped" : "Normal"
  const selectedFolder = path.join(inputFileDir, subfolder)
  console.log(unit.type)
  const selectedTypeImage = fs.readdirSync(selectedFolder).filter(e => e.includes(unit.type))[0]
  // .filter(e => e.includes(unit.type))[0]
  // console.log(path.join(selectedFolder, selectedTypeImage))
  if(selectedTypeImage){
    console.log(selectedFolder)
    console.log(selectedTypeImage)
    const name = unit.name.toLowerCase()
    const tower = name.split("-")[0]
    const level = name.split("-")[1].length > 3 ? name.split("-")[1].substr(0, 2) : `0${name.split("-")[1].substr(0, 1)}`
    const unitNumber = name.split("-")[1].slice(-2)
    const selectedTypeImagePath = path.join(selectedFolder, selectedTypeImage)
    // const selectedImageBuffer = fs.readFileSync(selectedTypeImagePath)
    console.log(unit.type.split("_")[5])
    const finalName = selectedTypeImage.replace(unit.type, [[tower, level, unitNumber].join("-"), unit.type.split("_")[4], unit.type.split("_")[5]].join("_"))
    // const finalName = selectedTypeImage.replace(unit.type, [[tower, level, unitNumber].join("-"), unit.type].join("_"))
    try {
      // fs.writeFileSync(selectedImageBuffer, path.join(outputFilePath, finalName))
      const newPromise = exportCompressedImage(selectedTypeImagePath, path.join(outputFilePath, finalName.split(".")[0]))
      // generateEmptyCSV(path.join(outputCSVFilePath, finalName.split(".")[0]));
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
    console.log(`${unit.name} is not processed`)
    console.log(unit.name)
    if(!unfinishedUnits.includes(unit.name)){
      unfinishedUnits.push(unit.name)
    }
    if(!unfinishedTypes.includes(unit.type)){
      unfinishedTypes.push(unit.type)
    }
    
  }
})

Promise.all(promises).then((e) => {
  if(unfinishedUnits.length > 0){
    console.error("Some images failed to process:", error)
    console.log(unfinishedUnits)
    console.log(unfinishedUnits.length + " not processed")
    console.log(unfinishedTypes)
    console.log(unfinishedTypes.length + " not processed")
    console.log(unitData.length - unfinishedTypes.length)
    console.log("Total Units " + unitData.length)
  } else {
    console.log("All images have been processed successfully.")
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


async function exportCompressedImage(inputPath, outputPath){
    return new Promise((resolve, reject) => {
      sharp(inputPath).webp(100).toFile(`${outputPath}.webp`)
      .then(info => {
        console.log(`Processed image saved: ${inputPath} -> ${outputPath}.webp`);
        resolve(info);
      })
      .catch(error => {
          console.error(`Error processing image ${inputPath}: ${error}`);
          reject(error);
      });
    })

}

function rotateCSV(inputFilePath, outputFilePath){
  const canvasSize = 4096;

  const readStream = fs.createReadStream(inputFilePath);
  const writeStream = fs.createWriteStream(outputFilePath);


  const transformRow = (row) => {
      const y = parseFloat(row[1]);
      const x = parseFloat(row[2]);

      const yRotated = canvasSize - y - 50;
      const xRotated = canvasSize - x;

      return [row[0], yRotated, xRotated, ...row.slice(3)];
  };

  readStream
      .pipe(csv.parse({ headers: false }))
      .on('data', (row) => {
          const transformedRow = transformRow(row);
          writeStream.write(transformedRow.join(',') + '\n');
      })
      .on('end', () => {
          console.log('CSV file successfully processed and rotated.');
      })
      .on('error', (error) => {
          console.error('Error processing CSV file:', error);
      });
}

function generateEmptyCSV(filePath) {
 // Create the CSV directory if it doesn't exist
 const dir = path.dirname(filePath);
 if (!fs.existsSync(dir)) {
   fs.mkdirSync(dir, { recursive: true });
 }

 // Write an empty string to the file
 fs.writeFileSync(filePath + ".csv", '', 'utf8');
 console.log(`Empty CSV file created at: ${filePath}`);
}

async function rotateImage(imagePath, schema) {
  var rows = []


      const imageBaseName = path.basename(imagePath)
      const imageDirName = path.dirname(imagePath)
      var outputImagePath = ""

      if (schema.toLowerCase() == 's1') {
        outputImagePath = path.join(scaledS1Rotated, imageBaseName.replace('s2', 's1'))
      } else if (schema.toLowerCase() == 's2') {
        outputImagePath = path.join(scaledS2Rotated, imageBaseName.replace('s1', 's2'))
      }

      // Load the input image
      const image = sharp(imagePath);

        await image
          .toFile(outputImagePath)
          .then(() => {
            console.log(`Rotated image saved to ${outputImagePath}`);
          })
          .catch(err => {
            console.error('Error processing image:', err);
          });
}

