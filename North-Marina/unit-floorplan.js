const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

var garden = []
var safeFrame = []

const inputPath = "./input"
const gardensPath = "./input/gardens"
const tempPath = "./temp"
const outputPath = "./output"

const inputFolder = fs.readdirSync(inputPath)
const gardensFolder = fs.readdirSync(gardensPath)

inputFolder.forEach((e) => {
    const basename = path.basename(e, path.extname(e))

    if (basename.includes("f") && !basename.includes("p") && !basename.includes("Render") && isNaN(basename.split("_")[2])) {
        safeFrame.push(e)
    }
})

gardensFolder.forEach((e) => {
    const basename = path.basename(e, path.extname(e))

    if (basename.includes("Render")) {
        garden.push(e)
    }

})

//Units
const safeframeReferencePath = "./safeframe-reference.json"
const safeframeReference = JSON.parse(fs.readFileSync(safeframeReferencePath))

const mulesoftDataPath = "./mulesoft.json"
const mulesoftData = JSON.parse(fs.readFileSync(mulesoftDataPath))

const imageWithDims = fs.readdirSync(path.join(tempPath, "dims"))

var units = []

mulesoftData.results.forEach((e) => {
    const flipped = e.mirror == "MIRROR"
    var unitType = imageWithDims.filter((i) => e.unit_model.toLowerCase().includes(i.split("_")[0]))
    
    //Filter Flipped variants
    unitType = flipped ? unitType.filter((i) => i.includes("fd")) : unitType.filter((i) => i.includes("nd"))
    // console.log(unitType)
    
    //For each filtered imageWithDims, add background
    unitType.forEach((j) => {
        const regex = /^\d+$/;
        const floor = j.split("_").filter((i) => regex.test(i))[0]
        const ref = safeframeReference.reference.filter((i) => e.aldar_unit_number.includes(i.name))
        const style = j.split("_").filter((i) => i.includes("s"))[0]
        const pods = j.split("_").filter((i) => i.includes("p"))[0]
        const selectedSafeFrame = ref.length > 0 ? safeFrame.filter((i) => i.includes(j.split("_")[0]) && i.includes(ref[0].safeframe))[0] : safeFrame.filter((i) => i.includes(j.split("_")[0]))[0]
        const selectedGarden = garden.filter((i) => i.includes(e.aldar_unit_number.replace("NorthMarina-", "")) && i.includes(floor))[0]
        const data = {
            "floor" : floor,
            "style" : style,
            "pods" : pods
        }
        
        if(ref.length > 0){
            // console.log("Ref")
            // console.log(e.aldar_unit_number.replace("NorthMarina-", ""))
            // console.log(j)
            // console.log(selectedSafeFrame)
            // console.log(selectedGarden)
        }

        if(selectedSafeFrame && selectedGarden) {
            // console.log(selectedGarden)
            // console.log(path.join(path.join(tempPath, "dims"), j))
            // console.log(path.join(inputPath, selectedSafeFrame))
            // console.log(path.join(gardensPath, selectedGarden))
            // console.log(e.aldar_unit_number)
            compositeUnitImage(path.join(path.join(tempPath, "dims"), j), path.join(inputPath, selectedSafeFrame), path.join(gardensPath, selectedGarden), e.aldar_unit_number, data)
        }

    })
})

units.sort((a, b) => {
    return a.match(/\d+/g).join("") - b.match(/\d+/g).join("")
})

async function compositeUnitImage(imageWithDims, safeframe, garden, unitNumber, data){
    console.log("editing")
    console.log(data)
    const layoutImageWithDims = await sharp(imageWithDims)
    .resize(4096, 4096)
    .toBuffer();

    const safeframeImage = await sharp(safeframe)
    .resize(4096, 4096)
    .toBuffer();

    const gardenImage = await sharp(garden)
    .resize(4096, 4096)
    .toBuffer();

    const left = 0;
    const top = 0;
    const gardenLeft = 0;
    const gardenTop = 0;

    var compositeOptions = [
        { input: gardenImage, top, left },
        { input: safeframeImage, top, left },
        { input: layoutImageWithDims, top, left }
      ];

    const { width, height } = {width: 4096, height: 4096};

    // Create an overlay with the specified color and opacity
    const overlay = {
        input: Buffer.from(
            `<svg width="${width}" height="${height}">
                <rect x="0" y="0" width="100%" height="100%" fill="#b8a792" fill-opacity="0.5"/>
            </svg>`
        ),
        blend: 'over' // Overlay the color on top of the image
    };

    if(data.floor == "01"){
        compositeOptions.splice(1, 0, overlay)
    }
    
    const image1 = await sharp(imageWithDims)
    .composite(compositeOptions)
    .webp({ quality: 90 })
    .toFile(path.join(outputPath, `${unitNumber}_${data.floor}_${data.style}_${data.pods}.webp`))


}



