const { error } = require("console")
const fs =  require("fs")
const sharp = require("sharp")
const path = require("path")

const input = "./input"
const DIMSInput = "../DIMS/permutations/"
const output = "./composed"

const files = fs.readdirSync(input)
const dimFiles = fs.readdirSync(DIMSInput)

const logFilePath = "./app.log";

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

console.log(files)

var baseImages = files.filter((e) => {
    if(e.split("_").length == 9){
        return e
    }
})

var topImages = dimFiles.filter((e) => {
    if(e.split("_").length == 7){
        return e
    }
})

async function loadImages(imageFile, flip, dir){
    console.log(imageFile)
    const thisImagePath = path.join(dir, imageFile)
    
    const loadedImage = await sharp(thisImagePath)
      .resize(4320, 4320)
      .flop(flip)
      .toBuffer();
    return loadedImage
}

async function compositeImages(topImage, bottomImage) {
    const loadedTopImage = await loadImages(topImage.image, topImage.flip, topImage.dir)
    const loadedBottomImage = await loadImages(bottomImage.image, bottomImage.flip, bottomImage.dir)

    const compositeOptions = [
        { input: loadedBottomImage, top: 0, left: 0 },
        { input: loadedTopImage, top: 0, left: 0 },
    ];

    console.log(topImage.flip)
    const outputPath = path.join(output, topImage.flip ? topImage.image.replace("b1", "b2") : topImage.image)
    
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
        .toFile(outputPath.split(".")[0] + ".webp")
        .then(info => {
            console.log(`Processed image saved: ${outputPath.split(".")[0] + ".webp"}`);
        })
        .catch(error => {
            console.log(error);
        })

}

console.log(topImages)
topImages.forEach((topImage) => {
    console.log(topImage.split(".")[0].split("_").slice(Math.max(topImage.split("_").length - 6, 1)).join("_"))
    //T1
    let selectedBaseImage = baseImages.filter(baseImage => topImage.replace("dims", "backplate_image_floorplan").includes(baseImage.split(".")[0].split("_").slice(Math.max(baseImage.split("_").length - 6, 1)).join("_")))[0]
    if(selectedBaseImage){
        let baseImageObj = {image: selectedBaseImage, flip: false, dir: input}
        let topImageObj = {image: topImage, flip: false, dir: DIMSInput}
        compositeImages(topImageObj, baseImageObj)
    }


})