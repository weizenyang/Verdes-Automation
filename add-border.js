const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration
// const inputDirectory = './Arthouse/floorplan/Segmented - distinct/POLISHED/S2/DIMS';
// const outputDirectory = './Arthouse/floorplan/Segmented - distinct/POLISHED/S2/DIMS - Scaled';
// const inputDirectory = './Arthouse/floorplan/Segmented - distinct/POLISHED/S1/DIMS';
// const outputDirectory = './Arthouse/floorplan/Segmented - distinct/POLISHED/S1/DIMS - Scaled';
// const inputDirectory = './Arthouse/floorplan/Unit matched types/NEW/S2 240812 Flipped';
// const outputDirectory = './Arthouse/floorplan/Unit matched types/NEW/S2 240812 Flipped/240812 Scaled - S2';
// const inputDirectory = './Arthouse/floorplan/Unit matched types/NEW/S1 240812 Flipped';
// const outputDirectory = './Arthouse/floorplan/Unit matched types/NEW/S1 240812 Flipped/240812 Scaled - S1';
// const inputDirectory = './Arthouse/floorplan/Segmented - distinct/POLISHED/S1 240806/DIMS 180';
// const outputDirectory = './Arthouse/floorplan/Segmented - distinct/POLISHED/S1 240806/DIMS 180/Scaled';
// const inputDirectory = './Arthouse/floorplan/Segmented - distinct/POLISHED/S2 240806/DIMS 180';
// const outputDirectory = './Arthouse/floorplan/Segmented - distinct/POLISHED/S2 240806/DIMS 180/Scaled';
const outputResolution = { width: 4320, height: 4320 }; // Desired output resolution
const borderSize = 250; // Size of the border
const borderColor = { r: 168, g: 163, b: 155, alpha: 1 }; // Border color
const jpegQuality = 100; // Quality of the output JPG

async function addBorderAndScale(inputPath, outputPath, resolution, border, color, quality) {
    try {

        // Read the input image
        const image = sharp(inputPath);

        // Get metadata of the image to determine the original size
        const metadata = await image.metadata();
        
        // Calculate the scale factor to fit the image within the desired resolution
        const scaleFactor = Math.min(
            (resolution.width - 2 * border) / metadata.width,
            (resolution.height - 2 * border) / metadata.height
        );

        const resizedWidth = Math.round(metadata.width * scaleFactor);
        const resizedHeight = Math.round(metadata.height * scaleFactor);

        // Resize the image
        const resizedImage = image.resize(resizedWidth, resizedHeight);

        // Create a buffer with the border
        const borderBuffer = await sharp({
            create: {
                width: resolution.width,
                height: resolution.height,
                channels: 4,
                background: color,
            },
        }).jpeg({ quality }).toBuffer();

        // Composite the resized image onto the border buffer
        await sharp(borderBuffer)
            .composite([{ input: await resizedImage.png().toBuffer(), top: border, left: border }])
            .webp({ quality: 80 })
            .toFile(outputPath);

        console.log('Image processed:', outputPath);
    } catch (err) {
        console.error('Error processing image:', err);
    }
}

async function processDirectory(inputDir, outputDir, resolution, border, color, quality) {
    fs.readdir(inputDir, (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            return;
        }

        // Process each file in the directory
        files.forEach((file) => {

            // if(file.split("-").join("").includes("100104")){
                const inputPath = path.join(inputDir, file);
                const outputPath = path.join(outputDir, 
                    path.parse(file).name.toLowerCase().includes("mirror") ? 
                    path.parse(file).name.toLowerCase().replace("b", "bf").replace("mirror", "") + '.jpg' : 
                    path.parse(file).name.toLowerCase()
                 + '.webp');
    
                // Ensure the file is an image by checking its extension
                const ext = path.extname(file).toLowerCase();
                if (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp') {
                    console.log("Image Found")
                    addBorderAndScale(inputPath, outputPath, resolution, border, color, quality);
                } else {
                    console.log('Skipping non-image file:', file);
                }
            // }

        });
    });
}

// Ensure the output directory exists
if (!fs.existsSync(outputDirectory)){
    fs.mkdirSync(outputDirectory, { recursive: true });
}

// Run the function to process the directory
processDirectory(inputDirectory, outputDirectory, outputResolution, borderSize, borderColor, jpegQuality);