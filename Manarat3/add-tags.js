const fs = require("fs")
const sharp  = require("sharp")
const path  = require("path")

const inputFolder = "./Unit Floorplans"
const compFolder = "./Landmark Label/original"
const outputFolder = "./Landmark Label/output"

const files = fs.readdirSync(inputFolder)
const comp = fs.readdirSync(compFolder)

files.forEach((file) => {
    const selectedImage = comp.filter(e => file.includes(e.split(".")[0]))[0]
    if(selectedImage){
        composeImage(path.join(inputFolder, file), path.join(compFolder, selectedImage), path.join(outputFolder, file))
    } else {
        console.log(file + " not processed")
    }
    
})

async function composeImage(inputImage, compImage, outputImage){
    const topImage = await sharp(compImage).toBuffer()
    const baseImage = await sharp(inputImage).toBuffer()
    const compositeImages = [{ input: baseImage, top: 0, left: 0 }, { input: topImage, top: 0, left: 0 }]

    await sharp({
        create: {
          width: 4320,
          height: 4320,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
    .composite(compositeImages)
    .webp(80)
    .toFile(outputImage)
    .then(console.log(`Saved to ${outputImage}`))
    .catch((e) => {
        console.log(e)
    })
}