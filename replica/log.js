let log = [];
let commitIndex = -1;

function appendEntry(entry) {
  log.push(entry);
  return log.length - 1;
}

function getLog() {
  return log;
}

function commit(index) {
  commitIndex = index;
}

function getCommitIndex() {
  return commitIndex;
}

function printLog() {
  console.log("LOG:", log);
}

function setLog(newLog) {
  log = [...newLog];
}

module.exports = {
  appendEntry,
  getLog,
  commit,
  getCommitIndex,
  printLog,
  setLog
};
