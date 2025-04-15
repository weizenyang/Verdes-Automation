#!/usr/bin/env node
/**
 * data_unit_id_crosscheck.js
 *
 * This CLI script processes SVG files in a specified directory.
 *
 * For each file:
 *   1. It loads the file as XML.
 *   2. It recursively examines each element that has both an "id" and a "data-unit" attribute.
 *   3. For any element whose id starts with the user‐provided detection substring, it:
 *       - Splits the id by underscores, expecting three parts.
 *       - Normalizes the first part to lowercase.
 *       - Pads the second and third parts to two digits.
 *       - Extracts the last two characters from that element’s data-unit attribute.
 *       - If the third part (item3) does not match the final two characters from data-unit,
 *         it updates item3 with that value.
 *   4. The file is then written back with any changes.
 *
 * Usage:
 *   node data_unit_id_crosscheck.js [directory] [detectionSubstring]
 * Example:
 *   node data_unit_id_crosscheck.js "./svgs" aloe
 */

const fs = require('fs');
const path = require('path');
const { DOMParser, XMLSerializer } = require('xmldom');

// Get directory and detection substring from command-line arguments.
const svgDir = process.argv[2] || process.cwd();
const detectSubstr = process.argv[3] || "detectme";

fs.readdir(svgDir, (err, files) => {
  if (err) {
    console.error("Error reading directory:", err);
    process.exit(1);
  }

  // Filter for files ending in .svg (case-insensitive)
  const svgFiles = files.filter(file => file.toLowerCase().endsWith('.svg'));
  if (svgFiles.length === 0) {
    console.log("No SVG files found in", svgDir);
    return;
  }

  svgFiles.forEach(file => {
    const filePath = path.join(svgDir, file);
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error(`Error reading file "${file}":`, err);
        return;
      }

      const parser = new DOMParser();
      let doc;
      try {
        doc = parser.parseFromString(data, 'application/xml');
      } catch (e) {
        console.error("Parse error for file", file, e);
        return;
      }

      let modified = false;

      // Recursively process each element node.
      function processNode(node) {
        if (node.nodeType === 1) { // ELEMENT_NODE
          const idVal = node.getAttribute("id");
          const dataUnitVal = node.getAttribute("data-unit");
          if (idVal && dataUnitVal && idVal.startsWith(detectSubstr)) {
            // Split the id into parts – expecting exactly 3 parts.
            const parts = idVal.split('_');
            if (parts.length === 3) {
              let [p1, p2, p3] = parts;
              // Normalize first part to lowercase.
              p1 = p1.toLowerCase();
              // Ensure p2 and p3 are exactly 2 digits (pad with a leading zero if needed)
              p2 = p2.padStart(2, '0');
              p3 = p3.padStart(2, '0');

              // Extract the final 2 characters from this element's data-unit attribute.
              const expected = dataUnitVal.slice(-2);
              let newId = `${p1}_${p2}_${p3}`;
              if (p3 !== expected) {
                newId = `${p1}_${p2}_${expected}`;
                console.log(`File "${file}": updating id from "${idVal}" to "${newId}"`);
              } else if (idVal !== `${p1}_${p2}_${p3}`) {
                console.log(`File "${file}": normalizing id from "${idVal}" to "${p1}_${p2}_${p3}"`);
              }
              if (newId !== idVal) {
                node.setAttribute("id", newId);
                modified = true;
              }
            }
          }
          // Process child nodes
          for (let i = 0; i < node.childNodes.length; i++) {
            processNode(node.childNodes[i]);
          }
        }
      }

      processNode(doc.documentElement);

      if (modified) {
        const serializer = new XMLSerializer();
        const updatedXml = serializer.serializeToString(doc);
        fs.writeFile(filePath, updatedXml, 'utf8', err => {
          if (err) {
            console.error(`Error writing file "${file}":`, err);
          } else {
            console.log(`Processed file "${file}"`);
          }
        });
      } else {
        console.log(`No changes for file "${file}"`);
      }
    });
  });
});
