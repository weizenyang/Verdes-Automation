const { spawn } = require('child_process');

// Path to your Python script and equirectangular image
const pythonScript = './mesh-from-images.py'; // Adjust if needed
const imagePath = 'a_s_2b_a1_s1_0_PowderRoom_1.png'; // Update with your image path
const outputPath = 'displaced_sphere.obj'; // Desired output OBJ file

// Optional parameters: base radius, latitude steps, longitude steps, displacement strength
const radius = '1.0';
const latSteps = '50';
const lonSteps = '50';
const strength = '-0.5';
const depth_output = 'depth.png';
const hole_threshold = '0.3';
const pole_factor = '-1.0'

// Build the argument array for the Python script
const args = [
  pythonScript,
  imagePath,
  '--output', outputPath,
  '--radius', radius,
  '--lat_steps', latSteps,
  '--lon_steps', lonSteps,
  '--strength', strength,
  '--depth_output', depth_output,
  '--hole_threshold', hole_threshold,
  '--pole_factor', pole_factor
];

// Spawn the Python process
const pythonProcess = spawn('python3', args);

// Log stdout from the Python script
pythonProcess.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

// Log stderr from the Python script
pythonProcess.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

// Log when the Python process exits
pythonProcess.on('close', (code) => {
  console.log(`Python process exited with code ${code}`);
});