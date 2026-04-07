module.exports = {
  LOG_FILE: `logs_${process.env.REPLICA_ID || "1"}.json`,

  REPLICA_ID: process.env.REPLICA_ID || "1",
  PORT: process.env.PORT || 5001,

  PEERS: process.env.PEERS
    ? process.env.PEERS.split(",")
    : ["http://localhost:5002", "http://localhost:5003"]
};