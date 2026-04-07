const axios = require("axios");
const log = require("./log");

async function syncWithLeader(leaderUrl) {
  try {
    const lastIndex = log.getLastLogIndex();

    console.log(`Syncing with leader from index ${lastIndex}`);

    const res = await axios.get(`${leaderUrl}/sync-log`, {
      params: { lastIndex }
    });

    const missingEntries = res.data.entries || [];

    if (missingEntries.length > 0) {
      console.log(`Received ${missingEntries.length} missing entries`);

      missingEntries.forEach(entry => {
        log.appendExistingEntry(entry);
      });

      if (res.data.commitIndex > log.commitIndex) {
        log.commit(res.data.commitIndex);
      }

      const { applyCommittedEntries } = require("./apply");
      applyCommittedEntries();
    } else {
      console.log("Already up to date");
    }
  } catch (err) {
    console.error("Error syncing with leader:", err.message);
  }
}

module.exports = {
  syncWithLeader
};