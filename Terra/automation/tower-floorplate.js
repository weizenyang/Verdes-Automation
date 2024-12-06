const fs = require("fs")
const sharp = require("sharp")
const path = require("path")

const input = "../tower-floorplate/original"
const output = "../tower-floorplate/output"
const configPath = "./tower-floorplate.json"

const files = fs.readdirSync(input)
const configFile = fs.readFileSync(configPath)

const config = JSON.parse(configFile)

const logFilePath = "./app.log";

// if (process.env.PKG_EXE) {
//     process.env.LIBVIPS = path.join(path.dirname(process.execPath), 'node_modules', 'sharp', 'vendor');
//   }
// // Helper function to append logs to a file
// async function log(message) {
//   const logMessage = `${new Date().toISOString()} - ${message}\n`;
//   await Deno.writeTextFile(logFilePath, logMessage, { append: true });
//   console.log(message); // Still prints to the console
// }

// // Example task that logs messages
// console.log("App is running. Logs will be saved to app.log.");
// await log("Application started.");

// setInterval(async () => {
//   await log("App is still running...");
// }, 5000);

// // Keep the app running
// await new Promise(() => {});

var baseImages = files.filter((e) => {
    if(e.split("_").length < 5){
        return e
    }
})

var topImages = files.filter((e) => {
    if(e.split("_").length > 4){
        return e
    }
})

async function loadImages(imageFile, transformations){
    const thisImagePath = path.join(input, imageFile)
    
    const {width, height} = {width: 4320, height: 4320}
    
    let loadedImage = sharp(thisImagePath).resize(width, height)

    if(Object.keys(transformations).includes("flipY")){
        loadedImage = loadedImage.flop(transformations.flipY)
    }

    if(Object.keys(transformations).includes("flipX")){
        loadedImage = loadedImage.flip(transformations.flipX)
    }

    // if(Object.keys(transformations).includes("rotate")){
        
    //     loadedImage = loadedImage.rotate(transformations.rotate).resize(width, height, { fit: 'cover' })
    // }
    if (Object.keys(transformations).includes("rotate")) {
        // Perform the rotation
        loadedImage = await loadedImage
            .rotate(transformations.rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } }) // Rotate with transparent background
            .toBuffer();
    
        // Get metadata of the rotated image
        const { width: rotatedWidth, height: rotatedHeight } = await sharp(loadedImage).metadata();
    
        // Calculate crop dimensions to center the image
        const cropX = Math.max(0, (rotatedWidth - width) / 2);
        const cropY = Math.max(0, (rotatedHeight - height) / 2);
    
        // Crop the center portion to fit the target dimensions
        loadedImage = sharp(loadedImage)
            .extract({
                left: Math.round(cropX),
                top: Math.round(cropY),
                width: width,
                height: height,
            });
    }
    
    const buffer = await loadedImage.toBuffer();

    return buffer
}

async function compositeImages(topImage, bottomImage) {

    if(!fs.existsSync(output)){
        fs.mkdirSync(output)
    }

    console.log("Top Image: " + topImage.image)
    console.log("Bottom Image: " + bottomImage.image)

    const loadedTopImage = await loadImages(topImage.image, topImage.config)
    const loadedBottomImage = await loadImages(bottomImage.image, bottomImage.config)

    const compositeOptions = [
        { input: loadedBottomImage, top: 0, left: 0 },
        { input: loadedTopImage, top: 0, left: 0 },
    ];

    const dirName = path.dirname(output);
    const ext = path.extname(topImage.image).toLowerCase();
    const baseName = path.basename(topImage.image, ext);

    // Construct output path
    const outputPath = path.join(output, `${baseName.replace(topImage.config.type, topImage.config.name)}.webp`);

    console.log(topImage.image)
    console.log(bottomImage.image)
    console.log("Output Path: " + outputPath)
    

    await sharp({
        create: {
          width: 4320,
          height: 4320,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
        .composite(compositeOptions)
        .webp(90)
        .toFile(outputPath)
        .then(info => {
            console.log(`Processed image saved: ${outputPath}`);
        })
        .catch(error => {
            console.log(error);
        })

}

const towers = config.towers
    towers.forEach((e) => {
        let selectedBaseImage 
        if(!Object.keys(e).includes("name")){
            selectedBaseImage = baseImages.filter(baseImage => topImage.includes(baseImage.split(".")[0]))[0]
        } else {
            selectedBaseImage = baseImages.filter(baseImage => baseImage.includes(e.name))[0]
        }

        let selectedTopImages
        if(!Object.keys(e).includes("type")){
            if(selectedTopImages){
                selectedTopImages = topImages.filter(topImage => topImage.includes(selectedBaseImage.split(".")[0]))
            }
        } else {
            selectedTopImages = topImages.filter(topImage => topImage.includes(e.type))
        }

        if(selectedBaseImage && selectedTopImages && selectedTopImages.length > 0){
            console.log("SelectedBaseImage " + selectedBaseImage)
            console.log("SelectedTopImage " + selectedTopImages)
            selectedTopImages.forEach((topImage) => {
                const baseImageConfig = {flip: false, rotate: 0, x: 0, y: 0}
                const topImageConfig = {flip: e.flip, rotate: e.rotate, x: e.x, y: e.y, type: e.type, name: e.name}
                let baseImageObj = {image: selectedBaseImage, config: baseImageConfig}
                let topImageObj = {image: topImage, config: topImageConfig}
                compositeImages(topImageObj, baseImageObj)
            })
        } else {
            console.log("Failed: selectedBaseImage " + e.name + " | " + "selectedTopImages " + e.type)
        }
        
    })



    // //T2
    // selectedBaseImage = baseImages.filter(baseImage => topImage.replace("b1", "b2").includes(baseImage.split(".")[0]))[0]
    // if(selectedBaseImage){
    //     let baseImageObj = {image: selectedBaseImage, flip: false}
    //     let topImageObj = {image: topImage, flip: true}
    //     console.log("Is base image" + selectedBaseImage)
    //     compositeImages(topImageObj, baseImageObj)
    // } else {
    //     console.error("No T2 found")
    // }