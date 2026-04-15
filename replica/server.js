const express = require("express");
const routes = require("./routes");
const { startRaft } = require("./raft");
const state = require("./state");
const log = require("./log");
const logger = require("./logger");

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    nodeId: process.env.ID || "node1",
    state: state.getState(),
    term: state.getTerm(),
    commitIndex: log.getCommitIndex(),
    logLength: log.getLog().length,
  });
});

app.use("/", routes);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  logger.info("REPLICA_SERVER_STARTED", { port: PORT });
  startRaft();
});