const fs = require('fs');
const path = require('path');

// Load JSON file
const filePath = path.join("./", 'unit-reference.json');
const jsonText = fs.readFileSync(filePath, 'utf8');
const jsonData = JSON.parse(jsonText);

// Function to convert types
function convertType(type) {
    return type.replace(/(m)([a-z])(\d)/, '$2$3$1');
}

// Modify each unit's type
jsonData.units.forEach(unit => {
    unit.type = convertType(unit.type);
});

// Write the modified JSON back to the file
fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8');

console.log('The JSON data has been modified and saved successfully.');
