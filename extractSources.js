const fileUtils = require('./fileUtils');
const fs = require('fs');
const path = require('path');

const {measurementTypes} = require('./commonData.json');

async function extractSources(sourceDataFolder) {
  const allFiles = fs.readdirSync(sourceDataFolder);

  const dataCodes = [];

  const extractingPromises = [];

  for (const file of allFiles) {

    let measuredPeriod;

    for (const measurementType of Object.keys(measurementTypes)) {
      const match = new RegExp(`^${measurementTypes[measurementType]}(.*$)`).exec(file);
      if (match) {
        measuredPeriod = match[1];
        break;
      }
    }

    if (dataCodes.includes(measuredPeriod))
      continue;
    dataCodes.push(measuredPeriod);

    const stream = fileUtils.streamPowerInfo(sourceDataFolder, file);

    const outFolder = path.join(__dirname, 'extracted');
    if (!fs.existsSync(outFolder))
      fs.mkdirSync(outFolder);

    extractingPromises.push(new Promise(async (resolve, reject) => {
      const outFile = path.join(outFolder, `${measuredPeriod}.csv`);
      const writeStream = fs.createWriteStream(outFile);

      console.log('extracting to', outFile);
      stream.on('data', chunk => {
        const value = JSON.parse(chunk.toString());
        const power = value.current * value.voltage;

        writeStream.write(`${(new Date(convertToIsoDate(value.timestamp))).getTime()}, ${value.position}, ${power}\n`, (err) => {
          if (err)
            return reject(err);
          return resolve(outFile);
        });
      });

      stream.on('end', () => {
        writeStream.close();
      });
    }));
  }

  return await Promise.all(extractingPromises);
}

extractSources(process.argv[2]);

function convertToIsoDate(timestamp) {
  const dateParts = timestamp.split(' ');
  return `${dateParts[0].split('.').reverse().join('-')}T${dateParts[1]}.000Z`;
}
