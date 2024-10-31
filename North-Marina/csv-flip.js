const path = require('path')
const fs = require('fs')
const csv = require('fast-csv');

const inputPath = "./CSV"

const files = fs.readdirSync(inputPath)

const toRemove = ["backplate_image_floorplan_v_p_", "Floorplan_", "csv_floorplan_v_p_"]

const toReplace = [
    { type:"canal", abbr: "a"},
    { type:"sidecanal", abbr: "b"},
    { type:"inland", abbr: "b"},
]

function flipCsvHorizontally(filePath, canvasWidth, outputPath) {
  
    const rows = [];
    if(fs.lstatSync(filePath).isFile() ){
        fs.createReadStream(filePath)
        .pipe(csv.parse({ headers: false }))
        .on('data', (row) => {
        const y = parseFloat(row[1]);
        const x = parseFloat(row[2]);
        const flippedX = canvasWidth - x;
        rows.push([row[0], y, flippedX]);
        })
        .on('end', () => {
        const writeStream = fs.createWriteStream(path.join(inputPath, outputPath));
        csv.write(rows, { headers: false }).pipe(writeStream);
        // console.log(`File ${filePath} has been flipped and saved as ${path.join(outputDir + "/csv4", outputPath)}`);
        });
    }

  }

files.forEach((e) => {
    const toRemoveSelected = toRemove.filter((i) => e.includes(i))
    const cleanedName = toRemoveSelected.length == 1 ? e.replace(toRemoveSelected[0], "") : e
    const extRemoved = cleanedName.split(".")[0]
    const ext = cleanedName.split(".")[1]
    const split = extRemoved.split("_")

    const renamed = split.map((e) => {
        //Find and Replace Type
        const selectedReplacement = toReplace.filter((i) => i.type == e)
        if(selectedReplacement.length > 0){
            return selectedReplacement[0].abbr
        } else if (!isNaN(e) && e.length < 2) {
            return "0" + e
        } else {
            return e
        }
        
    })
    const detectFlipped = renamed.map((e) => {
        if(e.includes("bn")){
            renamed.push("nd")
            return e.replace("bn", "b")
        } else {
            return e
        }
    })

    if (renamed.some(e => e.includes("bn"))) {
        detectFlipped.push("nd");
    }

    // console.log(detectFlipped)

    //Separate into correct identifier
    const configuration = detectFlipped[0]
    const type = detectFlipped[1]
    const floor = detectFlipped.filter((e) => !isNaN(e))
    const style = detectFlipped.filter((e) => e.includes('s'))
    const furnishings = detectFlipped.filter((e) => e.includes('p'))
    const flipped = detectFlipped.filter((e) => e.includes('n') || e.includes('f'))

    const finalName = []
    if(flipped.length < 1){
        
        if(configuration){
            finalName.push(configuration.replace('b', 'bf'))
        }
        if(type){
            finalName.push(type)
        }
        if(style.length > 0){
            finalName.push(style[0])
        }
        if(floor.length > 0){
            finalName.push(floor[0].slice(-1))
        }
        if(furnishings.length > 0){
            finalName.push(furnishings[0])
        }
        if(flipped.length > 0){
            finalName.push(flipped[0])
        }
    }


    console.log(`${finalName.join("_")}.${ext}`)
    flipCsvHorizontally(path.join(inputPath, e), 4096, `csv_floorplan_v_p_${finalName.join("_")}.${ext}`)
    
    // fs.renameSync(path.join(inputPath, e), path.join(inputPath,`Floorplan_${finalName.join("_")}.${ext}`))

})