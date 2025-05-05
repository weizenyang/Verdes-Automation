const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const svgpath = require('svgpath');

// ---------- CONFIGURATION ----------
const INPUT_DIR = "./SVGs/input";    // Directory containing SVG files to process
const OUTPUT_DIR = "./SVGs/output";  // Directory to write processed SVG files

// Global transformation variables:
const ROTATE_ANGLE = 0;         // Set to 0, 90, 180, or 270 (degrees)
const FLIP_HORIZONTALLY = true;  // Set to true to flip horizontally, false otherwise

// ---------- Helper: Flatten Rotation on a <rect> ----------
// If a <rect> has a transform attribute with a rotate(), apply the rotation to its coordinates
// and remove the transform attribute.
function flattenRotationForRect(rect) {
  if (!rect.$ || !rect.$.transform) return;
  const transform = rect.$.transform;
  const rotateMatch = transform.match(/rotate\(([^)]+)\)/);
  if (!rotateMatch) return;

  // Parse rotation parameters: angle[, cx, cy]
  const params = rotateMatch[1].split(',').map(s => parseFloat(s.trim()));
  const angle = params[0];
  let cx, cy;
  if (params.length === 3) {
    cx = params[1];
    cy = params[2];
  }
  
  const x = parseFloat(rect.$.x) || 0;
  const y = parseFloat(rect.$.y) || 0;
  const width = parseFloat(rect.$.width) || 0;
  const height = parseFloat(rect.$.height) || 0;
  
  if (cx === undefined || cy === undefined) {
    cx = x + width / 2;
    cy = y + height / 2;
  }
  
  // Define the four corners.
  const corners = [
    { x: x,         y: y },
    { x: x + width, y: y },
    { x: x,         y: y + height },
    { x: x + width, y: y + height }
  ];
  
  const rad = angle * Math.PI / 180;
  const rotatePoint = (px, py) => {
    const tx = px - cx;
    const ty = py - cy;
    const rx = tx * Math.cos(rad) - ty * Math.sin(rad);
    const ry = tx * Math.sin(rad) + ty * Math.cos(rad);
    return { x: rx + cx, y: ry + cy };
  };
  
  const rotatedCorners = corners.map(pt => rotatePoint(pt.x, pt.y));
  
  const newX = Math.min(...rotatedCorners.map(p => p.x));
  const newY = Math.min(...rotatedCorners.map(p => p.y));
  const newWidth = Math.max(...rotatedCorners.map(p => p.x)) - newX;
  const newHeight = Math.max(...rotatedCorners.map(p => p.y)) - newY;
  
  rect.$.x = newX.toString();
  rect.$.y = newY.toString();
  rect.$.width = newWidth.toString();
  rect.$.height = newHeight.toString();
  delete rect.$.transform;
}

// ---------- Helper: Coordinate Transformation for Rects/Points ----------
// This function mimics the global transformation applied to rect elements.
// It takes coordinates (with an optional width/height) and returns transformed values.
function transformRectCoordinates(x, y, width, height, svgWidth, svgHeight, rotateAngle, flip) {
  if (flip) {
    x = svgWidth - x - width;
  }
  let newX, newY, newWidth, newHeight;
  switch (rotateAngle) {
    case 90:
      newX = y;
      newY = svgWidth - x - width;
      newWidth = height;
      newHeight = width;
      break;
    case 180:
      newX = svgWidth - x - width;
      newY = svgHeight - y - height;
      newWidth = width;
      newHeight = height;
      break;
    case 270:
      newX = svgHeight - y - height;
      newY = x;
      newWidth = height;
      newHeight = width;
      break;
    default:
      newX = x;
      newY = y;
      newWidth = width;
      newHeight = height;
      break;
  }
  return { x: newX, y: newY, width: newWidth, height: newHeight };
}

// For a point, treat it as a rect with width=0 and height=0.
function transformPoint(x, y, svgWidth, svgHeight, rotateAngle, flip) {
  return transformRectCoordinates(x, y, 0, 0, svgWidth, svgHeight, rotateAngle, flip);
}

// ---------- Helper: Compute an Affine Transformation Matrix ----------
// Returns a 6-element matrix [a, b, c, d, e, f] for svgpath, so that for a point (x,y):
// newX = a*x + b*y + e, newY = c*x + d*y + f.
// The matrix is chosen to mimic the behavior of transformRectCoordinates on a point.
function getTransformationMatrix(rotateAngle, flip, svgWidth, svgHeight) {
  let matrix;
  switch (rotateAngle) {
    case 0:
      if (flip) {
        matrix = [-1, 0, 0, 1, svgWidth, 0];  // (x,y) -> (svgWidth - x, y)
      } else {
        matrix = [1, 0, 0, 1, 0, 0];
      }
      break;
    case 90:
      if (flip) {
        // For a point: first flip: (x,y) -> (svgWidth - x, y), then 90°: (y, x)
        matrix = [0, 1, 1, 0, 0, 0];  // (x,y) -> (y, x)
      } else {
        // (x,y) -> (y, svgWidth - x)
        matrix = [0, 1, -1, 0, 0, svgWidth];
      }
      break;
    case 180:
      if (flip) {
        // (x,y) -> (x, svgHeight - y)
        matrix = [1, 0, 0, -1, 0, svgHeight];
      } else {
        // (x,y) -> (svgWidth - x, svgHeight - y)
        matrix = [-1, 0, 0, -1, svgWidth, svgHeight];
      }
      break;
    case 270:
      if (flip) {
        // (x,y) -> (svgHeight - y, svgWidth - x)
        matrix = [0, -1, -1, 0, svgHeight, svgWidth];
      } else {
        // (x,y) -> (svgHeight - y, x)
        matrix = [0, -1, 1, 0, svgHeight, 0];
      }
      break;
    default:
      matrix = [1, 0, 0, 1, 0, 0];
  }
  return matrix;
}

// Uses svgpath to transform a path's "d" attribute.
function transformPathD(d, svgWidth, svgHeight, rotateAngle, flip) {
  const matrix = getTransformationMatrix(rotateAngle, flip, svgWidth, svgHeight);
  return svgpath(d).matrix(matrix).toString();
}

// ---------- Helper: Global Transformation on SVG Elements ----------
// Applies a global transformation (rotation and optional horizontal flip) to <rect> and <path> elements.
// Assumes the root <svg> element has width and height attributes.
function applyGlobalTransform(svgObj, rotateAngle, flip) {
  if (!svgObj.svg || !svgObj.svg.$) {
    console.warn("SVG root attributes not found.");
    return;
  }
  // Get original dimensions from the root element.
  let svgWidth = parseFloat(svgObj.svg.$.width);
  let svgHeight = parseFloat(svgObj.svg.$.height);

  // If rotating by 90 or 270, swap the dimensions in the root element.
  if (rotateAngle === 90 || rotateAngle === 270) {
    svgObj.svg.$.width = svgHeight.toString();
    svgObj.svg.$.height = svgWidth.toString();
  }

  // Recursive function to transform elements.
  function transformElements(obj) {
    if (typeof obj !== 'object' || obj === null) return;
    for (const key in obj) {
      if (Array.isArray(obj[key])) {
        if (key === 'rect') {
          obj[key].forEach(rect => {
            if (rect.$) {
              const origX = parseFloat(rect.$.x) || 0;
              const origY = parseFloat(rect.$.y) || 0;
              const origWidth = parseFloat(rect.$.width) || 0;
              const origHeight = parseFloat(rect.$.height) || 0;
              const transformed = transformRectCoordinates(origX, origY, origWidth, origHeight, svgWidth, svgHeight, rotateAngle, flip);
              console.log(`Rect before: x=${origX}, y=${origY}, w=${origWidth}, h=${origHeight}`);
              console.log(`Rect after : x=${transformed.x}, y=${transformed.y}, w=${transformed.width}, h=${transformed.height}`);
              rect.$.x = transformed.x.toString();
              rect.$.y = transformed.y.toString();
              rect.$.width = transformed.width.toString();
              rect.$.height = transformed.height.toString();
            }
          });
        } else if (key === 'path') {
          obj[key].forEach(pathElem => {
            if (pathElem.$ && pathElem.$.d) {
              let d = pathElem.$.d;
              // If a transform attribute exists on the path, flatten it first.
              if (pathElem.$.transform) {
                d = svgpath(d).transform(pathElem.$.transform).toString();
                delete pathElem.$.transform;
              }
              // Apply the global transformation to the path's "d" attribute.
              d = transformPathD(d, svgWidth, svgHeight, rotateAngle, flip);
              console.log(`Path transformed (first 50 chars): ${d.substring(0,50)}...`);
              pathElem.$.d = d;
            }
          });
        }
        obj[key].forEach(item => transformElements(item));
      } else if (typeof obj[key] === 'object') {
        transformElements(obj[key]);
      }
    }
  }
  transformElements(svgObj);
}

// ---------- Helper: Process a Single SVG File ----------
function processSvgFile(inputFilePath, outputFilePath) {
  fs.readFile(inputFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading SVG "${inputFilePath}":`, err);
      return;
    }
    xml2js.parseString(data, (err, result) => {
      if (err) {
        console.error(`Error parsing SVG XML for "${inputFilePath}":`, err);
        return;
      }
      
      // First, flatten any per-element rotation transforms on <rect> elements.
      function traverseSvg(obj) {
        if (typeof obj !== 'object' || obj === null) return;
        for (const key in obj) {
          if (Array.isArray(obj[key])) {
            if (key === 'rect') {
              obj[key].forEach(rect => flattenRotationForRect(rect));
            }
            obj[key].forEach(item => traverseSvg(item));
          } else if (typeof obj[key] === 'object') {
            traverseSvg(obj[key]);
          }
        }
      }
      traverseSvg(result);
      
      // Then, apply the global transformation (for both <rect> and <path> elements).
      applyGlobalTransform(result, ROTATE_ANGLE, FLIP_HORIZONTALLY);
      
      const builder = new xml2js.Builder();
      const newSVG = builder.buildObject(result);
      
      fs.writeFile(outputFilePath, newSVG, (err) => {
        if (err) {
          console.error(`Error writing output SVG "${outputFilePath}":`, err);
        } else {
          console.log(`Processed and saved: ${outputFilePath}`);
        }
      });
    });
  });
}

// ---------- Main Script: Process a Directory of SVGs ----------
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

fs.readdir(INPUT_DIR, (err, files) => {
  if (err) {
    console.error("Error reading input directory:", err);
    return;
  }
  
  files.forEach(file => {
    if (path.extname(file).toLowerCase() === '.svg') {
      const inputFilePath = path.join(INPUT_DIR, file);
      const outputFilePath = path.join(OUTPUT_DIR, file);
      console.log(`\nProcessing ${file}...`);
      processSvgFile(inputFilePath, outputFilePath);
    }
  });
});
