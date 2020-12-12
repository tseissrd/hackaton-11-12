module.exports = {
  countFileLines,
  readCertainLine,
  streamPowerInfo
};

const fs = require('fs');
const path = require('path');

function countFileLines(filePath){
  return new Promise((resolve, reject) => {
    let lineCount = 0;
    fs.createReadStream(filePath)
      .on("data", (buffer) => {
        let idx = -1;
        lineCount--;
        do {
          idx = buffer.indexOf(10, idx+1);
          lineCount++;
        } while (idx !== -1);
      }).on("end", () => {
      resolve(lineCount);
    }).on("error", reject);
  });
}

function readCertainLine(filePath, lineNum){
  return new Promise((resolve, reject) => {
    let lineCount = 0;
    let wantedLine;
    const readStream = fs.createReadStream(filePath);

    readStream.on("data", (buffer) => {
      let idx = -1;
      let nextIdx;
      lineCount--;
      do {
        idx = buffer.indexOf(10, idx + 1);
        if (idx !== -1)
          nextIdx = buffer.indexOf(10, idx + 1);
        lineCount++;
        if (lineCount >= (lineNum - 2)) {
          if (!wantedLine || wantedLine.length === 0) {
            wantedLine = buffer.slice(idx + 1);
            if (nextIdx !== -1) {
              wantedLine = wantedLine.slice(0, nextIdx - idx);
              readStream.close();
              return resolve(wantedLine.toString());
            }
          } else {
            if (idx !== -1) {
              wantedLine += buffer.slice(0, idx + 1);
              readStream.close();
              return resolve(wantedLine.toString());
            } else {
              wantedLine += buffer;
            }
          }
        }
      } while (idx !== -1);
    }).on("end", () => {
      resolve(wantedLine.toString());
    }).on("error", reject);
  });
}

function streamPowerInfo(sourceDataFolder, eitherTypeInfoFile) {
  // const MAX_CHUNK_BUFFER = 10;

  const readableOutput = new require('stream').Readable({
    read() {
    }
  });

  const {measurementTypes} = require('./commonData.json');

  const randomMeasurementsFile = eitherTypeInfoFile;

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

  const dataChunks = {};
  const readStreams = {};

  for (const measurementType of Object.keys(measurementTypes)) {
    dataChunks[measurementType] = [];
    readStreams[measurementType] = fs.createReadStream(path.join(sourceDataFolder, measurementFiles[measurementType]));

    let currentLine = [];

    readStreams[measurementType].on('data', chunk => {
      let idx = -1;
      let lastIdx;
      do {
        lastIdx = idx;
        idx = chunk.indexOf(10, idx + 1);
        if (idx !== -1) {
          currentLine.push(chunk.slice(lastIdx + 1, idx + 1));
          dataChunks[measurementType].push(Buffer.concat(currentLine).toString());
          currentLine = [];
          // if (dataChunks[measurementType].length >= MAX_CHUNK_BUFFER)
          //   readStreams[measurementType].pause();

          let chunksCheck = true;
          for (const otherMeasurementType of Object.keys(measurementTypes)) {
            if (otherMeasurementType === measurementType)
              continue;

            if (dataChunks[otherMeasurementType].length === 0)
              chunksCheck = false;
          }
          if (chunksCheck) {
            const out = {};
            for (const measurementType of Object.keys(measurementTypes)) {
              let match = null

              while(match === null) {
                match = /\d+\s(.+?\s.+?)\s(\d+)/.exec(dataChunks[measurementType].shift());
                if (
                  (match === null)
                  && (dataChunks[measurementType].length === 0)
                ) {
                  let streamCheck = false;
                  for (const measurementType of Object.keys(measurementTypes)) {
                    if (
                      (!readStreams[measurementType].isPaused())
                      && (!readStreams[measurementType].closed)
                    )
                      streamCheck = true;
                  }
                  if (!streamCheck) {
                    readableOutput.push(null);
                  }

                  return false;
                }
              }

              const [
                ,
                timestamp,
                value
              ] = match;

              // if (
              //   readStreams[measurementType].isPaused()
              //   && (readStreams[measurementType].length < MAX_CHUNK_BUFFER)
              //   )
              //   readStreams[measurementType].resume();

              out[measurementType] = value;
              if (!out['timestamp'])
                out['timestamp'] = timestamp;
            }
            readableOutput.push(JSON.stringify(out));
          }

        } else
          currentLine.push(chunk);
      } while (idx !== -1)
    });

    readStreams[measurementType].on('end', () => {
      if (currentLine.length > 0)
        dataChunks[measurementType].push(Buffer.concat(currentLine).toString());
    });
  }

  return readableOutput;
}
