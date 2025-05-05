#!/usr/bin/env node
/**
 * update-svg-ids.js
 *
 * This CLI script recursively scans a directory and its subdirectories for SVG files,
 * inspects all id attributes of the form {item}_{item}_{item}, extracts the first item,
 * compares it to the last underscore-separated part of the SVG file’s basename,
 * and if they don’t match, replaces the id's first part with the filename’s reference part.
 *
 * Usage:
 *   node update-svg-ids.js [directory]
 * or:
 *   ./update-svg-ids.js [directory]
 */

const fs = require('fs');
const path = require('path');

// Root directory containing SVGs (default: current working directory)
const svgDir = process.argv[2] || process.cwd();

/**
 * Recursively gather all .svg file paths under a directory.
 * @param {string} dir - directory to scan
 * @returns {string[]} array of absolute file paths
 */
function getSvgFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getSvgFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.svg')) {
      results.push(fullPath);
    }
  }
  return results;
}

// Discover SVG files
const svgFiles = getSvgFiles(svgDir);
if (svgFiles.length === 0) {
  console.error(`No SVG files found in: ${svgDir}`);
  process.exit(1);
}

// Process each SVG file found
svgFiles.forEach(filePath => {
  const fileName = path.basename(filePath);
  console.log(`Processing: ${filePath}`);

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading file ${fileName}:`, err);
      return;
    }

    // Determine reference parts from filename
    const baseName = path.basename(fileName, '.svg');
    const baseParts = baseName.split('_');
    const referenceName = baseParts[baseParts.length - 2] || '';
    const referenceFloor = baseParts[baseParts.length - 1] || '';

    // Match id="x_y_z"
    const idRegex = /id="([^_\"]+)_([^_\"]+)_([^_\"]+)"/g;
    let modified = false;
    const updatedData = data.replace(idRegex, (match, p1, p2, p3) => {
      if (p1 !== referenceName || p2 !== referenceFloor) {
        const newId = `${referenceName}_${referenceFloor}_${p3}`;
        console.log(`File: ${fileName} | Changing id "${p1}_${p2}_${p3}" → "${newId}"`);
        modified = true;
        return `id="${newId}"`;
      }
      return match;
    });

    if (modified) {
      fs.writeFile(filePath, updatedData, 'utf8', err => {
        if (err) {
          console.error(`Error writing file ${fileName}:`, err);
        } else {
          console.log(`Updated file: ${filePath}`);
        }
      });
    } else {
      console.log(`No id changes needed for: ${fileName}`);
    }
  });
});
