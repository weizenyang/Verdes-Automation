const path = require('path')
const fs = require('fs')
const csv = require('fast-csv');

const inputPath = "./CSV"

const files = fs.readdirSync(inputPath)

files.forEach((e) => {
    // if(fs.lstatSync(path.join(inputPath, e)).isFile()){
        fs.copyFileSync(path.join(inputPath, e), path.join(inputPath, e.replace("s1", "s2")))
    // }
    

})