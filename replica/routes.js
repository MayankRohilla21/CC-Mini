const express = require("express");
const router = express.Router();

const state = require("./state");
const { resetElectionTimer } = require("./timers");
const { startElection } = require("./raft");
const log = require("./log");

// GET LOG ENDPOINT
router.get("/log", (req, res) => {
  res.json(log.getLog());
});

/**
 * REQUEST VOTE RPC
 */
router.post("/request-vote", (req, res) => {
  const { term, candidateId } = req.body;

  console.log(`[${process.env.ID}] Vote request from ${candidateId} (term ${term})`);

  // Reject if term is stale
  if (term < state.getTerm()) {
    return res.json({
      voteGranted: false,
      term: state.getTerm(),
    });
  }

  // If term is higher → update term and convert to follower
  if (term > state.getTerm()) {
    state.incrementTerm(); // reset votedFor internally
    state.setState("FOLLOWER");
  }

  // Grant vote if not voted or same candidate
  if (!state.getVotedFor() || state.getVotedFor() === candidateId) {
    state.voteFor(candidateId);

    // Reset election timer since we heard from candidate
    resetElectionTimer();

    console.log(`[${process.env.ID}] Voted for ${candidateId}`);

    return res.json({
      voteGranted: true,
      term: state.getTerm(),
    });
  }

  // Already voted for someone else
  res.json({
    voteGranted: false,
    term: state.getTerm(),
  });
});

/**
 * HEARTBEAT RPC
 */
router.post("/heartbeat", (req, res) => {
  const { term, leaderId } = req.body;

  console.log(`[${process.env.ID}] Heartbeat from ${leaderId} (term ${term})`);

  // Ignore stale leader
  if (term < state.getTerm()) {
    return res.sendStatus(200);
  }

  // If newer term → update
  if (term > state.getTerm()) {
    state.incrementTerm();
  }

  // 🔥 ONLY change state if needed
  if (state.getState() !== "FOLLOWER") {
    state.setState("FOLLOWER");
  }

  state.setLeader(leaderId);

  // Reset election timer
  resetElectionTimer();

  res.sendStatus(200);
});

/**
 * LEADER DISCOVERY (for Gateway)
 */
router.get("/leader", (req, res) => {
  res.json({
    leader: state.getLeader(),
    term: state.getTerm(),
    state: state.getState(),
  });
});


router.post("/append-entries", (req, res) => {
  const { term, leaderId, entry } = req.body;

  console.log(`[${process.env.ID}] AppendEntries from ${leaderId}`);

  // Reject stale leader
  if (term < state.getTerm()) {
    return res.json({ success: false });
  }

  // Become follower if needed
  if (state.getState() !== "FOLLOWER") {
    state.setState("FOLLOWER");
  }

  state.setLeader(leaderId);

  // Append entry
  if (entry) {
    log.appendEntry(entry);
  }

  // Reset timer
  resetElectionTimer();

  res.json({ success: true });
});

const { replicateEntry } = require("./raft");

router.post("/stroke", async (req, res) => {
  const entry = req.body;

  if (state.getState() !== "LEADER") {
    return res.status(400).json({
      error: "Not leader",
      leaderId: state.getLeader(),
      term: state.getTerm(),
    });
  }

  console.log(`[${process.env.ID}] Received stroke`);

  const committed = await replicateEntry(entry);

  if (committed) {
    res.json({ success: true, entry });
  } else {
    res.status(500).json({ success: false });
  }
});

router.get("/sync-log", (req, res) => {
  console.log(`[${process.env.ID}] Sending log for sync`);

  res.json({
    log: log.getLog(),
    term: state.getTerm(),
  });
});

module.exports = router;