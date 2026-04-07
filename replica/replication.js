const axios = require("axios");
const log = require("./log");
const { PEERS, REPLICA_ID } = require("./config");
const { applyCommittedEntries } = require("./apply");

// Simulated state for now
let currentTerm = 1;
let state = "leader"; // for testing only

async function replicateEntryToFollowers(entry) {
  if (state !== "leader") {
    console.log("Not leader, cannot replicate");
    return false;
  }

  let successCount = 1; // leader itself counts

  const requests = PEERS.map(async (peer) => {
    try {
      const res = await axios.post(`${peer}/append-entries`, {
        term: currentTerm,
        leaderId: REPLICA_ID,
        entries: [entry],
        leaderCommit: log.commitIndex
      });

      if (res.data.success) {
        successCount++;
      }
    } catch (err) {
      console.log(`Failed to replicate to ${peer}`);
    }
  });

  await Promise.all(requests);

  const majority = Math.floor((PEERS.length + 1) / 2) + 1;

  if (successCount >= majority) {
    log.commit(entry.index);
    console.log(`Entry ${entry.index} committed with majority`);

    applyCommittedEntries();

    return true;
  } else {
    console.log(`Entry ${entry.index} failed to reach majority`);
    return false;
  }
}

function handleAppendEntries({ term, leaderId, entries, leaderCommit }) {
  console.log(`Received AppendEntries from leader ${leaderId}`);

  if (term < currentTerm) {
    return { success: false };
  }

  currentTerm = term;

  for (const entry of entries) {
    log.appendExistingEntry(entry);
  }

  if (leaderCommit > log.commitIndex) {
    log.commit(Math.min(leaderCommit, log.getLastLogIndex()));
  }

  applyCommittedEntries();

  return { success: true };
}

module.exports = {
  replicateEntryToFollowers,
  handleAppendEntries
};