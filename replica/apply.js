const log = require("./log");

function applyCommittedEntries() {
  const unapplied = log.getUnappliedEntries();

  if (unapplied.length > 0) {
    console.log("Applying committed entries:");

    unapplied.forEach(entry => {
      console.log(`Applied index ${entry.index}:`, entry.command);
    });
  }
}

module.exports = {
  applyCommittedEntries
};