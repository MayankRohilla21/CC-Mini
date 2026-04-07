const fs = require("fs");
const path = require("path");
const { LOG_FILE } = require("./config");

class Log {
  constructor() {
    this.log = [];
    this.commitIndex = 0;
    this.lastApplied = 0;

    this.filePath = path.join(__dirname, LOG_FILE);
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath);
        this.log = JSON.parse(data);
        console.log(`Logs loaded from ${LOG_FILE}`);
      }
    } catch (err) {
      console.error("Error loading logs:", err);
    }
  }

  persist() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.log, null, 2));
    } catch (err) {
      console.error("Error saving logs:", err);
    }
  }

  appendEntry(term, command) {
    const entry = {
      term,
      index: this.getLastLogIndex() + 1,
      command
    };

    this.log.push(entry);
    this.persist();
    return entry;
  }

  appendExistingEntry(entry) {
    const existing = this.getEntry(entry.index);
    if (!existing) {
      this.log.push(entry);
      this.persist();
    }
  }

  getLastLogIndex() {
    if (this.log.length === 0) return 0;
    return this.log[this.log.length - 1].index;
  }

  getLastLogTerm() {
    if (this.log.length === 0) return 0;
    return this.log[this.log.length - 1].term;
  }

  getEntry(index) {
    return this.log.find(e => e.index === index);
  }

  getEntriesFrom(startIndex) {
    return this.log.filter(e => e.index > startIndex);
  }

  commit(index) {
    if (index > this.commitIndex) {
      this.commitIndex = index;
    }
  }

  getUnappliedEntries() {
    const entries = [];

    for (let i = this.lastApplied + 1; i <= this.commitIndex; i++) {
      const entry = this.getEntry(i);
      if (entry) entries.push(entry);
    }

    this.lastApplied = this.commitIndex;
    return entries;
  }
}

module.exports = new Log();