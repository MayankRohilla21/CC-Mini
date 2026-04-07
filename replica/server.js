const express = require("express");
const log = require("./log");
const { PORT, REPLICA_ID } = require("./config");
const { replicateEntryToFollowers, handleAppendEntries } = require("./replication");
const { syncWithLeader } = require("./sync");

const app = express();
app.use(express.json());

// Leader adds new entry
app.post("/new-entry", async (req, res) => {
  const { term, command } = req.body;

  const entry = log.appendEntry(term, command);
  const success = await replicateEntryToFollowers(entry);

  res.json({
    success,
    entry,
    commitIndex: log.commitIndex
  });
});

// Followers receive AppendEntries
app.post("/append-entries", (req, res) => {
  const result = handleAppendEntries(req.body);
  res.json(result);
});

// Leader sends missing logs
app.get("/sync-log", (req, res) => {
  const lastIndex = parseInt(req.query.lastIndex || 0);
  const missingEntries = log.getEntriesFrom(lastIndex);

  res.json({
    entries: missingEntries,
    commitIndex: log.commitIndex
  });
});

// Force a replica to sync with leader
app.post("/force-sync", async (req, res) => {
  const { leaderUrl } = req.body;

  await syncWithLeader(leaderUrl);

  res.json({
    success: true,
    message: "Sync attempted",
    logs: log.log,
    commitIndex: log.commitIndex
  });
});

// Check logs
app.get("/logs", (req, res) => {
  res.json({
    replica: REPLICA_ID,
    logs: log.log,
    commitIndex: log.commitIndex,
    lastApplied: log.lastApplied
  });
});

app.listen(PORT, () => {
  console.log(`Replica ${REPLICA_ID} running on port ${PORT}`);
});