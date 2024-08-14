const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Define the path of the directory containing the images
const imageDir = './Arthouse/floorplan/Original backplates + balconies 2/DIMS';
const hashFilePath = path.join(imageDir, 'image_hashes.txt');

// Function to generate SHA-256 hash of a file
const generateFileHash = (filePath) => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (data) => {
            hash.update(data);
        });

        stream.on('end', () => {
            resolve(hash.digest('hex'));
        });

        stream.on('error', (err) => {
            reject(err);
        });
    });
};

// Function to get the list of files in a directory and generate their hashes
const hashImagesInDirectory = async (dirPath) => {
    try {
        const files = await fs.promises.readdir(dirPath);
        const imageFiles = files.filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file));

        const hashes = await Promise.all(imageFiles.map(async (file) => {
            const filePath = path.join(dirPath, file);
            const hash = await generateFileHash(filePath);
            return { file, hash };
        }));

        console.log('Image Hashes:', hashes);
        return hashes;
    } catch (error) {
        console.error('Error reading directory or generating hashes:', error);
    }
};

// Function to save the hashes to a text file
const saveHashesToFile = (hashes, filePath) => {
    const data = hashes.map(({ file, hash }) => `${file}: ${hash}`).join('\n');
    fs.writeFileSync(filePath, data, 'utf8');
    console.log(`Hashes saved to ${filePath}`);
};

// Run the function to hash images in the directory and save the hashes to a file
hashImagesInDirectory(imageDir)
    .then(hashes => {
        if (hashes) {
            saveHashesToFile(hashes, hashFilePath);
        }
    });
