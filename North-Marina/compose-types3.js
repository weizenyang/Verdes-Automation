const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

var garden = []
var layout = []
var dims = []
var safeFrame = []
var baseImage = []

const inputPath = "./Temp input"
const tempPath = "./temp"
const outputPath = "./output"
const dimsOffsetPath = "./dimsOffset.json"
const dimsOffset = JSON.parse(fs.readFileSync(dimsOffsetPath))
const excludeScaleType = ["6b_b"]

const inputFolder = fs.readdirSync(inputPath)

console.log(inputFolder)
console.log(inputFolder.length)

inputFolder.forEach((e) => {
    const basename = path.basename(e, path.extname(e)).replace("Floorplan_", "")


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

    if (basename.includes("p3") && !basename.includes("Render")) {
        baseImage.push(e)
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
console.log("baseImage: " + baseImage.length)
console.log(baseImage)
console.log("")
console.log("Separated Length : Input Length")
console.log(`${garden.length + layout.length + dims.length + safeFrame.length} : ${inputFolder.length}`)

async function compositeImage(bottomImagePath, baseImagePath, tempDims, outputName, types, floor) {

    // const topImagePath = path.join(inputPath, matchingTopImageFile);
    // const topFlippedImagePath = path.join(inputPath, `Flipped_${matchingTopImageFile}`);
    // Load and resize the bottom image
    // const baseImage = await sharp(baseImagePath)
    // .resize(4096, 4096)
    // .toBuffer();

    // const baseImageFlipped = await sharp(baseImagePath)
    //     .resize(4096, 4096)
    //     .flop()
    //     .toBuffer();
    var excluded = excludeScaleType.filter((e) => outputName.replace("bf", "b").includes(e))
    var size = excluded.length > 0 ? 4096 : 3750
    var outputSize = 4096
    var difference = outputSize - size

    const { width, height } = await sharp(baseImagePath).metadata();
    const edge = await sharp(baseImagePath).extract({ left: 0, top: height - 300, width: width, height: 200 }).toBuffer();
    
    const { channels, dominant } = await sharp(edge).stats();
    // average
    const [ r, g, b ] = [169, 154, 135];
    // // dominant
    // const { r, g, b } = dominant;

    // const backgroundImage = await sharp(baseImagePath)
    // .resize(size, size)
    // .extend({
    //     top: difference,
    //     bottom: difference,
    //     left: difference,
    //     right: difference,
    //     background: {r: r, g: g, b: b, alpha: 1}
    // })
    // .toBuffer();

    const baseImage = await sharp(baseImagePath)
        .extend({
            top: difference,
            bottom: difference,
            left: difference,
            right: difference,
            background: {r: r, g: g, b: b, alpha: 1}
        })
        .toBuffer();

    const baseImageFlipped = await sharp(baseImagePath)
        .extend({
            top: difference,
            bottom: difference,
            left: difference,
            right: difference,
            background: {r: r, g: g, b: b, alpha: 1}
        })
        .flop()
        .toBuffer();

    // Load and resize the bottom image
    const bottomImage = await sharp(bottomImagePath)
        .extend({
            top: difference,
            bottom: difference,
            left: difference,
            right: difference,
            background: {r: r, g: g, b: b, alpha: 0}
        })
        .toBuffer();

        // const bottomImageTest = await sharp(bottomImagePath)
        // .extend({
        //     top: difference,
        //     bottom: difference,
        //     left: difference,
        //     right: difference,
        //     background: {r: r, g: g, b: b, alpha: 0}
        // })
        // .webp()
        // .toFile(path.join(path.join(tempPath, "dims"), outputName.replace(/(\d+)b_/, "$1bf_") + `_podsstuff.webp`));
        // const bottomImageFlipTest = await sharp(bottomImagePath)
        // .flop()
        // .extend({
        //     top: difference,
        //     bottom: difference,
        //     left: difference,
        //     right: difference,
        //     background: {r: r, g: g, b: b, alpha: 0}
        // })
        // .webp()
        // .toFile(path.join(path.join(tempPath, "dims"), outputName.replace(/(\d+)b_/, "$1bf_") + `_podsstuff.webp`));

    const bottomImageFlipped = await sharp(bottomImagePath)
        .flop()
        .extend({
            top: difference,
            bottom: difference,
            left: difference,
            right: difference,
            background: {r: r, g: g, b: b, alpha: 0}
        })
        .toBuffer();

    const normalDims = tempDims.filter((e) => e.includes("nd"))
    // Load and resize the top image
    const topImage = await sharp(path.join(inputPath, normalDims[0]))

        .extend({
            top: difference,
            bottom: difference,
            left: difference,
            right: difference,
            background: {r: r, g: g, b: b, alpha: 0}
        })
        .toBuffer();

    const topShadow = await sharp(path.join(inputPath, normalDims[0]))
        .negate({ alpha: false })
        .blur(5)
        .extend({
            top: difference,
            bottom: difference,
            left: difference,
            right: difference,
            background: {r: r, g: g, b: b, alpha: 0}
        })
        .toBuffer();

    const flippedDims = tempDims.filter((e) => e.includes("fd"))
    const topFlippedImage = await sharp(path.join(inputPath, flippedDims[0]))
        .extend({
            top: difference,
            bottom: difference,
            left: difference,
            right: difference,
            background: {r: r, g: g, b: b, alpha: 0}
        })
        .toBuffer();

    const topFlippedShadow = await sharp(path.join(inputPath, flippedDims[0]))
        .negate({ alpha: false })
        .blur(5)
        .extend({
            top: difference,
            bottom: difference,
            left: difference,
            right: difference,
            background: {r: r, g: g, b: b, alpha: 0}
        })
        .toBuffer();

    if(!fs.existsSync(path.join(tempPath, "dims"))){
        fs.mkdirSync(path.join(tempPath, "dims"))
    }

    const normalOffsetObject = dimsOffset.offsets.filter((e) => e.name.includes(types) && e.mirror.includes("NORMAL") && e.floor.includes(floor));
    const normalOffset = normalOffsetObject.length > 0 ? [normalOffsetObject[0].offsetX || 0, normalOffsetObject[0].offsetY || 0] : [0, 0];

    // Apply offsets correctly to left and top
    var compositeOptions = [
        { input: baseImage, left: 0, top: 0 },
        { input: bottomImage, left: 0, top: 0 },
        { input: topShadow, left: normalOffset[0], top: normalOffset[1] },
        { input: topImage, left: normalOffset[0], top: normalOffset[1] }
    ];    

    if(outputName.includes("p3")){
        compositeOptions.splice(1,1)
        // console.log("P3 Found " + baseImagePath)
        // console.log(compositeOptions)
    }
    
    


    const image = await sharp(bottomImage)
        .composite(compositeOptions)
        .toBuffer()

    await sharp(image)
        .resize(4096)
        .webp({ quality: 98})
        .toFile(path.join(path.join(tempPath, "dims"), `${outputName}.webp`));

    const flippedOffsetObject = dimsOffset.offsets.filter((e) => e.name.includes(types) && e.mirror.includes("MIRROR") && e.floor.includes(floor));
    const flippedOffset = flippedOffsetObject.length > 0 ? [flippedOffsetObject[0].offsetX || 0, flippedOffsetObject[0].offsetY || 0] : [0, 0];
    // const flippedOffset = [0, 0];
    // Apply offsets correctly to left and top for flipped image
    var compositeOptionsFlipped = [
        { input: baseImageFlipped, left: 0, top: 0 },
        { input: bottomImageFlipped, left: 0, top: 0 },
        { input: topFlippedShadow, left: flippedOffset[0], top: flippedOffset[1] },
        { input: topFlippedImage, left: flippedOffset[0], top: flippedOffset[1] }
    ];

    if(outputName.includes("p3")){
        //Remove the image
        compositeOptionsFlipped.splice(1,1)
    }

    const flippedImage = await sharp(bottomImageFlipped)
        .composite(compositeOptionsFlipped)
        .toBuffer()

    await sharp(flippedImage)
        .resize(4096)
        .webp({ quality: 98})
        .toFile(path.join(path.join(tempPath, "dims"), outputName.replace(/(\d+)b_/, "$1bf_") + `.webp`));

    console.log(path.join(path.join(tempPath, "dims"), outputName.replace("b", "bf") + `.webp`))
}

layout.forEach((e) => {
    console.log("baseImage")
    // console.log(e)
    // console.log(e.split("_").slice(0, -1).join("_"))
    // console.log(baseImages.filter((e) => e.includes(layoutImage.split("_").slice(0, -1).join("_")))[0])
    const bottomImagePath = path.join(inputPath, e);
    const baseImagePaths = baseImage.filter((i) => i.includes(e.split("_").slice(0, -1).join("_")));
    console.log(e.split("_").slice(0, -1).join("_"))
    console.log(baseImage)
    console.log(baseImagePaths)
    const nameParser = e.replace("Floorplan_", "")
    const baseImageNameParser = baseImage.filter((i) => i.includes(e.split("_").slice(0, -1).join("_")))
    // console.log(baseImageNameParser)

    const types = [nameParser.split("_")[0], nameParser.split("_")[1]].join("_")
    const floor = nameParser.split("_")[2]
    const furnishings = nameParser.split("_")[3].replace(".png", "")
    console.log(furnishings)
    const style = baseImageNameParser.map((e) => { return e.replace("Floorplan_", "").split("_")[4]})
    const tempDims = dims.filter((e => e.includes(types) && e.includes(floor)))


    // console.log(`${types}_${floor}_${furnishings}_${style}_fd.png`)
        baseImagePaths.forEach((baseImagePath) => {
            var filteredStyle = null
            if(baseImagePath.includes('s2')){
                filteredStyle = style.filter((e) => e.includes('s2'))
            } else {
                filteredStyle = style.filter((e) => e.includes('s1'))
            }

            filteredStyle.forEach((i) => {
                // console.log(floor)
                if(bottomImagePath != undefined && baseImagePath != undefined && tempDims.length > 0 ){
                    const furnishingsToDuplicate = ["p1", "p2", "p3", "p4"]
                    
                    if(floor == "01"){
                        compositeImage(bottomImagePath, path.join(inputPath, baseImagePath), tempDims,`backplate_image_floorplan_v_p_${types}_${i}_${floor.length > 1 ? floor.substr(-1) : floor}_${furnishings}`, types, floor)
                        // furnishingsToDuplicate.forEach((duplicatedFurnishing) => {
                        //     // console.log(`backplate_image_floorplan_v_p_${types}_${i}_${floor.length > 1 ? floor.substr(-1) : floor}_${duplicatedFurnishing}`)
                        //     compositeImage(bottomImagePath, path.join(inputPath, baseImagePath), tempDims,`backplate_image_floorplan_v_p_${types}_${i}_${floor.length > 1 ? floor.substr(-1) : floor}_${duplicatedFurnishing}`, types, floor)
                        // })
                    } else {
                        // console.log(`backplate_image_floorplan_v_p_${types}_${i}_${floor.length > 1 ? floor.substr(-1) : floor}_${furnishings}`)
                        compositeImage(bottomImagePath, path.join(inputPath, baseImagePath), tempDims,`backplate_image_floorplan_v_p_${types}_${i}_${floor.length > 1 ? floor.substr(-1) : floor}_${furnishings}`, types, floor)
                    }
                    
                } else {
                    console.log(bottomImagePath)
                    console.log(baseImagePath)
                    console.log(tempDims)
                }
                
            })
            
            //Rename all "p1" to ""
            const dimNames = fs.readdirSync(path.join(tempPath, "dims"))
            dimNames.forEach((e) => {
                if(e.includes("_p1")){
                    fs.renameSync(path.join(path.join(tempPath, "dims"), e), path.join(path.join(tempPath, "dims"), e.replace("_p1", "")))
                }

            })


        })
    })
   





