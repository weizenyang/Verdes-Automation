const imageComposer2 = require('./imageComposer2.js');
const normalizeTypes = require('./normalizeTypes.js');
const unitFloorplan = require('./unit-floorplan.js');

async function main() {
    try{
        await imageComposer2()
        await normalizeTypes()
        await unitFloorplan()
        console.log("Tasks completed sucessfully!")
    } catch (e) {
        console.log("Error during execution!")
    }

//   const command = process.argv[2];
  
//   switch(command) {
//     case 'users':
//       await userManagement.execute();
//       break;
//     case 'config':
//       await systemConfig.execute();
//       break;
//     case 'logs':
//       await logging.execute();
//       break;
//     default:
//       console.log('Available commands: users, config, logs');
//   }
}

main();