// takes
// 1: value to append
// 2: power handle position
// 3: update timestamp
// 4: path to the cumulative data file

module.exports = {
  appendToSeries,
  generateMeanOutput
};

const NUMBER_OF_POWER_HANDLE_POSITIONS = require('./commonData.json').handlePositions;
const DATA_EXPIRES_AFTER = require('./commonData.json').dataExpiresAfter; // ms

const fs = require('fs');
const path = require('path');

function loadCumulativeData(file) {
  let cumulativeData = null;

  if (!fs.existsSync(file))
    cumulativeData = [];
  else
    cumulativeData = require(file);

  while (cumulativeData.length < NUMBER_OF_POWER_HANDLE_POSITIONS)
    cumulativeData.push({
      meanOutput: null,
      seconds: [],
      minutes: [],
      hours: [],
      days: [],
      months: [],
      lastUpdated: null
    });

  fs.writeFileSync(file, JSON.stringify(cumulativeData, null, 2));

  return cumulativeData;
}

function appendToSeries(file, position, value, timestamp) {
  if (file && position && value && timestamp) {
    const cumulativeData = loadCumulativeData(file);

    const updateTime = (new Date(convertToIsoDate(timestamp))).getTime();
    if (!cumulativeData[position].lastUpdated)
      cumulativeData[position]['lastUpdated'] = updateTime;
      const dateComparison = compareDates(new Date(cumulativeData[position].lastUpdated), new Date(updateTime));

      if (dateComparison.sameMinute)
        cumulativeData[position].seconds.push(value);
      else {
        if (!dateComparison.sameMinute) {
          if (cumulativeData[position].seconds.length > 0)
            cumulativeData[position].minutes.push(Math.floor(computeMean(cumulativeData[position].seconds)));
          cumulativeData[position].seconds = [value];
        }

        if (!dateComparison.sameHour) {
          if (cumulativeData[position].minutes.length > 0)
            cumulativeData[position].hours.push(Math.floor(computeMean(cumulativeData[position].minutes)));
          cumulativeData[position].minutes = [];
        }

        if (!dateComparison.sameDay) {
          if (cumulativeData[position].hours.length > 0)
            cumulativeData[position].days.push(Math.floor(computeMean(cumulativeData[position].hours)));
          cumulativeData[position].hours = [];
        }

        if (!dateComparison.sameMonth) {
          if (cumulativeData[position].days.length > 0) {
            cumulativeData[position].months.push(Math.floor(computeMean(cumulativeData[position].days)));
            if (cumulativeData[position].months.length > 12)
              cumulativeData[position].months.shift();
          }
          cumulativeData[position].days = [];
        }
      }

    cumulativeData[position]['lastUpdated'] = updateTime;
    fs.writeFileSync(file, JSON.stringify(cumulativeData, null, 2));
  }
}

function generateMeanOutput(cumulativeDataFile, time) {
  const cumulativeData = loadCumulativeData(cumulativeDataFile);

  for (let handlePosition = 0; handlePosition < NUMBER_OF_POWER_HANDLE_POSITIONS; handlePosition += 1) {

    if (
      (!cumulativeData[handlePosition].lastUpdated)
      || ((time - cumulativeData[handlePosition].lastUpdated) > DATA_EXPIRES_AFTER)
    )
      cumulativeData[handlePosition]['meanOutput'] = null;
    else {
      let meanOverMinute = null;
      let meanOverHour = null;
      let meanOverDay = null;
      let meanOverMonth = null;

      let meanOverYear = null;

      if (cumulativeData[handlePosition].seconds.length > 0)
        meanOverMinute = Math.floor(computeMean(cumulativeData[handlePosition].seconds));

      let totalMinutelyValues = cumulativeData[handlePosition].minutes;
      if (meanOverMinute)
        totalMinutelyValues = totalMinutelyValues.concat([meanOverMinute]);

      if (totalMinutelyValues.length > 0)
        meanOverHour = Math.floor(computeMean(totalMinutelyValues));

      let totalHourlyValues = cumulativeData[handlePosition].hours;
      if (meanOverHour)
        totalHourlyValues = totalHourlyValues.concat([meanOverHour]);

      if (totalHourlyValues.length > 0)
        meanOverDay = Math.floor(computeMean(totalHourlyValues));

      let totalDailyValues = cumulativeData[handlePosition].days;
      if (meanOverDay)
        totalDailyValues = totalDailyValues.concat([meanOverDay]);

      if (totalDailyValues.length > 0)
        meanOverMonth = Math.floor(computeMean(totalDailyValues));

      let totalMonthlyValues = cumulativeData[handlePosition].months;
      if (meanOverMonth)
        totalMonthlyValues = totalMonthlyValues.concat([meanOverMonth]);

      meanOverYear = Math.floor(computeMean(totalMonthlyValues));
      cumulativeData[handlePosition].meanOutput = meanOverYear;
    }

  }

  fs.writeFileSync(cumulativeDataFile, JSON.stringify(cumulativeData, null, 2));
  return cumulativeData;
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

function destructureDate(date) {
  const out = {};
  out['year'] = date.getFullYear();
  out['month'] = date.getMonth();
  out['day'] = date.getDate();
  out['hour'] = date.getHours();
  out['minute'] = date.getMinutes();

  return out;
}

function compareDates(date1, date2) {
  const date1Constituents = destructureDate(date1);
  const date2Constituents = destructureDate(date2);
  const out = {
    sameMinute: false,
    sameHour: false,
    sameDay: false,
    sameMonth: false,
    sameYear: false
  };

  if (date1Constituents.year === date2Constituents.year) {
    out.sameYear = true;
    if (date1Constituents.month === date2Constituents.month) {
      out.sameMonth = true;
      if (date1Constituents.day === date2Constituents.day) {
        out.sameDay = true;
        if (date1Constituents.hour === date2Constituents.hour) {
          out.sameHour = true;
          if (date1Constituents.minute === date2Constituents.minute)
            out.sameMinute = true;
        }
      }
    }
  }
  return out;
}

function computeMean(values) {
  if (values.length < 1)
    return 0;
  let mean = 0;
  let weightFactor = 1;
  let divisor = 0;
  for (const value of values) {
    mean += value * weightFactor;
    divisor += weightFactor;
    // mean += value << weightFactor;
    // divisor += 2^weightFactor;
    weightFactor += 1;
  }
  return mean/divisor;
}
