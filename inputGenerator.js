// takes
// 1: path to the data folder
// 2 (optional): power handle position to search the data for

const fs = require('fs');
const path = require('path');
const fileUtils = require('./fileUtils');

const sourceDataFolder = path.join(__dirname, 'trips');
const verbose = false;

const measurementTypes = {
	'voltage': 'Voltage_generator_',
	'position': 'PozKontS_',
	'current': 'Current_generator_'
}

async function giveOneMeasurement(sourceDataFolder, options) {
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

	const linesTotal = await fileUtils.countFileLines(path.join(sourceDataFolder, randomMeasurementsFile));
	const numOfLineToRead = Math.floor(Math.random()*linesTotal) + 1;
	const measurementsAtTimestamp = {};

	for (const measurementType of Object.keys(measurementTypes)) {
		const filePath = path.join(sourceDataFolder, measurementFiles[measurementType]);
		try {
			measurementsAtTimestamp[measurementType] = await fileUtils.readCertainLine(filePath, numOfLineToRead)
		} catch(err) {
			if (verbose)
				console.error(`could not read from ${filePath} (does the file exist?)`);
			return await giveOneMeasurement(sourceDataFolder, options);
		}
	}

	let timestamp;
	let values = {};
	for (const measurementType of Object.keys(measurementTypes)) {
		const match = /\d+\s(.+?\s.+?)\s(\d+)/.exec(measurementsAtTimestamp[measurementType]);

		if (!match) {
			if (verbose)
				console.error(`data does not match the pattern in ${measurementFiles[measurementType]} at line ${numOfLineToRead}`);
			return await giveOneMeasurement(sourceDataFolder, options);
		}

		if (!timestamp)
			timestamp = match[1];
		else if (match[1] !== timestamp) {
			if (verbose)
				console.error('timestamps do not match in\n', measurementFiles, `\nat line ${numOfLineToRead}`);
			return await giveOneMeasurement(sourceDataFolder, options);
		}

		values[measurementType] = Number(match[2]);
	}

	if (options.lookForPosition !== undefined) {
		while (values.position !== options.lookForPosition) {
			values = await giveOneMeasurement(sourceDataFolder, options);
		}
	}

	values['timestamp'] = timestamp;
	return values;
}

async function generateMeasurements(sourceDataFolder, options = {}) {
	let lastPosition = null;
	let positionRepeats = 0;
	let values;
	while (true) {
		if (
			options.samePositionForAtLeast
			&& (lastPosition !== null)
			&& (
				(positionRepeats < options.samePositionForAtLeast)
				|| (Math.random() > 0.5)
			)
		) {
			values = await giveOneMeasurement(sourceDataFolder, {lookForPosition: lastPosition});
			positionRepeats += 1;
		} else {
			values = await giveOneMeasurement(sourceDataFolder, {});
			positionRepeats = 1;
			lastPosition = values['position'];
		}
		console.log(values);
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
}

if (process.argv[2]) {
	return giveOneMeasurement(process.argv[2], process.argv[3]? {
		lookForPosition: Number(process.argv[3])
	} : {}).then(values => console.log(values))
} else
	generateMeasurements(sourceDataFolder, {
		samePositionForAtLeast: 4
	});
