const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const sharp = require('sharp');

const jsonFilePath = './Arthouse/response.json';
const csvFolderPath = './Arthouse/floorplan/Unit matched types/NEW/S2 240806 Flipped/csv5';
const scaledS1 = './Arthouse/floorplan/Unit matched types/NEW/S1 240812 Flipped 180';
const scaledS2 = './Arthouse/floorplan/Unit matched types/NEW/S2 240812 Flipped 180';
const scaledS1Rotated = './Arthouse/floorplan/Unit matched types/NEW/S1 240812 Flipped/240812 Scaled - S1 Rotated';
const scaledS2Rotated = './Arthouse/floorplan/Unit matched types/NEW/S2 240812 Flipped/240812 Scaled - S2 Rotated';
const CSVRotated = 'Arthouse/floorplan/Unit matched types/NEW/S2 240806 Flipped/csv5 Rotated';
const outputPath = './Arthouse/floorplan/Unit matched types/NEW/S2 240806 Flipped/csv5/text-embedded-images'
const balconyReference = './Arthouse/balcony.json';
const CSVUnitsAffected = []
const imagesUnitsAffected = []

const jsonText = fs.readFileSync(jsonFilePath)
const balconyRotationText = fs.readFileSync(balconyReference)
const scaledS1Dir = fs.readdirSync(scaledS1)
const scaledS2Dir = fs.readdirSync(scaledS2)
const csvDir = fs.readdirSync(csvFolderPath)
const jsonData = JSON.parse(jsonText);
const balconyRotationData = JSON.parse(balconyRotationText);

const results = jsonData.results
// console.log(balconyRotationData)
const balconyRotationResults = balconyRotationData.results
const balconyRotationArray = []
Object.keys(balconyRotationResults).forEach((e) => {
  balconyRotationResults[e].forEach((i) => {
    balconyRotationArray.push(i)
  })
})
console.log(balconyRotationArray)

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
console.log(balconyRotationArray)
console.log(balconyRotationArray.length)


results.forEach((e) => {
  const aldarUnitNumber = e.aldar_unit_number
  const unitType = e.unit_category.toLowerCase().replace(/[\s\+\(\)]/g, '');
  const s1ToRotate = balconyRotationArray.includes(aldarUnitNumber.replace("TheArthouse-", ""))
  const s2ToRotate = balconyRotationArray.includes(aldarUnitNumber.replace("TheArthouse-", ""))
  const CSVToRotate = balconyRotationArray.includes(aldarUnitNumber.replace("TheArthouse-", ""))
  const matchedS1 = scaledS1Dir.filter((i) => i.includes(aldarUnitNumber.replace("TheArthouse-", "").toLowerCase()))
  const matchedS2 = scaledS2Dir.filter((i) => i.includes(aldarUnitNumber.replace("TheArthouse-", "").toLowerCase()))
  const matchedCSV = csvDir.filter((i) => i.includes(aldarUnitNumber.replace("TheArthouse-", "").toLowerCase()))
  
  console.log(aldarUnitNumber.replace("TheArthouse-", ""))
  console.log(balconyRotationArray.indexOf("R12-07-01"))
  console.log(balconyRotationArray.indexOf("R12-06-06"))
  console.log(balconyRotationArray.filter((e) => e.includes("R12")))
  console.log(CSVToRotate)
  
  
  matchedS1.forEach((e) => {
    if(s1ToRotate){
      // rotateImage(path.join(scaledS1, e), "s1")
      // if(!imagesUnitsAffected.includes(aldarUnitNumber.replace("TheArthouse-", ""))){
      //   imagesUnitsAffected.push(aldarUnitNumber.replace("TheArthouse-", "").toLowerCase())
      // }
    }
  })

  matchedS2.forEach((e) => {
    if(s2ToRotate){
      // rotateImage(path.join(scaledS2,e), "s2")
      // if(!imagesUnitsAffected.includes(aldarUnitNumber.replace("TheArthouse-", ""))){
      //   imagesUnitsAffected.push(aldarUnitNumber.replace("TheArthouse-", "").toLowerCase())
      // }
    }
  })
  matchedCSV.forEach((i) => {
    if(CSVToRotate){
      rotateCSV(path.join(csvFolderPath, i), path.join(CSVRotated, i))
      if(!CSVUnitsAffected.includes(aldarUnitNumber.replace("TheArthouse-", ""))){
        CSVUnitsAffected.push(aldarUnitNumber.replace("TheArthouse-", "").toLowerCase())
      }
    }
  })


  // console.log(selectedTypes[Object.keys(i).toLowerCase().replace(/[\s\+\(\)]/g, '')])
})

console.log(imagesUnitsAffected)

console.log(CSVUnitsAffected)





// const balconyReferenceNames = fs.readdirSync(balconyReference);
// const unitNames = fs.readdirSync(inputDirectoryPath);
// const balconyDIMS = fs.readdirSync(balconyDimDirectoryPath);
// const resultsArray = [];
// const balconyReferences = JSON.parse(fs.readFileSync(outputFilePath, 'utf8'));
// var notRunning = []
// var missingUnits = []
// var found = []

// async function overlayImages(baseImagePath, overlayImagePath, outputImagePath) {
//   try {
//     // Load the base image
//     const baseImage = sharp(baseImagePath);

//     // Get metadata of the base image
//     const baseMetadata = await baseImage.metadata();

//     // Calculate new dimensions for the overlay image (scaling down by 250px on each side)
//     const newWidth = baseMetadata.width - 500;
//     const newHeight = baseMetadata.height - 500;

//     // Load and resize the overlay image
//     const resizedOverlay = await sharp(overlayImagePath)
//       .resize(newWidth, newHeight)
//       .toBuffer();

//     // Calculate the coordinates to center the resized overlay on the base image
//     const left = (baseMetadata.width - newWidth) / 2;
//     const top = (baseMetadata.height - newHeight) / 2;

//     // Composite the resized overlay image onto the base image
//     const finalImage = await baseImage
//       .composite([{ input: resizedOverlay, top: top, left: left, blend: 'over' }]) // 'blend: over' ensures the overlay is on top
//       .toBuffer();

//     // Save the resulting image
//     await sharp(finalImage).toFile(outputImagePath);

//     console.log(`Image saved to ${outputImagePath}`);
//   } catch (error) {
//     console.error('Error overlaying images:', error);
//   }
// }

// // Process balcony reference names
// balconyReferenceNames.forEach(file => {
//   const folderName = path.join(balconyReference, file);
//   if (fs.statSync(folderName).isDirectory()) {
//     const fileName = fs.readdirSync(path.join(folderName));
//     fileName.forEach((e) => {
//       if (e.includes("[")) {
//         const unitName = e.split('[')[0].replace('.png', '');

//         const balconyReference = e.match(/\[([^\]]+)\]/)[1];
//         resultsArray.push({ unitName, balconyReference });
//       } else {
//         const unitName = e.replace('.png', '');
//         resultsArray.push({ unitName, balconyReference: "b1" });
//       }
//     });
//   } else {
//     console.log(`FILE: ${file}`);
//   }
// });

// // Read the JSON file
// fs.readFile(jsonFilePath, 'utf8', (err, data) => {
//   if (err) {
//     console.error(`Error reading JSON file: ${err}`);
//     return;
//   }

//   const jsonData = JSON.parse(data);
//   const results = jsonData.results;
//   const groups = {};

//   // Iterate over each item read in Dir
//   unitNames.forEach(item => {
//     missingUnits.push(item.split("_")[3])
//     try{
//       const unitNumber = item.split("_")[3]
      
//       const typeName = results.find(i => i.aldar_unit_number.toLowerCase().includes(unitNumber)).unit_category
//       const flipStatus = results.find(i => i.aldar_unit_number.toLowerCase().includes(unitNumber)).mirror
//       //typeName is retrieved from Mulesoft JSON

//       //Checking if mulesoft has the unit's type
//       if (typeName) {
      
//         let unitTypeRaw = typeName.replace(' ', '').replace("(", "").replace(")", "").replace("+", "");
//         let unitType = typeName.replace(' ', '_').replace('br', 'b').replace("(", "").replace(")", "");
//         // console.log(unitTypeRaw) //2BR+MA1
//         // console.log(unitType) //2BR+M_A1

//         var balconyRef = balconyReferences.find((i) => i.unitName.toLowerCase().split("_").join("").includes(unitNumber.toLowerCase().split("-").join("")))
//         // console.log(balconyRef) //b1
//         if (unitType.includes("+")) {
//           const temp = unitTypeRaw.split("+").join("");



//           // console.log(temp)
//           // const newTemp = temp[1].split("_")[1] + temp[1].split("_")[0];
//           // console.log(newTemp)
//           // unitType = [temp[0], newTemp].join("_").join("").toLowerCase();
//           unitType = temp;
          
//           // console.log("Changed" + unitType) //2BR_A1M
//         }



        
        
//         if (flipStatus.toLowerCase().includes("mirror")) {
//           // console.log("Mirrored")
//           unitType = "flipped" + unitType.split("_").join("").toLowerCase()
//           console.log(unitNumber)

          
//         } else {
//           unitType = unitType.split("_").join("").toLowerCase()
//           // console.log("Normal")
//           if(unitNumber.includes("12-03-15")){
//             console.log(unitNumber + " Wasnt flipped")
//           }
//         }

//         //Edge Case
//         if(unitType.includes("3brmab1")){
//           unitType.replace("3brmab1", "3brmab2")
//         }

//         const groupName = `${unitTypeRaw}`;
//         // const unitNumber = typeName.replace("TheArthouse-", "").toLowerCase();
//         if(balconyRef){
//           if(!notRunning.includes(unitType + balconyRef.balconyReference)){
//             notRunning.push(unitType + balconyRef.balconyReference)
//           }
//         } else {
//           if(!notRunning.includes(unitType)){
//             notRunning.push(unitType)
//           }
//         }


//         if (balconyRef) {

//           const fileName = unitType.toLowerCase() + balconyRef.balconyReference
//           var topImage
//           balconyDIMS.forEach((e) => {
//             // console.log("Top Image: " + e.toLowerCase().split(".")[0].split("_").join("").split("-").join(""))
//             // console.log("Bottom Image: " + unitType.toLowerCase() + balconyRef.balconyReference)
//             // console.log("Match? " + e.toLowerCase().split(".")[0].split("_").join("") == unitType.toLowerCase() + balconyRef.balconyReference)
//             if(e.toLowerCase().split(".")[0].split("_").join("").split("-").join("").includes(unitType.toLowerCase() + balconyRef.balconyReference)){
//               topImage = e
//             }
//           })
  
//           if (topImage) {
//             // console.log("Top Image found for: " + balconyRef.unitName)
//             const baseFileName = "backplate_image_floorplan_" + unitNumber;
//             let suffix = 0;
//             let finalFileName;
  
//             finalFileName = `${baseFileName}_s2_${suffix}.webp`;
  
//             // Process files as needed (e.g., copy or rename)
//             // For demonstration purposes, just logging the result
//             // console.log(`Next available file name: ${finalFileName}`);

//             if (fs.existsSync(path.join(balconyDimDirectoryPath, topImage)) && fs.existsSync(path.join(inputDirectoryPath, finalFileName))) {
//               if(notRunning.includes(unitType + balconyRef.balconyReference)){
//                 const index = notRunning.indexOf(unitType + balconyRef.balconyReference)
//                 notRunning.splice(index, 1)
//               }
  
//               if(missingUnits.includes(unitNumber)){
//                 const index = missingUnits.indexOf(unitNumber)
//                 missingUnits.splice(index, 1)
//               }
//             } else {
//               console.log("File doesnt exist "  + path.join(balconyDimDirectoryPath, topImage))
//             }


//             overlayImages(path.join(inputDirectoryPath, finalFileName),
//               path.join(balconyDimDirectoryPath, topImage), path.join(outputDir, finalFileName));

//           }
  
//         } else {
//           var topImage
//           balconyDIMS.forEach((e) => {
//             // console.log("Top Image: " + e.toLowerCase().split(".")[0].split("_").join("").split("-").join(""))
//             // console.log("Bottom Image: " + unitType.toLowerCase())
//             // console.log("Match? " + e.toLowerCase().split(".")[0].split("_").join("") == unitType.toLowerCase())
//             if(e.toLowerCase().split(".")[0].split("_").join("").split("-").join("") == unitType.toLowerCase()){
//               topImage = e
//             } else if(e.toLowerCase().split(".")[0].split("_").join("").split("-").join("").includes(unitType.toLowerCase() + "b1")){
//               topImage = e
//             } else if(e.toLowerCase().split(".")[0].split("_").join("").split("-").join("").includes(unitType.toLowerCase() + "b2")){
//               topImage = e
//             } else if(e.toLowerCase().split(".")[0].split("_").join("").split("-").join("").includes(unitType.toLowerCase())){
//               topImage = e
//             }
//           })
  
//           if (topImage) {
//             // console.log("Top Image found for: " + balconyRef.unitName)
//             const baseFileName = "backplate_image_floorplan_" + unitNumber;
//             let suffix = 0;
//             let finalFileName;
  
//             finalFileName = `${baseFileName}_s2_${suffix}.webp`;

//             if (fs.existsSync(path.join(balconyDimDirectoryPath, topImage)) && fs.existsSync(path.join(inputDirectoryPath, finalFileName))) {
//               if(notRunning.includes(unitType)){
//                 const index = notRunning.indexOf(unitType)
//                 notRunning.splice(index, 1)
//               }
  
//               if(missingUnits.includes(unitNumber)){
//                 const index = missingUnits.indexOf(unitNumber)
//                 missingUnits.splice(index, 1)
//               }
//             } else {
//               console.log("File doesnt exist "  + path.join(balconyDimDirectoryPath, topImage))
//             }


  
//             overlayImages(path.join(inputDirectoryPath, finalFileName),
//               path.join(balconyDimDirectoryPath, topImage), path.join(outputDir, finalFileName));


//           }
//         }
  
  
//       } else {
//         console.log("Cant find the Unit in Mulesoft data: " + unitNumber)
//       }
//     } catch(e){
//       console.log(e)
//       console.log("Problematic unit " + item)
//     }

//   });
//   console.log(notRunning)
//   console.log(missingUnits)
// });