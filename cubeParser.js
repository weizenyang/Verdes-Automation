const fs = require('fs');

function parseCubeLUT(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  const lut = [];
  let size = 0;

  for (const line of lines) {
    const cleanLine = line.trim();
    if (cleanLine.startsWith('LUT_3D_SIZE')) {
      size = parseInt(cleanLine.split(' ')[1], 10);
    } else if (cleanLine && !cleanLine.startsWith('#') && !cleanLine.startsWith('TITLE') && !cleanLine.startsWith('DOMAIN')) {
      const [r, g, b] = cleanLine.split(' ').map(Number);
      lut.push({ r, g, b });
    }
  }

  return { lut, size };
}

module.exports = parseCubeLUT;