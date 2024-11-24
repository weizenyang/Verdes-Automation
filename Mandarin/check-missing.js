const fs= require("fs")
const checkFolder = "./Unit Floorplans"

const fileList = fs.readdirSync(checkFolder)
const jsonFilePath = './unit-reference.json';

const jsonText = fs.readFileSync(jsonFilePath)
const jsonData = JSON.parse(jsonText);

const checkTypes = ["a_s_2b_a1m_s1_0", "a_s_1b_b1_s1_0", "a_s_1b_b2_s1_0", "a_s_1b_b3_s1_0", "a_s_1b_b4_s1_0"]

var missingUnits = []

var missingTypes = []

const units = jsonData.units.filter(unit => checkTypes.includes(unit.type))



missingUnits = [...units]

console.log(fileList)

fileList.forEach((e) => {
    if (checkTypes.length > 0) {
        if (checkTypes.filter(type => e.includes(type)).length > 0) {
            if (e.includes("backplate_image_floorplan_")) {
                const data = e.replace("backplate_image_floorplan_", "");
                const unitNumber = data.split("_a_s_")[0];
                const unitType = "a_s_" + data.split("_a_s_")[1].split(".")[0];

                // Find indices to remove; assuming missingUnits is an array of objects with properties 'type' and 'name'
                const indicesToRemove = missingUnits.reduce((acc, unit, index) => {
                    const name = unit.name.toLowerCase();
                    const tower = name.split("-")[0];
                    const levelPart = name.split("-")[1];
                    const level = levelPart.length > 3 ? levelPart.substr(0, 2) : `0${levelPart.substr(0, 1)}`;
                    const unitName = levelPart.slice(-2);
                
                    const finalName = `${tower}-${level}-${unitName}`;
                    // console.log(finalName)
                    // console.log(unitNumber)
                    if (unitType.includes(unit.type) && unitNumber.includes(finalName)) {
                        acc.push(index);
                    }
                    return acc;
                }, []);

                // console.log(indicesToRemove)

                for (let i = indicesToRemove.length - 1; i >= 0; i--) {
                    missingUnits.splice(indicesToRemove[i], 1);
                }

                // Optionally log the unit number and type
                // console.log(unitNumber);
                // console.log(unitType);
            }
        }
    }
});

console.log(units)

