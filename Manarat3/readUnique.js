const fs = require('fs');
const path = require('path');

// Relative file path to the JSON file
const filePath = "./unit-reference.json"

try {
    // Read and parse the JSON file
    const rawData = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(rawData);

    // Ensure the JSON has a units array
    if (!Array.isArray(jsonData.units)) {
        console.error('The JSON file does not contain a valid units array.');
        process.exit(1);
    }

    // Extract and sort unique types
    const uniqueTypes = [...new Set(jsonData.units.map(unit => unit.type))]
        .sort((a, b) => {
            const nameA = a.match(/^([a-zA-Z]+)(\d*)$/);
            const nameB = b.match(/^([a-zA-Z]+)(\d*)$/);

            if (!nameA || !nameB) return a.localeCompare(b); // Fallback

            const [_, lettersA, numberA] = nameA;
            const [__, lettersB, numberB] = nameB;

            if (lettersA === lettersB) {
                return parseInt(numberA || 0, 10) - parseInt(numberB || 0, 10); // Sort numbers
            }

            return lettersA.localeCompare(lettersB); // Sort alphabets
        });

    // Log the sorted unique types
    console.log('Sorted Unique Types:', uniqueTypes);
    console.log(`Number of Unique Types: ${uniqueTypes.length}`);
} catch (error) {
    console.error('Error reading or processing the file:', error.message);
}
