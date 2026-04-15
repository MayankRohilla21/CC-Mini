const fs = require("fs");
const path = require("path");

const logDir = process.env.LOG_DIR || path.join(process.cwd(), "logs");
const logPath = path.join(logDir, "gateway.log");

fs.mkdirSync(logDir, { recursive: true });

function write(level, event, details = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: "gateway",
    event,
    details,
  });
  console.log(line);
  fs.appendFileSync(logPath, `${line}\n`);
}

module.exports = {
  info: (event, details) => write("INFO", event, details),
  warn: (event, details) => write("WARN", event, details),
  error: (event, details) => write("ERROR", event, details),
};
