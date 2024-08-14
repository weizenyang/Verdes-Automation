const fs = require('fs');
const path = require('path');

// Define the paths of the directories to be compared
// const target1 = './Arthouse/floorplan/Unit matched types/NEW/S2';
// const target2 = './Arthouse/floorplan/Unit matched types/NEW/csv';

// const target1 = './Arthouse/floorplan/Unit matched types/NEW/S1';
// const target2 = './Arthouse/floorplan/Unit matched types/NEW/csv';

// const target1 = './Arthouse/floorplan/Unit matched types/NEW/S1';
// const target2 = './Arthouse/floorplan/Unit matched types/NEW/S2';

// const target1 = './Arthouse/floorplan/Original backplates/S2 DIMS';
// const target2 = './Arthouse/floorplan/Original backplates/DIMS';

const target1 = './OCR Test/Balcony Dim PNG/Test all images output';
const target2 = './Arthouse/floorplan/Unit matched types/NEW/Scaled S2';

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

// Function to compare the files in two directories
const compareDirectories = async (dir1, dir2) => {
    try {
        const files1 = await getFiles(dir1);
        const files2 = await getFiles(dir2);

        const relevantParts1 = files1.map(file => extractRelevantPart(file)).filter(Boolean);
        const relevantParts2 = files2.map(file => extractRelevantPart(file)).filter(Boolean);
        console.log(relevantParts1)
        console.log(relevantParts2)

        const missingInDir2 = relevantParts1.filter(part => !relevantParts2.includes(part.toLowerCase()));
        const missingInDir1 = relevantParts2.filter(part => !relevantParts1.includes(part.toLowerCase()));

        console.log("Types missing in Dir 1")
        getType(missingInDir1)

        console.log("Types missing in Dir 2")
        getType(missingInDir2)

        console.log(`Files in ${dir1} but not in ${dir2}:`);
        console.log(missingInDir2.length ? missingInDir2 : 'None');

        console.log(`Files in ${dir2} but not in ${dir1}:`);
        console.log(missingInDir1.length ? missingInDir1 : 'None');
    } catch (error) {
        console.error('Error comparing directories:', error);
    }
};

const getType = (array) => {
    var jsonFile = fs.readFileSync(jsonFilePath, 'utf8')
    var typeArray = []
    const jsonData = JSON.parse(jsonFile);
    const results = jsonData.results;
    array.forEach((e) => {
        
        results.forEach(i => {
            // console.log(i)
        if(i.aldar_unit_number.toLowerCase().includes(e)){
            if(!typeArray.includes(i.unit_category)){
                typeArray.push(i.unit_category)
            }
            
        }
    })
    }
)
    console.log(typeArray)
}


// Run the comparison
compareDirectories(target1, target2);