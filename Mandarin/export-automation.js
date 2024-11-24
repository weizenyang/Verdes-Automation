const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const scriptGroups = {
  createDimsVariations: {
    output: './create-dims-variations.exe',
    scripts: ['./ocr-editing.js'],
    main: './ocr-editing.js'
  },
  composeFloorplans: {
    output: './compose-floorplans.exe',
    scripts: ['./imageComposer2.js', './normalizeTypes.js', './unit-floorplan.js'],
    main: './compose-floorplans.js'
  },
  composeTowerFloorplates: {
    output: './compose-tower-floorplates.exe',
    scripts: ['./tower-floorplate.cjs'],
    main: './tower-floorplate.cjs'
  }
};

async function buildExes() {
  console.log('\n🔍 Starting build process...');
  
  // Install pkg locally instead of globally
  try {
    console.log('📦 Installing pkg locally...');
    execSync('npm install pkg@5.8.1', { stdio: 'inherit' });
    console.log('✅ pkg installed locally');
  } catch (error) {
    console.error('❌ Failed to install pkg:', error);
    process.exit(1);
  }

  // Use local pkg
  const pkgPath = path.join(process.cwd(), 'node_modules', '.bin', 'pkg');

  for (const [groupName, config] of Object.entries(scriptGroups)) {
    console.log(`\n📦 Building ${groupName}...`);
    
    try {
      // Try with node14 instead of node16
      const cmd = `"${pkgPath}" "${config.main}" --target node14-win-x64 --output "${config.output}"`;
      console.log('🔧 Executing:', cmd);
      
      execSync(cmd, { 
        stdio: 'inherit',
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10
      });
      
      if (fs.existsSync(config.output)) {
        console.log(`✅ Successfully built ${config.output}`);
      } else {
        throw new Error(`Build failed - exe not found`);
      }
    } catch (error) {
      console.error(`\n❌ Error building ${groupName}:`, error.message);
      
      // Try to get more error details
      console.log('\n📋 Contents of current directory:');
      try {
        const files = fs.readdirSync(process.cwd());
        console.log(files);
      } catch (e) {
        console.log('Could not read directory');
      }
    }
  }
}

buildExes().catch(error => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});