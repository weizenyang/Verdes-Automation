const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const sharp = require('sharp');

const selection = []

const inputDirectoryPath = './Arthouse/floorplan/plans';  // Replace with the actual directory path
const balconyReference = './Arthouse/floorplan/segmented - distinct/Unit Name - More Types Merged 2';


const jsonFilePath = './Arthouse/response.json';
const outputFilePath = './Arthouse/output.json';

// const oriDirectoryPath = './Arthouse/floorplan/Original backplates/Balcony DIMS';

// const outputDir = './Arthouse/floorplan/Unit matched types/NEW/S1 240812 Flipped 180';
// const oriDirectoryPath = './Arthouse/floorplan/Original backplates/DIMS/rotated';
// const newDirectoryPath = './Arthouse/floorplan/segmented - distinct/POLISHED/S1 240806/DIMS 180/Scaled';
// const testDirectoryPath = './Arthouse/floorplan/segmented - distinct/POLISHED/S1 240812/TEST';

var outputDir = './Arthouse/floorplan/Unit matched types/NEW/S2 240812 Flipped 180';
const oriDirectoryPath = './Arthouse/floorplan/Original backplates/S2 DIMS/rotated';
const newDirectoryPath = './Arthouse/floorplan/segmented - distinct/POLISHED/S2 240806/DIMS 180/Scaled';

const CSVDirectoryPath = './New CSV Resized/Scaled CSV Types';

const balconyReferenceNames = fs.readdirSync(balconyReference);
const resultsArray = [];
const balconyReferences = JSON.parse(fs.readFileSync(outputFilePath, 'utf8'));
var notRunning = []
var unitsRan = []
var testTypesImage = []
var testTypesCSV = []

var selectedType = "2ba1"

// Process balcony reference names
balconyReferenceNames.forEach(file => {
  const folderName = path.join(balconyReference, file);
  if (fs.statSync(folderName).isDirectory()) {
    const fileName = fs.readdirSync(path.join(folderName));
    fileName.forEach((e) => {
      if (e.includes("[")) {
        const unitName = e.split('[')[0].replace('.png', '');

        const balconyReference = e.match(/\[([^\]]+)\]/)[1];
        resultsArray.push({ unitName, balconyReference });
      }
    });
  } else {
    console.log(`FILE: ${file}`);
  }
});

////console.log(balconyReferenceNames);


function flipCsvHorizontally(filePath, canvasWidth, outputPath) {
  const outputFilePath = filePath.replace('.csv', '_flipped.csv');

  const rows = [];

  fs.createReadStream(filePath)
    .pipe(csv.parse({ headers: false }))
    .on('data', (row) => {
      const y = parseFloat(row[1]);
      const x = parseFloat(row[2]);
      const flippedX = canvasWidth - x;
      rows.push([row[0], y, flippedX]);
    })
    .on('end', () => {
      const writeStream = fs.createWriteStream(path.join(outputDir + "/csv3", outputPath));
      csv.write(rows, { headers: false }).pipe(writeStream);
      // console.log(`File ${filePath} has been flipped and saved as ${path.join(outputDir + "/csv3", outputPath)}`);
    });
}

// Read the JSON file
fs.readFile(jsonFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error(`Error reading JSON file: ${err}`);
    return;
  }

  const jsonData = JSON.parse(data);
  const results = jsonData.results;
  const groups = {};

  ////console.log(jsonData.results.length);

  // Read the new directory
  const newDirectoryNames = fs.readdirSync(newDirectoryPath);
  const oriDirectoryNames = fs.readdirSync(oriDirectoryPath);
  const CSVDirectoryNames = fs.readdirSync(CSVDirectoryPath);

  // Iterate over each item in the JSON
  results.forEach(item => {

    if (item.unit_category.toLowerCase()) {
      let unitTypeRaw = item.unit_category.toLowerCase().replace(' ', '').replace("(", "").replace(")", "").replace("+", "");
      let unitType = item.unit_category.toLowerCase().replace(' ', '_').replace('br', 'b').replace("(", "").replace(")", "");
      let matchingUnitTypeImage = item.unit_category.toLowerCase().replace(' ', '_').replace('br', 'b').replace("(", "").replace(")", "");
      if (unitType.includes("+")) {
        const temp = unitType.split("+");
        temp[1] = temp[1].split("_")[1] + temp[1].split("_")[0];
        unitType = temp.join("_");
      }

      


      const groupName = `${unitTypeRaw}`;
      const unitNumber = item.aldar_unit_number.replace("TheArthouse-", "").toLowerCase();

      if(unitNumber.includes("12-07-06")){
        console.log("Detected")
        console.log(unitNumber)
        console.log(groupName)
      }

      if (item.mirror != "NORMAL" && unitType.split("_").join("") == "2ba1st") {
        const temp = unitType.split("_");
        temp[0] += "f";
        unitType = temp.join("_");
        console.log(unitType.split("_"))
        selection.push(unitNumber)
      }
      
      var balconyRef = ""
      balconyReferences.forEach((ref) => {
        const br = ref.unitName.split("_").join("")
        const un = unitNumber.split("-").join("")

        if (br.includes(un)) {
          ////console.log("MATCHED: " + ref.balconyReference)
          balconyRef = ref.balconyReference
        }
      });




      // Initialize the group list if it doesn't exist
      if (!groups[groupName]) {
        groups[groupName] = [];
      }

      // Compare with the new directory names
      oriDirectoryNames.forEach(file => {
        var floor = 0;
        var tempName = groupName;
        if (file.toLowerCase().includes("upper")) {
          floor = 1;
          tempName += "Upper";
          // console.log(tempName)
        } else if (file.toLowerCase().includes("lower")) {
          floor = 0;
          tempName += "Lower";
          // console.log(tempName)
        }

      //   if(unitNumber.includes("r10-01-04")){
      //     console.log(file.toLowerCase())
      //     console.log(tempName)
      //     console.log(unitNumber)
      //     console.log(item.mirror)
      //     console.log(balconyRef)
      //     console.log(file.toLowerCase().includes(tempName))
      // }


        if (file.toLowerCase().includes(tempName) && item.mirror == "NORMAL") {

          //console.log("Run Normal " + unitNumber)
          groups[groupName].push(file);
          const outputFileName = `backplate_image_floorplan_${unitNumber}_s1_${floor}.webp`;
          ////console.log(file + " : " + tempName);

          var splitName = file.split("_")
          splitName[0] += balconyRef ? "_" + balconyRef.toUpperCase() : ""

          if (!splitName.join("_").toLowerCase().includes("flipped")) {
            // console.log("No Flip " + unitNumber )
            // console.log(splitName)
            if (balconyRef != "") {
              // console.log(splitName.join("_"))
              
              // console.log(path.join(newDirectoryPath, splitName.join("_")), path.join(outputDir, outputFileName))
              try{
                fs.copyFileSync(path.join(newDirectoryPath, splitName.join("_").toLowerCase().replace('.png', '.webp')), path.join(outputDir, outputFileName))
                // checkRunning(unitNumber)

                // if(!testTypesImage.includes(unitType)){
                //   if(!fs.existsSync(testDirectoryPath)){
                //     fs.mkdirSync(testDirectoryPath)
                //   }
                //   const imageFolder = path.join(testDirectoryPath, "image")
                //   if(!fs.existsSync(imageFolder)){
                //     fs.mkdirSync(imageFolder)
                //   }
                  
                //   fs.copyFileSync(path.join(newDirectoryPath, splitName.join("_")), path.join(imageFolder, outputFileName))
                //   testTypesImage.push(unitType)
                // }

                console.log("RUNNING" + path.join(newDirectoryPath, splitName.join("_").toLowerCase()) + " " + outputFileName)
              } catch(e) {
                console.log(e)
              }
              
            } else {
              
              // console.log(path.join(oriDirectoryPath, splitName.join("_")), path.join(outputDir, outputFileName))
              try{
                fs.copyFileSync(path.join(oriDirectoryPath, splitName.join("_").toLowerCase().replace('.png', '.webp')), path.join(outputDir, outputFileName))
                // checkRunning(unitNumber)

                // if(!testTypesImage.includes(unitType)){
                //   if(!fs.existsSync(testDirectoryPath)){
                //     fs.mkdirSync(testDirectoryPath)
                //   }
                //   const imageFolder = path.join(testDirectoryPath, "image")
                //   if(!fs.existsSync(imageFolder)){
                //     fs.mkdirSync(imageFolder)
                //   }
                  
                //   fs.copyFileSync(path.join(newDirectoryPath, splitName.join("_")), path.join(imageFolder, outputFileName))
                //   testTypesImage.push(unitType)
                // }

                console.log("RUNNING" + path.join(oriDirectoryPath, splitName.join("_")) + " " + outputFileName)
              } catch(e) {
                console.log(e)
              }
              
            }
          } else {
            //console.log("Not running")
          }

          // ////console.log(path.join(newDirectoryPath, file.split("_")))

          //   sharp(path.join(newDirectoryPath, file))
          //     .webp({ quality: 80 })
          //     .toFile(path.join(outputDir, outputFileName), (err, info) => { ////console.log(err) });

        } else if (file.toLowerCase().includes(tempName) && item.mirror == "MIRROR") {

          //console.log("Run Mirror" + unitNumber)
          const outputFileName = `backplate_image_floorplan_${unitNumber}_s1_${floor}.webp`;
          var splitName = file.split("_")
          splitName[0] += balconyRef ? "_" + balconyRef.toUpperCase() : ""
          
          ////console.log("SplitName " + splitName)      

          if (splitName.join("_").toLowerCase().includes("flipped")) {
            // console.log("Flipped Detected " + unitNumber )
            // console.log(splitName)
  
            // splitName = splitName.join("_")
            // splitName = splitName.split(".")
            // splitName[0] += "_Flipped"
            
            if (balconyRef != "") {
              if (notRunning.includes(unitNumber)) {

                const index = notRunning.indexOf(unitNumber, tempName);
                notRunning = notRunning.splice(index, 1);

              }

              ////console.log("SplitName" + splitName)

              
              
              try{
                // if(!testTypesImage.includes(unitType)){
                //   if(!fs.existsSync(testDirectoryPath)){
                //     fs.mkdirSync(testDirectoryPath)
                //   }
                //   const imageFolder = path.join(testDirectoryPath, "image")
                //   if(!fs.existsSync(imageFolder)){
                //     fs.mkdirSync(imageFolder)
                //   }
                  
                //   fs.copyFileSync(path.join(newDirectoryPath, splitName.join("_")), path.join(imageFolder, outputFileName))
                //   testTypesImage.push(unitType)
                // }

                fs.copyFileSync(path.join(newDirectoryPath, splitName.join("_").toLowerCase().replace('.png', '.webp')), path.join(outputDir, outputFileName))
                // checkRunning(unitNumber)
                // console.log(path.join(newDirectoryPath, splitName.join("_")) + " to " + path.join(outputDir, outputFileName))
              } catch(e) {
                
              }
              
            } else {
              try{
                // if(!testTypesImage.includes(unitType)){
                //   if(!fs.existsSync(testDirectoryPath)){
                //     fs.mkdirSync(testDirectoryPath)
                //   }
                //   const imageFolder = path.join(testDirectoryPath, "image")
                //   if(!fs.existsSync(imageFolder)){
                //     fs.mkdirSync(imageFolder)
                //   }
                  
                //   fs.copyFileSync(path.join(newDirectoryPath, splitName.join("_")), path.join(imageFolder, outputFileName))
                //   testTypesImage.push(unitType)
                // }
                fs.copyFileSync(path.join(oriDirectoryPath, splitName.join("_").toLowerCase().replace('.png', '.webp')), path.join(outputDir, outputFileName))
                // checkRunning(unitNumber)
                // console.log(path.join(oriDirectoryPath, splitName.join("_")) + " to " + path.join(outputDir, outputFileName))
              } catch(e) {
                
              }
              
              
            }


            //   sharp(path.join(newDirectoryPath, file))
            //     .flop()
            //     .webp({ quality: 80 })
            //     .toFile(path.join(outputDir, outputFileName), (err, info) => { ////console.log(err) });
          }
        } else {
          if (!notRunning.includes(unitNumber)) {
            notRunning.push(unitNumber, tempName)
          }
        }
      });


      CSVDirectoryNames.forEach(file => {
        var floor = 0;

        if (file.toLowerCase().includes("_1.csv")) {
          floor = 1;
        } else if (file.toLowerCase().includes("_0.csv")) {
          floor = 0;
        }

        var tempName = unitType + "_s1_" + floor;

        if (file.toLowerCase().split("_").join("").includes(tempName.toLowerCase().split("_").join(""))) {
          groups[groupName].push(file);

          const outputFileName = `csv_floorplan_${unitNumber}_s1_${floor}.csv`;
          // if(file.split("_").join("").split("-").join("").includes("2ba1"))

          // if(!testTypesCSV.includes(unitType)){
          //   if(!fs.existsSync(testDirectoryPath)){
          //     fs.mkdirSync(testDirectoryPath)
          //   }
          //   const csvFolder = path.join(testDirectoryPath, "csv")
          //   if(!fs.existsSync(csvFolder)){
          //     fs.mkdirSync(csvFolder)
          //   }
            
          //   fs.copyFileSync(path.join(CSVDirectoryPath, file), path.join(csvFolder, outputFileName));
          //   testTypesCSV.push(unitType)
          // }
          //console.log(file.toLowerCase().split("_").join("") + " : " + tempName.toLowerCase().split("_").join("") + ` : ${outputFileName}`);
          // fs.copyFileSync(path.join(CSVDirectoryPath, file), path.join(outputDir + "/csv3", outputFileName));
          // console.log(path.join(outputDir + "/csv3", outputFileName))
        } else if (file.toLowerCase().split("_").join("").includes(tempName.toLowerCase().split("_").join("").replace("bf", "b"))) {
          const outputFileName = `csv_floorplan_${unitNumber}_s1_${floor}.csv`;
          // if(!testTypesCSV.includes(unitType)){
          //   if(!fs.existsSync(testDirectoryPath)){
          //     fs.mkdirSync(testDirectoryPath)
          //   }
          //   const csvFolder = path.join(testDirectoryPath, "csv")
          //   if(!fs.existsSync(csvFolder)){
          //     fs.mkdirSync(csvFolder)
          //   }
            
          //   flipCsvHorizontally(path.join(CSVDirectoryPath, file.replace("bf", "b")), 4096, path.join(csvFolder, outputFileName));
          //   testTypesCSV.push(unitType)
          // }
          
          // flipCsvHorizontally(path.join(CSVDirectoryPath, file.replace("bf", "b")), 4096, outputFileName);
        }
      });
    }
  });
  console.log(notRunning)
  selection.sort((a, b) => {
    // Extract the numeric parts from the unit names
    const [ra, xa, ya] = a.slice(1).split('-').map(Number);
    const [rb, xb, yb] = b.slice(1).split('-').map(Number);

    // Compare the extracted values
    return ra - rb || xa - xb || ya - yb;
  });
  console.log(selection)

  fs.writeFile(outputFilePath, JSON.stringify(resultsArray, null, 2), (err) => {
    if (err) {
      console.error('Error writing output JSON file:', err);
    } else {
      console.log('Output JSON file has been written successfully.');
    }
  });

  ////console.log('File grouping, moving, and renaming completed.');
});