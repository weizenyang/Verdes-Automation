const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const sharp = require('sharp');

const outputFilePath = "./Unit Floorplans"
const inputFileDir = "./Floorplans/output"
const jsonFilePath = './reference.json';
const csvFolderPath = './Arthouse/floorplan/Unit matched types/NEW/S2 240806 Flipped/csv5';

const jsonText = fs.readFileSync(jsonFilePath)
const jsonData = JSON.parse(jsonText);
const typeData = jsonData.types
const unitData = jsonData.units

unitData.forEach((unit) => {
    const subfolder = path.join(inputFileDir, `${unit.rotation}_${unit.flip}`)
    fs.readdir(subfolder, (err, images) => {

        const selectedImage = images.filter(image => image.includes(unit.type))
        console.log(selectedImage)

        const outputPath = path.join(outputFilePath, `backplate_image_floorplan_${unit.name}_${unit.type}`)
        // if(!fs.existsSync(outputPath)){
        //     fs.mkdirSync(outputPath)
        // }
        exportCompressedImage(path.join(subfolder, selectedImage[0]), outputPath)

    })
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

