const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

const dashboard = path.join(__dirname, 'templates', 'dashboard.html');
const powerOutputData = path.join(__dirname, 'cumulativePowerOutputData.json');
const sourceDataFolder = path.join(__dirname, 'service');
const simulationInput = 'Current_generator_124-1-65_2020-10-17(10h12m)_2020-10-29(01h54m)S_S.txt';

if (!fs.existsSync(path.join(sourceDataFolder, simulationInput))) {
  console.log(`this demo requires ${simulationInput} to be inside ${sourceDataFolder}`);
  return 1;
}

const signalsFile = path.join(__dirname, 'signals.json');
const statics = path.join(__dirname, 'templates', 'resource');

const simulator = require('./simulation');

const port = 8888;

let timeElapsed = 0;

app.get('/', (req, res) => {
  res.sendFile(dashboard);
});

app.get('/reloadData', (req, res) => {
  res.sendFile(powerOutputData);
});

app.get('/loadSignals', (req, res) => {
  if (fs.existsSync(signalsFile))
    res.sendFile(signalsFile);
});

app.get('/initSimulator', (req, res) => {
  simulator(sourceDataFolder, simulationInput, powerOutputData, timeElapsed)
    .then(() => res.send(true));
});

app.get('/simulateFor30', (req, res) => {
  simulator(sourceDataFolder, simulationInput, powerOutputData, 30*60*1000, timeElapsed)
    .then(() => res.send(true));
  timeElapsed += 30*60*1000;
});

app.get('/simulateFor60', (req, res) => {
  simulator(sourceDataFolder, simulationInput, powerOutputData, 60*60*1000, timeElapsed)
    .then(() => res.send(true));
  timeElapsed += 60*60*1000;
});

console.log('listening on', port);
app.use(express.static(statics));
app.listen(port);
