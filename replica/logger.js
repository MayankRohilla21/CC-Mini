const fs = require("fs");
const path = require("path");
const state = require("./state");

const id = process.env.ID || "node-unknown";
const logDir = process.env.LOG_DIR || path.join(process.cwd(), "logs");
const logPath = path.join(logDir, `replica-${id}.log`);

fs.mkdirSync(logDir, { recursive: true });

function format(level, event, details = {}) {
  return JSON.stringify({
    ts: new Date().toISOString(),
    level,
    nodeId: id,
    state: state.getState(),
    term: state.getTerm(),
    event,
    details,
  });
}

function write(level, event, details = {}) {
  const line = format(level, event, details);
  console.log(line);
  fs.appendFileSync(logPath, `${line}\n`);
}

module.exports = {
  info: (event, details) => write("INFO", event, details),
  warn: (event, details) => write("WARN", event, details),
  error: (event, details) => write("ERROR", event, details),
};
