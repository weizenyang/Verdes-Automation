const { spawn } = require('child_process');

// Path to your Python reprojection script and equirectangular image.
const pythonScript = './reprojection-from-image.py';  // Update if your script is located elsewhere.
const imagePath = 'a_s_2b_a1_s1_0_PowderRoom_1.png';  // Replace with your image file path.

// Optional parameters for the reprojection script.
const outputPath = 'projected_mesh.obj';
const latSteps = '200';      // Vertical resolution (latitude steps).
const lonSteps = '400';      // Horizontal resolution (longitude steps).
const scale = '3.0';        // Scale factor for converting normalized depth to 3D distance.
const depthOutput = 'depth_map.png';  // Optional: save depth map image.
const pole_factor = '-1.0'

// Build the argument list for the Python script.
const args = [
  pythonScript,
  imagePath,
  '--output', outputPath,
  '--lat_steps', latSteps,
  '--lon_steps', lonSteps,
  '--scale', scale,
  '--depth_output', depthOutput,
  '--pole_factor', pole_factor
];

// Spawn the Python process using 'python3'
const pythonProcess = spawn('python3', args);

// Listen for standard output.
pythonProcess.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

// Listen for standard error.
pythonProcess.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

// Log when the process closes.
pythonProcess.on('close', (code) => {
  console.log(`Python process exited with code ${code}`);
});
