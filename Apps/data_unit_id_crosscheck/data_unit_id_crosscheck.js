#!/usr/bin/env node
/**
 * data_unit_id_crosscheck.js
 *
 * This CLI script recursively processes SVG files in a specified directory.
 *
 * For each file:
 *   1. It loads the file as XML.
 *   2. It recursively examines each element that has both an "id" and a "data-unit" attribute.
 *   3. For any element whose id starts with the user‑provided detection substring (or all elements if none provided), it:
 *       - Splits the id by underscores, expecting three parts.
 *       - Normalizes the first part to lowercase.
 *       - Pads the second part to two digits if it's purely numeric.
 *       - Pads the third part to two digits.
 *       - Extracts the last two characters from that element’s data-unit attribute.
 *       - If the third part does not match those two characters, it updates the third part to match.
 *   4. The file is then written back with any changes.
 *
 * Usage:
 *   node data_unit_id_crosscheck.js [directory] [detectionSubstring]
 * Example:
 *   node data_unit_id_crosscheck.js "./svgs" aloe
 *   node data_unit_id_crosscheck.js "./svgs"      # processes all id+data-unit elements
 */

const fs = require('fs');
const path = require('path');
const { DOMParser, XMLSerializer } = require('xmldom');

// Get directory and optional detection substring from command-line arguments.
const svgDir       = process.argv[2] || process.cwd();
// If omitted, detectSubstr === '' → process all elements with both id+data-unit
const detectSubstr = process.argv[3] || '';

/**
 * Recursively collect all .svg files in a directory.
 * @param {string} dir
 * @returns {string[]} Array of full file paths
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

const svgFiles = getSvgFiles(svgDir);
if (svgFiles.length === 0) {
  console.log(`No SVG files found under directory: ${svgDir}`);
  process.exit(0);
}

svgFiles.forEach(filePath => {
  const data = fs.readFileSync(filePath, 'utf8');
  const parser = new DOMParser();
  let doc;
  try {
    doc = parser.parseFromString(data, 'application/xml');
  } catch (e) {
    console.error(`Parse error for file ${filePath}:`, e);
    return;
  }

  let modified = false;
  
  function processNode(node) {
    if (node.nodeType === 1) { // ELEMENT_NODE
      const idVal       = node.getAttribute('id');
      const dataUnitVal = node.getAttribute('data-unit');

      // Only proceed if both attributes exist and either no filter or the id matches it
      if (
        idVal &&
        dataUnitVal &&
        (
          detectSubstr === '' ||
          idVal.startsWith(detectSubstr)
        )
      ) {
        const parts = idVal.split('_');
        if (parts.length === 3) {
          let [p1, p2, p3] = parts;
          // Normalize first part
          p1 = p1.toLowerCase();
          // Pad second part only if it is purely numeric
          if (/^\d+$/.test(p2)) {
            p2 = p2.padStart(2, '0');
          }
          // Always pad third part
          p3 = p3.padStart(2, '0');

          const expected = dataUnitVal.slice(-2);
          let newId = `${p1}_${p2}_${p3}`;

          if (p3 !== expected) {
            // Replace third part with expected suffix
            newId = `${p1}_${p2}_${expected}`;
            console.log(`File ${filePath}: updating id from ${idVal} to ${newId}`);
          } else if (idVal !== newId) {
            // Only normalization occurred
            console.log(`File ${filePath}: normalizing id from ${idVal} to ${newId}`);
          }

          if (newId !== idVal) {
            node.setAttribute('id', newId);
            modified = true;
          }
        }
      }

      // Recurse into children
      for (let i = 0; i < node.childNodes.length; i++) {
        processNode(node.childNodes[i]);
      }
    }
  }

  processNode(doc.documentElement);

  if (modified) {
    const serializer = new XMLSerializer();
    const updatedXml = serializer.serializeToString(doc);
    fs.writeFileSync(filePath, updatedXml, 'utf8');
    console.log(`Processed file: ${filePath}`);
  } else {
    console.log(`No changes for file: ${filePath}`);
  }
});
