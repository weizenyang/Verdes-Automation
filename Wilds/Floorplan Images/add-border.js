const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration
const outputResolution = { width: 4096, height: 4096 }; // Desired output resolution
const borderSize = 450; // Border size
const borderColor = '#B5B1A5'; // Hex color for the border
const webpQuality = 80; // Quality of the output WebP
const inputDirectory = 'input';
const outputDirectory = 'output';

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
        const resizedImageBuffer = await image
            .resize(resizedWidth, resizedHeight)
            .webp({ quality })
            .toBuffer();

        // Create a correctly colored border background
        const borderBuffer = await sharp({
            create: {
                width: resolution.width,
                height: resolution.height,
                channels: 3, // 3 channels for RGB (no transparency)
                background: color, // Correctly applies the HEX border color
            },
        }).webp({ quality }).toBuffer();

        // Composite the resized image onto the colored border buffer
        await sharp(borderBuffer)
            .composite([{ input: resizedImageBuffer, top: border, left: border }])
            .webp({ quality })
            .toFile(outputPath);

        console.log('✅ Image processed:', outputPath);
    } catch (err) {
        console.error('❌ Error processing image:', err);
    }
}

async function processDirectory(inputDir, outputDir, resolution, border, color, quality) {
    fs.readdir(inputDir, (err, files) => {
        if (err) {
            console.error('❌ Error reading directory:', err);
            return;
        }

        // Process each file in the directory
        files.forEach((file) => {
            const inputPath = path.join(inputDir, file);
            const outputPath = path.join(outputDir, 
                path.parse(file).name.toLowerCase().includes("mirror") ? 
                path.parse(file).name.toLowerCase().replace("b", "bf").replace("mirror", "") + '.webp' : 
                path.parse(file).name.toLowerCase() + '.webp'
            );

            // Ensure the file is an image by checking its extension
            const ext = path.extname(file).toLowerCase();
            if (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp') {
                console.log("📷 Image Found:", file);
                addBorderAndScale(inputPath, outputPath, resolution, border, color, quality);
            } else {
                console.log('⏩ Skipping non-image file:', file);
            }
        });
    });
}

// Ensure the output directory exists
if (!fs.existsSync(outputDirectory)){
    fs.mkdirSync(outputDirectory, { recursive: true });
}

// Run the function to process the directory
processDirectory(inputDirectory, outputDirectory, outputResolution, borderSize, borderColor, webpQuality);
