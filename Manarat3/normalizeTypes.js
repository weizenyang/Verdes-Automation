const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const sharp = require('sharp');

const outputFilePath = "./Floorplans/typeCorrected"
const inputFileDir = "./Floorplans/output"
const jsonFilePath = './reference.json';

const jsonText = fs.readFileSync(jsonFilePath)
const jsonData = JSON.parse(jsonText);
const typeData = jsonData.types
const unitData = jsonData.units

function normalizeRotation(rotation) {
  return ((rotation % 360) + 360) % 360;
}

typeData.forEach((e) => {
    // console.log(e)
    // console.log(e.name)
    if(e.offset.rotation < 360){
        console.log(e.name)
        
        let rotation = e.offset.rotation;
        const flip = e.offset.flip;
        const flipVariations = [flip, !flip]

        flipVariations.map((thisFlip, i) => {



          try{
            if(i == 1 && (rotation == 90 || rotation == 270)){
              rotation += 180
              rotation = normalizeRotation(rotation)
            }

            const folderName = [rotation, thisFlip].join("_")

            console.log(folderName)
            const targetFolder = path.join(inputFileDir, folderName)
            const files = fs.readdirSync(targetFolder)
            const subFolder = i == 1 ? "Normal" : "Flipped"

            const outputWSubfolder = path.join(outputFilePath, subFolder)
    
            const selectedFile = files.filter(fileName => fileName.includes(e.parent.name))[0]

            console.log(selectedFile)
            const buffer = fs.readFileSync(path.join(targetFolder, selectedFile))
            
            // fs.copyFileSync(path.join(targetFolder, selectedFile), path.join(outputWSubfolder, selectedFile))
            const renamed = selectedFile.replace(e.parent.name, e.name)
            if(!fs.existsSync(outputFilePath)){
              fs.mkdirSync(outputFilePath)
            }
            if(!fs.existsSync(outputWSubfolder)){
              fs.mkdirSync(outputWSubfolder)
            }
            fs.writeFileSync(path.join(outputWSubfolder, renamed), buffer)
            console.log(selectedFile)
            console.log(targetFolder)
            console.log(path.join(outputWSubfolder, renamed))
            // fs.renameSync(path.join(outputWSubfolder, selectedFile), path.join(outputWSubfolder, renamed))
          } catch (e){
            console.log("Trying " + e.name)
            console.log(e)
          }
  

        })

    }

})


async function exportCompressedImage(inputPath, outputPath){
    console.log(inputPath)
    const imageBuffer = sharp(inputPath).webp(80).toFile(`${outputPath}.webp`, (err, info) => {
        if(err){
            console.log(err)
        } else {
            console.log(info)
        }
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

