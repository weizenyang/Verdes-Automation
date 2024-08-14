const sharp = require('sharp');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { DOMParser, XMLSerializer } = require('xmldom');
const { svgPathBbox } = require('svg-path-bbox');
const { parse, scale, stringify } = require('svg-path-tools');
const { log } = require('console');

// Directories
var imageDir = './Arthouse/floorplate';
var svgDir = './Arthouse/svg';
var outputDir = './Arthouse/floorplan';
var shapeOutputDir = path.join(outputDir, 'shape');

// Ensure the shape output directory exists
fs.mkdirSync(shapeOutputDir, { recursive: true });

// Function to filter out unnecessary tags and return only the SVG content
const filterSVGContent = (svgContent) => {
    svgContent = svgContent.replace(/<\?xml[^>]*\?>\s*/, '');

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');

    const unwantedTags = ['sodipodi:namedview', 'metadata', 'title', 'desc'];
    unwantedTags.forEach(tag => {
        const elements = doc.getElementsByTagName(tag);
        while (elements.length > 0) {
            elements[0].parentNode.removeChild(elements[0]);
        }
    });

    const svgElement = doc.getElementsByTagName('svg')[0];
    if (svgElement) {
        const unwantedAttributes = ['xmlns:inkscape', 'xmlns:sodipodi', 'inkscape:version', 'sodipodi:docname', 'id'];
        unwantedAttributes.forEach(attr => {
            svgElement.removeAttribute(attr);
        });
    }

    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
};

// Function to scale paths within the SVG
const scaleSVGPaths = (svgContent, inputWidth, inputHeight) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const paths = doc.getElementsByTagName('path');

    const svgElement = doc.getElementsByTagName('svg')[0];
    const viewBox = svgElement.getAttribute('viewBox');
    const vbDimensions = viewBox.split(' ');
    const scaleX = inputWidth / vbDimensions[2];
    const scaleY = inputHeight / vbDimensions[3];
    console.log(scaleX + " " + scaleY);

    Array.from(paths).forEach(path => {
        const d = path.getAttribute('d');
        if (d) {
            const parsed = parse(d);
            const scaled = scale(parsed, { scale: scaleX });
            const stringified = stringify(scaled);
            path.setAttribute('d', stringified);
        }
    });

    if (svgElement) {
        if (svgElement.hasAttribute('viewBox')) {
            const viewBox = svgElement.getAttribute('viewBox');
            if (viewBox) {
                const [minX, minY, width, height] = viewBox.split(' ').map(Number);
                svgElement.setAttribute('viewBox', `0 0 ${inputWidth} ${inputHeight}`);
            } else {
                const width = parseFloat(svgElement.getAttribute('width'));
                const height = parseFloat(svgElement.getAttribute('height'));
                svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
                console.log(`Failed to run ${svgElement}`);
            }
            console.log(svgElement.getAttribute('viewBox'));
    
            const widthAttr = svgElement.getAttribute('width');
            const heightAttr = svgElement.getAttribute('height');
            if (widthAttr && heightAttr) {
                svgElement.setAttribute('width', inputWidth);
                svgElement.setAttribute('height', inputHeight);
            }
        }
    }

    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
};

// Function to process each path in the SVG and create a separate image for each path
const processImageWithSVGPath = (imageFile, pathElement) => {
    const scaleX = imageFile.imageWidth / 2048;
    const scaleY = imageFile.imageHeight / 2048;

    const unitDataFromPath = pathElement.getAttribute('id');
    console.log("Processing: " + unitDataFromPath);

    const parser = new DOMParser();
    const doc = parser.parseFromString('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'image/svg+xml');
    const svgElement = doc.documentElement;

    const imagePath = path.join(imageDir, imageFile.image);
    const outputFilePath = path.join(outputDir, `${unitDataFromPath}.png`);
    const shapeFilePath = path.join(shapeOutputDir, `${unitDataFromPath}.png`);

    const newPathElement = pathElement.cloneNode(true);
    svgElement.appendChild(newPathElement);

    svgElement.setAttribute('viewBox', pathElement.ownerDocument.documentElement.getAttribute('viewBox'));
    svgElement.setAttribute('width', pathElement.ownerDocument.documentElement.getAttribute('width'));
    svgElement.setAttribute('height', pathElement.ownerDocument.documentElement.getAttribute('height'));
    console.log(pathElement.ownerDocument.documentElement.getAttribute('viewBox'));

    const d = newPathElement.getAttribute('d');
    console.log(d);
    const [minX, minY, maxX, maxY] = svgPathBbox(d);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const cropWidth = 1500;
    const cropHeight = 1500;
    const left = Math.max(0, centerX - cropWidth / 2);
    const top = Math.max(0, centerY - cropHeight / 2);

    svgElement.setAttribute('viewBox', `${left} ${top} ${cropWidth} ${cropHeight}`);
    svgElement.setAttribute('width', cropWidth);
    svgElement.setAttribute('height', cropHeight);

    const serializer = new XMLSerializer();
    const newSvgContent = serializer.serializeToString(svgElement);

    if (isNaN(left) || isNaN(top)) {
        console.error(`Invalid crop coordinates for path in ${imageFile.image}: left=${left}, top=${top}`);
        console.log(svgPathBbox(d));
        console.log(d);
        return;
    }

    const whiteBackground = { r: 255, g: 255, b: 255, alpha: 1 };
    const offWhiteBackground = { r: 200, g: 201, b: 200, alpha: 1 };

    sharp(imagePath, { limitInputPixels: false })
        .extract({ width: cropWidth, height: cropHeight, left: Math.round(left), top: Math.round(top) })
        .composite([{ input: Buffer.from(newSvgContent), blend: 'dest-in' }])
        .toFile(path.join(outputDir, `_temp/${unitDataFromPath}.png`))
        .then(() => {
            sharp({
                create: {
                    width: cropWidth,
                    height: cropHeight,
                    channels: 4,
                    background: offWhiteBackground
                }
            })
            .composite([{ input: path.join(outputDir, `_temp/${unitDataFromPath}.png`) }])
            .toFile(outputFilePath);

            

            sharp({
                create: {
                    width: cropWidth,
                    height: cropHeight,
                    channels: 4,
                    background: whiteBackground
                }
            })
            .composite([{ input: Buffer.from(newSvgContent), blend: 'over' }])
            .toFile(shapeFilePath);
        });
};

// Function to process image with corresponding SVG
const processImageWithSVG = (imageFile, svgFile) => {
    const imagePath = path.join(imageDir, imageFile);
    const svgPath = path.join(svgDir, svgFile);

    sharp(imagePath, { limitInputPixels: false }).metadata().then(metadata => {
        const imageWidth = metadata.width;
        const imageHeight = metadata.height;
        const imageWithMetadata = { image: imageFile, imageWidth: imageWidth, imageHeight: imageHeight };

        fs.readFile(svgPath, 'utf8', (err, svgData) => {
            if (err) {
                console.error(`Error reading SVG file (${svgFile}):`, err);
                return;
            }

            const scaledSvgData = scaleSVGPaths(svgData, imageWidth, imageHeight);
            const filteredSvgData = filterSVGContent(scaledSvgData);

            const parser = new DOMParser();
            const scaledDoc = parser.parseFromString(filteredSvgData, 'image/svg+xml');
            const paths = scaledDoc.getElementsByTagName('path');
            Array.from(paths).forEach((pathElement, index) => {
                processImageWithSVGPath(imageWithMetadata, pathElement);
            });
        });

    }).catch(err => {
        console.error(`Error reading image metadata (${imageFile}):`, err);
    });
};

function main() {
    // Read the images directory
    fs.readdir(imageDir, (err, imageFiles) => {
        if (err) {
            console.error('Error reading images directory:', err);
            return;
        }

        // Read the svgs directory
        fs.readdir(svgDir, (err, svgFiles) => {
            if (err) {
                console.error('Error reading SVGs directory:', err);
                return;
            }

            // Process each image with the corresponding SVG
            imageFiles.forEach(imageFile => {
                console.log(path.parse(imageFile).name);
                console.log(svgFiles);
                // Find the corresponding SVG file
                const svgFile = svgFiles.find(file => path.parse(imageFile).name.toLowerCase().includes(path.parse(file).name));
    
                if (svgFile) {
                    console.log(`Processing ${imageFile} with ${svgFile}`);
                    processImageWithSVG(imageFile, svgFile);
                } else {
                    console.log(`No matching SVG file found for image: ${imageFile}`);
                }
            });
        });
    });
}

main();

module.exports = { main };
