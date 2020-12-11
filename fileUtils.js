module.exports = {
  countFileLines,
  readCertainLine
};

const fs = require('fs');

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