// takes
// 1: value to append
// 2: power handle position
// 3: update timestamp
// 4: path to the cumulative data file

module.exports = appendToSeries;

const LAST_VALUE_WEIGHT = 0.6;
const NUMBER_OF_POWER_HANDLE_POSITIONS = require('./commonData.json').handlePositions;
const DATA_EXPIRES_AFTER = require('./commonData.json').dataExpiresAfter; // ms

const fs = require('fs');
const path = require('path');

function appendToSeries(file, position, value, timestamp) {
  let cumulativeData = null;

  if (!fs.existsSync(file)) {
    cumulativeData = [];
    for (let i = 0; i < NUMBER_OF_POWER_HANDLE_POSITIONS; i += 1)
      cumulativeData.push({
        meanOutput: 0,
        lastUpdated: null
      });
  } else {
    cumulativeData = require(file);
    while (cumulativeData.length < NUMBER_OF_POWER_HANDLE_POSITIONS)
      cumulativeData.push({
        meanOutput: 0,
        lastUpdated: null
      });
  }

  if (file && position && value && timestamp) {
    const updateTime = (new Date(convertToIsoDate(timestamp))).getTime();

    if (
      (!cumulativeData[position].lastUpdated)
      || ((updateTime - cumulativeData[position].lastUpdated) > DATA_EXPIRES_AFTER)
    )
      cumulativeData[position]['meanOutput'] = value;
    else
      cumulativeData[position]['meanOutput'] = Math.floor(((1 - LAST_VALUE_WEIGHT) * cumulativeData[position]['meanOutput']) + (LAST_VALUE_WEIGHT * value));

    cumulativeData[position]['lastUpdated'] = updateTime;
  }

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
