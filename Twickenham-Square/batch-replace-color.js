const { replaceColorWithTolerance } = require('./replace-color.js');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const cliProgress = require('cli-progress');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

const inputDirPath = "./Floorplan Images/with border"
const outputDirPath = "./Floorplan Images/color-replace"
if(!fs.existsSync(outputDirPath)){
    fs.mkdirSync(outputDirPath)
}

const files = fs.readdirSync(inputDirPath)
console.log(files)
files.forEach(element => {
    
    const inputPath = path.join(inputDirPath, element)
    const outputPath = path.join(outputDirPath, element)
    replaceColorWithTolerance(inputPath, outputPath, [169, 153, 136], [255, 255, 255], 5)
});