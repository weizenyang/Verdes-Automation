const sharp = require('sharp');
const math = require('mathjs');
const fs = require('fs');
const path = require('path')

function eulerToRotationMatrix(roll, pitch, yaw) {
    const rollRad = roll * Math.PI / 180;
    const pitchRad = pitch * Math.PI / 180;
    const yawRad = yaw * Math.PI / 180;

    const R_x = math.matrix([
        [1, 0, 0],
        [0, Math.cos(rollRad), -Math.sin(rollRad)],
        [0, Math.sin(rollRad), Math.cos(rollRad)]
    ]);

    const R_y = math.matrix([
        [Math.cos(pitchRad), 0, Math.sin(pitchRad)],
        [0, 1, 0],
        [-Math.sin(pitchRad), 0, Math.cos(pitchRad)]
    ]);

    const R_z = math.matrix([
        [Math.cos(yawRad), -Math.sin(yawRad), 0],
        [Math.sin(yawRad), Math.cos(yawRad), 0],
        [0, 0, 1]
    ]);

    // R = Rz * Ry * Rx
    return math.multiply(R_z, math.multiply(R_y, R_x));
}

function rotatePixel(pixel, rotMat, width, height) {
    const theta = Math.PI * pixel[0] / height;
    const phi = 2 * Math.PI * pixel[1] / width;

    const vecCartesian = [
        -Math.sin(theta) * Math.cos(phi),
        Math.sin(theta) * Math.sin(phi),
        Math.cos(theta)
    ];

    const vecRotated = math.multiply(rotMat, vecCartesian).valueOf();

    const newTheta = Math.acos(vecRotated[2]);
    let newPhi = Math.atan2(vecRotated[1], -vecRotated[0]);
    if (newPhi < 0) newPhi += 2 * Math.PI;

    const newPixel = [
        Math.floor(height * newTheta / Math.PI),
        Math.floor(width * newPhi / (2 * Math.PI))
    ];

    return newPixel;
}
// const degrees = yaw

async function rotateEquirectangularImage(inputPath, outputPath, roll, pitch, yaw) {
    try {

      if(!fs.existsSync(path.dirname(outputPath))){
          fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      }

      // Open the image and retrieve its metadata
      const inputImage1 = sharp(inputPath);
      const inputImage2 = sharp(inputPath);
      const { width, height } = await inputImage1.metadata();
      const degrees = yaw
  
      let pixelsToShift = Math.round((degrees / 360) * width)

      // Normalize pixelsToShift to be within the image width range
      pixelsToShift = ((pixelsToShift % width) + width) % width;
  
      // Calculate widths for the left and right segments
      const leftWidth = width - pixelsToShift;
      const rightWidth = pixelsToShift;
  
      // Validate extraction dimensions
      if (leftWidth <= 0 || rightWidth <= 0) {
        throw new Error(`Invalid extraction dimensions: leftWidth=${leftWidth}, rightWidth=${rightWidth}`);
      }
  
      // Extract the left and right parts of the image safely
      const leftPart = await inputImage1.extract({ left: 0, top: 0, width: leftWidth, height }).toBuffer();
      console.log(leftWidth + " " + height)
      const rightPart = await inputImage2.extract({ left: leftWidth, top: 0, width: rightWidth, height }).toBuffer();
  
      const rotatedImage = await sharp({
        create: {
          width: width,
          height: height,
          channels: 3,
          background: { r: 0, g: 0, b: 0 }
        }
      })
        .composite([
          { input: rightPart, left: 0, top: 0 },        // Place the right part at the left side
          { input: leftPart, left: rightWidth, top: 0 } // Place the left part at the right side
        ])
        .jpeg({ quality: 90 }) // Save as JPG with the desired quality
        .toFile(outputPath);
  
      console.log(`Equirectangular image rotated by ${degrees} degrees and saved to ${outputPath}`);
    } catch (error) {
      console.error('Error rotating the image:', error.message + " " + yaw);
    }
  }
    

// // Example usage
// rotateEquirectangularImage('360 test.jpg', '360 test - rotated.jpg', 0, 0, 90)
//     .then(() => console.log('Rotation complete'))
//     .catch(err => console.error('Error rotating image:', err));

module.exports = {rotateEquirectangularImage}