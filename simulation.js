// takes
// 1: path to the data folder
// 2: path to the output json
// 3: interval (ms)

module.exports = runSimulation;

const SequentialInputGenerator = require('./SequentialInputGenerator');
const timeSeriesEvaluator = require('./timeSeriesEvaluator');
const fs = require('fs');
const path = require('path');

const expectedPower = require('./commonData.json').expectedOutput;
const DATA_EXPIRES_AFTER = require('./commonData.json').dataExpiresAfter;
const handlePositions = require('./commonData.json').handlePositions;
const cumulativeData = require('./cumulativePowerOutputData.json');

const VALUES_TO_SKIP_AFTER_THE_HANDLE_POSITION_CHANGE = 3;

async function runSimulation(sourceDataFolder, sourceFile, outputFile, time, resumeFrom = 0) {
  // shortcut for initialization
  if (time === 0) {
    timeSeriesEvaluator.generateMeanOutput(outputFile, resumeFrom + time);
    const signals = generateSignals(outputFile, expectedPower);
    fs.writeFileSync(path.join(__dirname, 'signals.json'), JSON.stringify(signals, null, 2));
    return signals;
  }

  let generator = new SequentialInputGenerator(sourceDataFolder, {file: sourceFile, verbose: true, skipChecks: true});

  let lastPosition = null;
  let measurementsMadeSinceLastSwitch = 0;

  let timeElapsed = 0;

  // resume
  let residualValues;
  if (resumeFrom > 0) {
    let timeZero = null;

    while(timeElapsed < resumeFrom) {
      const values = await generator.next();
      const timestamp = (new Date(convertToIsoDate(values.timestamp))).getTime();
      if (timeZero === null)
        timeZero = timestamp;
      timeElapsed = timestamp - timeZero;
      if (timeElapsed >= resumeFrom)
        residualValues = values;
    }
  }

  let timeZero = null;
  for (let handlePosition = 0; handlePosition < handlePositions; handlePosition += 1)
    if (cumulativeData && cumulativeData[handlePosition] && (cumulativeData[handlePosition].lastUpdated > timeZero))
      timeZero = cumulativeData[handlePosition].lastUpdated;

  while (true) {
    let values;
    if (residualValues) {
      values = residualValues;
      residualValues = null;
    } else
      values = await generator.next();

    const timestamp = (new Date(convertToIsoDate(values.timestamp))).getTime();

    if (timeZero === null)
      timeZero = timestamp;

    timeElapsed = timestamp - timeZero;
    if (timeElapsed > time)
      break;

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

    const power = Math.floor((values.current * values.voltage)/1000);

    if (power <= 50) {
      console.log('skipped a measurement due to low running power (<50K)');
      continue;
    }

    timeSeriesEvaluator.appendToSeries(outputFile, values.position, power, values.timestamp)
    console.log(`appended ${power} to ${values.position} at ${values.timestamp}`);

    // await new Promise((resolve) => setTimeout(resolve, interval));
  }

  timeSeriesEvaluator.generateMeanOutput(outputFile, resumeFrom + time);
  const signals = generateSignals(outputFile, expectedPower);
  fs.writeFileSync(path.join(__dirname, 'signals.json'), JSON.stringify(signals, null, 2));
  return signals;
}

// if ((!process.argv[4]))
//   return 1;
//
// runSimulation(process.argv[2], process.argv[3], Number(process.argv[4]));

function generateSignals(cumulativeDataPath, expectedPower, time) {
  const signals = [];

  const cumulativeData = require(cumulativeDataPath);

  for (let handlePosition = 1; handlePosition < cumulativeData.length; handlePosition += 1) {
    const output = cumulativeData[handlePosition].meanOutput;
    const expectedOutput = expectedPower[handlePosition];

    const lastDataUpdate = cumulativeData[handlePosition].lastUpdated;

    if ((output === null) || ((lastDataUpdate === null) || ((time - lastDataUpdate) > DATA_EXPIRES_AFTER)))
      signals.push(0)
    else if (output < 0.5*expectedOutput)
      signals.push(3);
    else if (output < 0.85*expectedOutput)
      signals.push(2);
    else
      signals.push(1);
  }
  return signals;
}

function convertToIsoDate(timestamp) {
  const dateParts = timestamp.split(' ');
  return `${dateParts[0].split('.').reverse().join('-')}T${dateParts[1]}.000Z`;
}
