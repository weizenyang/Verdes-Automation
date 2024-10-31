const fs = require('fs')
const path = require('path')

const inputPath = "./input"

const files = fs.readdirSync(inputPath)

const toRemove = ["backplate_image_floorplan_v_p_", "Floorplan_"]

const toReplace = [
    { type:"canal", abbr: "a"},
    { type:"sidecanal", abbr: "b"},
    { type:"inland", abbr: "b"},
]

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

    if (renamed.some(e => e.includes("bn") && renamed.some(e => e.includes("p")))) {
        detectFlipped.push("nu");
    } else if(renamed.some(e => e.includes("bn"))){
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

    // Floorplan_6b_canal_00_p5_s1_nu

    const finalName = []
    if(configuration){
        finalName.push(configuration)
    }
    if(type){
        finalName.push(type)
    }
    if(floor.length > 0){
        finalName.push(floor[0])
    }
    if(furnishings.length > 0){
        finalName.push(furnishings[0])
    }
    if(style.length > 0){
        finalName.push(style[0])
    }
    if(flipped.length > 0){
        finalName.push(flipped[0])
    }

    console.log(`Floorplan_${finalName.join("_")}.${ext}`)
    fs.renameSync(path.join(inputPath, e), path.join(inputPath,`Floorplan_${finalName.join("_")}.${ext}`))

})