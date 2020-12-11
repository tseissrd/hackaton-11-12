// takes
// 1: value to append
// 2: power handle position
// 3: update timestamp
// 4: path to the cumulative data file

module.exports = appendToSeries;

const LAST_VALUE_WEIGHT = 0.6;
const NUMBER_OF_POWER_HANDLE_POSITIONS = 16;
const DATA_EXPIRES_AFTER = 1000*60*60*24*4; // ms

const fs = require('fs');
const path = require('path');

let cumulativeDataFile = path.join(__dirname, 'cumulativePowerOutputData.json');

function appendToSeries(file, position, value, timestamp) {
  let cumulativeData = null;

  if (!fs.existsSync(cumulativeDataFile)) {
    cumulativeData = [];
    for (let i = 0; i < NUMBER_OF_POWER_HANDLE_POSITIONS; i += 1)
      cumulativeData.push({
        meanOutput: 0,
        lastUpdated: null
      });
  } else {
    cumulativeData = require(cumulativeDataFile);
    if (cumulativeData.length < NUMBER_OF_POWER_HANDLE_POSITIONS)
      for (let i = 0; i < (NUMBER_OF_POWER_HANDLE_POSITIONS - cumulativeData.length); i += 1)
        cumulativeData.push({
          meanOutput: 0,
          lastUpdated: null
        });
  }

  const updateTime = new Date(convertToIsoDate(timestamp));

  if (
    (!cumulativeData[position].lastUpdated)
    || ((updateTime.getTime() - (new Date(cumulativeData[position].lastUpdated)).getTime()) > DATA_EXPIRES_AFTER)
  )
    cumulativeData[position]['meanOutput'] = value;
  else
    cumulativeData[position]['meanOutput'] = ((1 - LAST_VALUE_WEIGHT) * cumulativeData[position]['meanOutput']) + (LAST_VALUE_WEIGHT * value);

  cumulativeData[position]['lastUpdated'] = (updateTime).toISOString();

  fs.writeFileSync(file, JSON.stringify(cumulativeData, null, 2));
}

if ((!process.argv[2]) || (!process.argv[3]) || (!process.argv[4]))
  return 1;

if (process.argv[5]) {
  cumulativeDataFile = process.argv[5];
}

// appendToSeries(cumulativeDataFile, process.argv[3], process.argv[2], process.argv[4]);

function convertToIsoDate(timestamp) {
  const dateParts = timestamp.split(' ');
  return `${dateParts[0].split('.').reverse().join('-')}T${dateParts[1]}.000Z`;
}
