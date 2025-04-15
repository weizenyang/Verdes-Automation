#!/usr/bin/env node
/**
 * update-svg-ids.js
 *
 * This CLI script goes into a directory of SVG files, inspects all id attributes
 * that have the format {item}_{item}_{item}, extracts the first item from the id,
 * compares it to the last underscore‑separated part of the SVG file’s basename,
 * and if they don’t match, replaces the id's first part with the filename’s last item.
 *
 * Usage:
 *   node update-svg-ids.js [directory]
 * or, if made executable:
 *   ./update-svg-ids.js [directory]
 */

const fs = require('fs');
const path = require('path');

// Get the directory from the command-line arguments; default to the current directory.
const svgDir = process.argv[2] || process.cwd();

fs.readdir(svgDir, (err, files) => {
  if (err) {
    console.error('Error reading directory:', err);
    process.exit(1);
  }

  // Filter SVG files
  const svgFiles = files.filter(file => file.toLowerCase().endsWith('.svg'));

  if (svgFiles.length === 0) {
    console.log("No SVG files found in", svgDir);
    return;
  }

  svgFiles.forEach(file => {
    const filePath = path.join(svgDir, file);

    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error(`Error reading file ${file}:`, err);
        return;
      }

      // Extract the basename (without extension) and get the last underscore-separated item.
      const baseName = path.basename(file, '.svg');
      const baseParts = baseName.split('_');
      const referenceName = baseParts[baseParts.length - 2];
      const referenceFloor = baseParts[baseParts.length - 1];

      // Regex to match id="item1_item2_item3" where items don't include underscores.
      const idRegex = /id="([^_"]+)_([^_"]+)_([^_"]+)"/g;

      // Replace matching id attributes if the first item is not the same as the reference item.
      const updatedData = data.replace(idRegex, (match, p1, p2, p3) => {
        
          console.log(`File: ${file} | Changing id "${p1}_${p2}_${p3}" to "${referenceName}_${referenceFloor}_${p3}"`);
          return `id="${referenceName}_${referenceFloor}_${p3}"`;
        
        return match;
      });

      fs.writeFile(filePath, updatedData, 'utf8', (err) => {
        if (err) {
          console.error(`Error writing file ${file}:`, err);
        } else {
          console.log(`Updated file: ${file}`);
        }
      });
    });
  });
});
