let entries = [];
let commitIndex = -1;

function normalizeEntry(entry, term) {
  if (entry && typeof entry === "object" && Object.prototype.hasOwnProperty.call(entry, "index")) {
    return {
      index: entry.index,
      term: entry.term,
      committed: Boolean(entry.committed),
      ts: entry.ts || new Date().toISOString(),
      data: entry.data,
    };
  }

  return {
    index: entries.length,
    term,
    committed: false,
    ts: new Date().toISOString(),
    data: entry,
  };
}

function appendEntry(entry, term) {
  const normalized = normalizeEntry(entry, term);
  entries.push(normalized);
  return normalized.index;
}

function getLog() {
  return entries;
}

function getEntry(index) {
  return entries[index] || null;
}

function getLastIndex() {
  return entries.length - 1;
}

function getEntriesFrom(startIndex) {
  if (startIndex <= 0) return [...entries];
  return entries.filter((entry) => entry.index >= startIndex);
}

function commit(index) {
  commitIndex = Math.max(commitIndex, index);
  for (let i = 0; i <= commitIndex && i < entries.length; i++) {
    entries[i].committed = true;
  }
}

function getCommitIndex() {
  return commitIndex;
}

function setLog(newLog) {
  entries = [...newLog].sort((a, b) => a.index - b.index);
}

function installEntries(newEntries) {
  for (const entry of newEntries) {
    if (!getEntry(entry.index)) {
      entries.push(entry);
    }
  }
  entries.sort((a, b) => a.index - b.index);
}

module.exports = {
  appendEntry,
  getLog,
  getEntry,
  getLastIndex,
  getEntriesFrom,
  commit,
  getCommitIndex,
  setLog,
  installEntries,
};
