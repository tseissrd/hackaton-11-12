// takes
// 1: path to the data folder
// 2: path to the output json
// 3: interval (ms)

const SequentialInputGenerator = require('./SequentialInputGenerator');
const timeSeriesEvaluator = require('./timeSeriesEvaluator');

const VALUES_TO_SKIP_AFTER_THE_HANDLE_POSITION_CHANGE = 3;

async function runSimulation(sourceDataFolder, outputFile, interval) {
  const generator = new SequentialInputGenerator(sourceDataFolder, {verbose: true});
  let lastPosition = null;
  let measurementsMadeSinceLastSwitch = 0;

  while (true) {
    const values = await generator.next();

    if (values.position !== lastPosition) {
      console.log('power handle position is changed');
      lastPosition = values.position;
      measurementsMadeSinceLastSwitch = 1;
    } else
      measurementsMadeSinceLastSwitch += 1;

    if (measurementsMadeSinceLastSwitch <= VALUES_TO_SKIP_AFTER_THE_HANDLE_POSITION_CHANGE) {
      console.log('skipped a measurement due to recent power handle position change');
      continue;
    }

    const power = values.current * values.voltage;

    if (power <= 50000) {
      console.log('skipped a measurement due to low running power (<50K)');
      continue;
    }

    timeSeriesEvaluator(outputFile, values.position, power, values.timestamp)
    console.log(`appended ${power} to ${values.position} at ${values.timestamp}`);
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

if ((!process.argv[4]))
  return 1;

runSimulation(process.argv[2], process.argv[3], Number(process.argv[4]));
