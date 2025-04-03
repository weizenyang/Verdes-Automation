const fs = require("fs");
const csv = require("csv-parser");

const inputCsvFile = "250227 - Astoria - Merged.csv"; // Change to your actual CSV file
const unitOutputFile = "unit-reference.json"; // JSON for sorted unit references
const typeOutputFile = "reference.json"; // JSON for sorted unique types

// Function to extract numeric value from unit name
function extractNumber(unitName) {
    const numbers = unitName.match(/\d+/g); // Extract all numbers in the name
    return numbers ? parseInt(numbers.join("")) : 0; // Merge array into a whole number
}

// Function to process the CSV and generate unit references (sorted numerically)
function convertCsvToUnitJson(inputFile, outputFile) {
    const results = [];

    fs.createReadStream(inputFile)
        .pipe(csv())
        .on("data", (row) => {
            console.log(row[""])
            results.push({
                name: row["Unit Name"],
                type: row["Unit Type Dev"],
                flip: row["Mirrored"].toLowerCase() === "flipped" ? "true" : "false",
                rotation: isNaN(parseInt(row[""])) ? 0 : parseInt(row[""]),
            });
        })
        .on("end", () => {
            // Sort numerically based on extracted number from unit name
            results.sort((a, b) => extractNumber(a.name) - extractNumber(b.name));

            const jsonData = { units: results };

            fs.writeFile(outputFile, JSON.stringify(jsonData, null, 2), (err) => {
                if (err) {
                    console.error("Error writing JSON file:", err);
                } else {
                    console.log("Sorted Unit JSON file created successfully:", outputFile);
                }
            });
        });
}

// Function to process the CSV, extract unique types, sort them, and generate reference JSON
function convertCsvToTypeJson(inputFile, outputFile) {
    const uniqueTypes = new Set();

    fs.createReadStream(inputFile)
        .pipe(csv())
        .on("data", (row) => {
            if (row["Unit Type Dev"]) {
                uniqueTypes.add(row["Unit Type Dev"]);
            }
        })
        .on("end", () => {
            // Sort unique types alphabetically
            const sortedTypes = Array.from(uniqueTypes).sort();

            const typesArray = sortedTypes.map((type) => ({
                name: type,
                offset: {
                    rotation: 0,
                    flip: false
                },
                parent: {
                    name: type,
                    rotation: 0
                }
            }));

            const jsonData = { types: typesArray };

            fs.writeFile(outputFile, JSON.stringify(jsonData, null, 2), (err) => {
                if (err) {
                    console.error("Error writing JSON file:", err);
                } else {
                    console.log("Sorted Types JSON file created successfully:", outputFile);
                }
            });
        });
}

// Call the functions
convertCsvToUnitJson(inputCsvFile, unitOutputFile);
convertCsvToTypeJson(inputCsvFile, typeOutputFile);
