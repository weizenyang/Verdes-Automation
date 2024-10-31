const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const sharp = require('sharp');

const jsonFilePath = './Arthouse/response.json';
const csvFolderPath = './Arthouse/floorplan/Unit matched types/NEW/S2 240806 Flipped/csv5';
const scaledS1 = './Arthouse/floorplan/Unit matched types/NEW/S1 240812 Flipped/240812 Scaled - S1 Rotated';
const scaledS2 = './Arthouse/floorplan/Unit matched types/NEW/S2 240812 Flipped/240812 Scaled - S2 Rotated';
const outputPath = './Arthouse/floorplan/Unit matched types/NEW/S2 240806 Flipped/csv5/text-embedded-images'
const balconyReference = './Arthouse/balcony.json';
const unitsAffected = []


const selectedTypes = {
  "3brma1": ["Storage"],
  "3brma2": ["Storage"],
  "3brma3": ["Storage"],
  "3brma4": ["Storage"],
  "5brmsv": ["Storage"],
  "2bra1": ["Laundry"],
  "2bra2": ["Laundry"],
}


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
  balconyRotationArray.splice(balconyRotationArray.length, 0, ...balconyRotationResults[e])
})
console.log(balconyRotationArray)

const selectedField = (csvFile, field) => {
  const rows = [];

  const inputPath = path.join(csvFolderPath, csvFile)


  fs.createReadStream(inputPath)
    .pipe(csv.parse({ headers: false }))
    .on('data', (row) => {
      const tagName = row[0];
      const yPos = parseFloat(row[1]);
      const xPos = parseFloat(row[2]);

      if (tagName.toLowerCase() != field.toLowerCase()) {
        rows.push([tagName, yPos, xPos]);
      } else {
        console.log(field + " replaced")

      }

    }
    )
    .on('end', () => {
      if (!fs.existsSync(path.join(outputPath, "/modifiedCSV"))) {
        fs.mkdir(path.join(outputPath, "/modifiedCSV"))
      }
      const writeStreamS1 = fs.createWriteStream(path.join(outputPath + "/modifiedCSV", csvFile.replace("s2", "s1")));
      const writeStreamS2 = fs.createWriteStream(path.join(outputPath + "/modifiedCSV", csvFile.replace("s1", "s2")));
      csv.write(rows, { headers: false }).pipe(writeStreamS1);
      csv.write(rows, { headers: false }).pipe(writeStreamS2);
      console.log(`${path.join(outputPath + "/modifiedCSV", csvFile)}`);
    });
};

async function embedText(csvPath, imagePath, fields, schema) {
  var rows = []
  console.log(csvPath)
  fs.createReadStream(csvPath)
    .pipe(csv.parse({ headers: false }))
    .on('data', (row) => {
      const tagName = row[0];
      const yPos = parseFloat(row[1]);
      const xPos = parseFloat(row[2]);

      const lcField = fields.map((e) => {
        return e.toLowerCase()
      })

      if (lcField.includes(tagName.toLowerCase())) {
        rows.push([tagName, yPos, xPos]);
        console.log(tagName.toLowerCase() + " Found")
      }
    }
    ).on("end", async function () {

      const imageBaseName = path.basename(imagePath)
      const imageDirName = path.dirname(imagePath)
      var outputImagePath = ""

      if (schema.toLowerCase() == 's1') {
        outputImagePath = path.join(outputPath, imageBaseName.replace('s2', 's1'))
      } else if (schema.toLowerCase() == 's2') {
        outputImagePath = path.join(outputPath, imageBaseName.replace('s1', 's2'))
      }

      // Load the input image
      const image = sharp(imagePath);

      // Get the metadata of the image to determine its dimensions
      const { width, height } = await image.metadata();

      var svgTexts = ''
      const fontSize = 22.6;
      // Create an SVG with multiple rectangles and texts
      rows.forEach(([name, posY, posX]) => {
        console.log([name, posY, posX])

        const [scaledPosX, scaledPosY] = [posX * width / 4096, posY * height / 4096]

        // Approximate text width based on character count and font size

        const textWidth = name.length * (fontSize * 0.6); // Approximation of text width
        const rectPadding = 18; // Padding inside the rectangle

        const rectWidth = textWidth + rectPadding * 0.8;
        const rectHeight = fontSize + rectPadding * 0.7;

        const rectX = scaledPosX - (rectWidth / 2); // Center horizontally at posX
        const rectY = scaledPosY - (rectHeight / 1.5); // Center vertically at posY

        svgTexts += `<rect x="${rectX}" y="${rectY + (fontSize - (fontSize / 100))}" width="${rectWidth}" height="${rectHeight}" rx="5" ry="5" fill="rgba(0, 0, 0, 0.5)" /><text x="${scaledPosX}" y="${scaledPosY + (fontSize - (fontSize / 100))}" text-anchor="middle" class="title" dominant-baseline="middle">${name}</text>`
      });



      var svgContent = `
          <svg width="${width}" height="${height}">
              <style>
                  .title { fill: white; font-size: ${fontSize}px; font-weight: normal; font-family: san-serif}
              </style>`;
      svgContent += svgTexts;
      svgContent += `</svg>`
      // console.log("New")
      // console.log(svgContent)

      //   fs.writeFileSync(outputImagePath.replace('webp', 'svg'), svgContent);
      // Composite the SVG overlay on top of the original image
      //   await sharp(Buffer.from(svgContent))
      //   .png()
      //   .toFile(outputImagePath);
      if (svgTexts != '') {
        await image
          .composite([{ input: Buffer.from(svgContent), blend: 'over' }])
          .toFile(outputImagePath);
      }


      console.log(`Text with background added to image and saved to ${outputImagePath}`);
    });


}

function rotateImage(inputImage, outputImage){
  const canvasSize = 4096;

  const readStream = fs.createReadStream(inputFilePath);
  const writeStream = fs.createWriteStream(outputFilePath);

  const transformRow = (row) => {
      // Assuming the coordinates are in the second and third columns (index 1 and 2)
      const x = parseFloat(row[1]);
      const y = parseFloat(row[2]);

      // Rotate the coordinates by 180 degrees
      const xRotated = canvasSize - x;
      const yRotated = canvasSize - y;

      // Return the new row with rotated coordinates
      return [row[0], xRotated, yRotated, ...row.slice(3)];
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

results.forEach((e) => {
  const aldarUnitNumber = e.aldar_unit_number
  const unitType = e.unit_category.toLowerCase().replace(/[\s\+\(\)]/g, '');
  // console.log(aldarUnitNumber.replace("TheArthouse-", ""))
  const matchedS1 = scaledS1Dir.filter((i) => i.includes(aldarUnitNumber.replace("TheArthouse-", "").toLowerCase()))
  const matchedS2 = scaledS2Dir.filter((i) => i.includes(aldarUnitNumber.replace("TheArthouse-", "").toLowerCase()))
  const matchedCSV = csvDir.filter((i) => i.includes(aldarUnitNumber.replace("TheArthouse-", "").toLowerCase()))
  const matchedType = Object.keys(selectedTypes).filter((i) => i.toLowerCase().replace(/[\s\+\(\)]/g, '') == unitType)
  if (matchedType.length > 0) {
    // console.log(matchedS1)
    // console.log(matchedS2)
    // console.log(matchedCSV)
    // console.log(Object.keys(selectedTypes).filter((i) => i.toLowerCase().replace(/[\s\+\(\)]/g, '') == unitType))
    selectedTypes[matchedType[0]].forEach((i) => {
      if (matchedCSV.length > 0) {
        // selectedField(matchedCSV[0], i)
      }
    })

    // embedText(path.join(csvFolderPath, matchedCSV[0]), path.join(scaledS1, matchedS1[0]), selectedTypes[matchedType[0]], 's1')
    // embedText(path.join(csvFolderPath, matchedCSV[0]), path.join(scaledS2, matchedS2[0]), selectedTypes[matchedType[0]], 's2')
  }

  // console.log(selectedTypes[Object.keys(i).toLowerCase().replace(/[\s\+\(\)]/g, '')])
})

results.forEach((e) => {
  const aldarUnitNumber = e.aldar_unit_number
  const unitType = e.unit_category.toLowerCase().replace(/[\s\+\(\)]/g, '');
  // console.log(aldarUnitNumber.replace("TheArthouse-", ""))
  const matchedS1 = scaledS1Dir.filter((i) => i.includes(aldarUnitNumber.replace("TheArthouse-", "").toLowerCase()))
  const matchedS2 = scaledS2Dir.filter((i) => i.includes(aldarUnitNumber.replace("TheArthouse-", "").toLowerCase()))
  const matchedCSV = csvDir.filter((i) => i.includes(aldarUnitNumber.replace("TheArthouse-", "").toLowerCase()))
  const matchedType = Object.keys(selectedTypes).filter((i) => i.toLowerCase().replace(/[\s\+\(\)]/g, '') == unitType)
  if (matchedType.length > 0) {
    // console.log(matchedS1)
    // console.log(matchedS2)
    // console.log(matchedCSV)
    // console.log(Object.keys(selectedTypes).filter((i) => i.toLowerCase().replace(/[\s\+\(\)]/g, '') == unitType))
    selectedTypes[matchedType[0]].forEach((i) => {
      if (matchedCSV.length > 0) {
        // selectedField(matchedCSV[0], i)
      }
    })

    // embedText(path.join(csvFolderPath, matchedCSV[0]), path.join(scaledS1, matchedS1[0]), selectedTypes[matchedType[0]], 's1')
    // embedText(path.join(csvFolderPath, matchedCSV[0]), path.join(scaledS2, matchedS2[0]), selectedTypes[matchedType[0]], 's2')
  }

  // console.log(selectedTypes[Object.keys(i).toLowerCase().replace(/[\s\+\(\)]/g, '')])
})


