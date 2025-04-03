const fs = require("fs")
const unitReferencePath = "./unit-reference.json"
const unitReference = fs.readFileSync(unitReferencePath)
const unitReferenceData = JSON.parse(unitReference);

const filtered = unitReferenceData.units.filter(e => e.type.includes("as") && e.type.includes("s1"))
const units = {units: filtered}
fs.writeFileSync("./as_reference.json", JSON.stringify(units))

console.log(units)