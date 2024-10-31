const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

var garden = []
var layout = []
var dims = []
var safeFrame = []

const inputPath = "./input"
const tempPath = "./temp"
const outputPath = "./output"
const dimsOffsetPath = "./dimsOffset.json"
const dimsOffset = JSON.parse(fs.readFileSync(dimsOffsetPath))



const inputFolder = fs.readdirSync(inputPath)

console.log(inputFolder)
console.log(inputFolder.length)

inputFolder.forEach((e) => {
    const basename = path.basename(e, path.extname(e))

    if (basename.includes("Render")) {
        garden.push(e)
    }

    if (basename.includes("p") && !basename.includes("Render")) {
        layout.push(e)
    }

    if (!basename.includes("p") && !basename.includes("Render") && !isNaN(basename.split("_")[2])) {
        dims.push(e)
    }

    if (basename.includes("f") && !basename.includes("p") && !basename.includes("Render") && isNaN(basename.split("_")[2])) {
        safeFrame.push(e)
    }
})

console.log("garden: " + garden.length)
console.log(garden)
console.log("layout: " + layout.length)
console.log(layout)
console.log("dims: " + dims.length)
console.log(dims)
console.log("safeFrame: " + safeFrame.length)
console.log(safeFrame)
console.log("")
console.log("Separated Length : Input Length")
console.log(`${garden.length + layout.length + dims.length + safeFrame.length} : ${inputFolder.length}`)

async function compositeImage(layoutImage) {
    // Construct the full paths
    const bottomImagePath = path.join(inputPath, layoutImage);

    const types = [layoutImage.split("_")[0], layoutImage.split("_")[1]].join("_")
    const floor = layoutImage.split("_")[2]
    const furnishings = layoutImage.split("_")[3]
    const style = layoutImage.split("_")[4]
    const tempDims = dims.filter((e => e.includes(types) && e.includes(floor)))


    // const topImagePath = path.join(inputPath, matchingTopImageFile);
    // const topFlippedImagePath = path.join(inputPath, `Flipped_${matchingTopImageFile}`);


    // Load and resize the bottom image
    const bottomImage = await sharp(bottomImagePath)
        .resize(4096, 4096)
        .toBuffer();

    const bottomImageFlipped = await sharp(bottomImagePath)
        .resize(4096, 4096)
        .flop()
        .toBuffer();

    const normalDims = tempDims.filter((e) => e.includes("nd"))
    console.log(normalDims)
    // Load and resize the top image
    const topImage = await sharp(path.join(inputPath, normalDims[0]))
        .resize(4096, 4096)
        .toBuffer();

    const flippedDims = tempDims.filter((e) => e.includes("fd"))
    console.log(flippedDims)
    const topFlippedImage = await sharp(path.join(inputPath, flippedDims[0]))
        .resize(4096, 4096)
        .toBuffer();

    if(!fs.existsSync(path.join(tempPath, "dims"))){
        fs.mkdirSync(path.join(tempPath, "dims"))
    }

    const normalOffsetObject = dimsOffset.offsets.filter((e) => e.name.includes(types) && e.mirror.includes("NORMAL") && e.floor.includes(floor));
    const normalOffset = normalOffsetObject.length > 0 ? [normalOffsetObject[0].offsetX || 0, normalOffsetObject[0].offsetY || 0] : [0, 0];

    // Apply offsets correctly to left and top
    const compositeOptions = [
        { input: bottomImage, left: 0, top: 0 },
        { input: topImage, left: normalOffset[0], top: normalOffset[1] }
    ];

    await sharp(bottomImage)
        .composite(compositeOptions)
        .png({ compressionLevel: 7 })
        .toFile(path.join(path.join(tempPath, "dims"), `${types}_${floor}_${furnishings}_${style}_nd.png`));

    const flippedOffsetObject = dimsOffset.offsets.filter((e) => e.name.includes(types) && e.mirror.includes("MIRROR") && e.floor.includes(floor));
    const flippedOffset = flippedOffsetObject.length > 0 ? [flippedOffsetObject[0].offsetX || 0, flippedOffsetObject[0].offsetY || 0] : [0, 0];

    // Apply offsets correctly to left and top for flipped image
    const compositeOptionsFlipped = [
        { input: bottomImageFlipped, left: 0, top: 0 },
        { input: topFlippedImage, left: flippedOffset[0], top: flippedOffset[1] }
    ];

    await sharp(bottomImageFlipped)
        .composite(compositeOptionsFlipped)
        .png({ compressionLevel: 7 })
        .toFile(path.join(path.join(tempPath, "dims"), `${types}_${floor}_${furnishings}_${style}_fd.png`));
}

layout.forEach((e) => {
    compositeImage(e)
})





