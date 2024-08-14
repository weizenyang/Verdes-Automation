const fs = require('fs');
const path = require('path');

// Define the paths of the directories to be compared
// const target1 = './Arthouse/floorplan/Unit matched types/NEW/S2';
// const target2 = './Arthouse/floorplan/Unit matched types/NEW/csv';

const target1 = './Arthouse/floorplan/Unit matched types/NEW/S1';
const target2 = './Arthouse/floorplan/Unit matched types/NEW/csv';

// const target1 = './Arthouse/floorplan/Unit matched types/NEW/S1';
// const target2 = './Arthouse/floorplan/Unit matched types/NEW/S2';

// const target1 = './Arthouse/floorplan/Original backplates/S2 DIMS';
// const target2 = './Arthouse/floorplan/Original backplates/DIMS';

// const target1 = './Arthouse/floorplan/segmented - distinct/POLISHED/S1/DIMS';
// const target2 = './Arthouse/floorplan/segmented - distinct/POLISHED/S2/DIMS';

const jsonFilePath = './Arthouse/response.json';
// Regex pattern to match the relevant part of the filenames
const regexPattern = /r\d{2}-\d{2}-\d{2}/;
// const regexPattern = /.*/;

// Function to get the list of files in a directory
const getFiles = (dirPath) => {
    return new Promise((resolve, reject) => {
        fs.readdir(dirPath, (err, files) => {
            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
        });
    });
};

// Function to extract the relevant part of the filename using regex
const extractRelevantPart = (filename) => {
    const match = filename.match(regexPattern);
    return match ? match[0].toLowerCase() : null;
};

const units = fs.readdirSync(target1)
const unitNumber = []

units.forEach((e) => {
    // console.log(extractRelevantPart(e))
    unitNumber.push(extractRelevantPart(e))
})



const getType = (array) => {
  const jsonFile = fs.readFileSync(jsonFilePath, 'utf8');
  const typeArray = [];
  const jsonData = JSON.parse(jsonFile);
  const results = jsonData.results;

  array.forEach((e) => {
    if (e) {
      const foundItem = results.find(i => {
        const unitNumber = i.aldar_unit_number.toLowerCase().split("-").join("");
        const searchValue = e.split("-").join("");
        return unitNumber.includes(searchValue);
      });

      if (foundItem) {
        console.log([e, foundItem.unit_category])
        // if (!typeArray.includes(foundItem.unit_category)) {
        //   typeArray.push(foundItem.unit_category);
        // }
      }
    }
  });

  console.log(typeArray);
};

getType(unitNumber)


// Run the comparison
