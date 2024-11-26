import sharp from "sharp";

const inputPath = "./input.png"; // Replace with your input image path
const outputPath = "./output.png"; // Replace with your desired output path

async function processImage() {
  try {
    console.log("Processing image...");
    await sharp(inputPath)
      .resize(800, 800) // Resize to 800x800
      .grayscale() // Convert to grayscale
      .toFile(outputPath); // Save the output
    console.log(`Image successfully processed and saved to: ${outputPath}`);
  } catch (error) {
    console.error("An error occurred while processing the image:", error);
  }
}

processImage();