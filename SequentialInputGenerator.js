const fs = require('fs');
const path = require('path');
const fileUtils = require('./fileUtils');

const measurementTypes = {
  'voltage': 'Voltage_generator_',
  'position': 'PozKontS_',
  'current': 'Current_generator_'
}
const sourceDataFolder = path.join(__dirname, 'trips');
const verbose = false;

class SequentialInputGenerator {

  constructor(sourceDataFolder, options) {
    const allFiles = fs.readdirSync(sourceDataFolder);
    const randomMeasurementsFile = allFiles[Math.floor(Math.random()*allFiles.length)];

    const measurementFiles = {};
    let measurementType = null;
    let measuredPeriod = null;
    for (const checkedType of Object.keys(measurementTypes)) {
      const match = new RegExp(`^${measurementTypes[checkedType]}(.*$)`).exec(randomMeasurementsFile);
      if (match) {
        measurementType = checkedType;
        measuredPeriod = match[1];
        measurementFiles[measurementType] = randomMeasurementsFile
        break;
      }
    }

    for (const checkedType of Object.keys(measurementTypes)) {
      if (checkedType === measurementType)
        continue;
      measurementFiles[checkedType] = `${measurementTypes[checkedType]}${measuredPeriod}`;
    }

    if (options && options.verbose)
      this.verbose = options.verbose;

    this.sourceDataFolder = sourceDataFolder;
    this.measurementFiles = measurementFiles;
    this.nextLine = 1;
  }

  async next() {
    if (!this.linesTotal)
    this.linesTotal = await fileUtils.countFileLines(path.join(this.sourceDataFolder, this.measurementFiles[Object.keys(this.measurementFiles)[0]]));
    
    const measurementsAtTimestamp = {};

    for (const measurementType of Object.keys(measurementTypes)) {
      const filePath = path.join(this.sourceDataFolder, this.measurementFiles[measurementType]);
      try {
        measurementsAtTimestamp[measurementType] = await fileUtils.readCertainLine(filePath, this.nextLine)
      } catch(err) {
        if (this.verbose)
          console.error(`could not read from ${filePath} (does the file exist?)`);
        this.nextLine += 1;
        return await this.next();
      }
    }

    let timestamp;
    let values = {};
    for (const measurementType of Object.keys(measurementTypes)) {
      const match = /\d+\s(.+?\s.+?)\s(\d+)/.exec(measurementsAtTimestamp[measurementType]);

      if (!match) {
        if (this.verbose)
          console.error(`data does not match the pattern in ${this.measurementFiles[measurementType]} at line ${this.nextLine}`);
        this.nextLine += 1;
        return await this.next();
      }

      if (!timestamp)
        timestamp = match[1];
      else if (match[1] !== timestamp) {
        if (this.verbose)
          console.error('timestamps do not match in\n', this.measurementFiles, `\nat line ${this.nextLine}`);
        this.nextLine += 1;
        return await this.next();
      }

      values[measurementType] = Number(match[2]);
    }

    values['timestamp'] = timestamp;
    this.nextLine += 1;
    if (this.nextLine > this.linesTotal)
      this.nextLine = 1;

    return values;
  }

}
module.exports = SequentialInputGenerator;

async function generateMeasurements(sourceDataFolder) {
  const generator = new SequentialInputGenerator(sourceDataFolder);

  while (true) {
    const values = await generator.next();
    console.log(values);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

if (process.argv[2] === 'run') {
  if (process.argv[3])
    generateMeasurements(process.argv[3]);
  else
    generateMeasurements(sourceDataFolder);
}
