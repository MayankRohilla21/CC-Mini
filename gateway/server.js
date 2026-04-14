const WebSocket = require("ws");
const axios = require("axios");

const PORT = 8080;

// RAFT replicas
const replicas = [
  "http://localhost:5001",
  "http://localhost:5002",
  "http://localhost:5003",
];

// WebSocket server
const wss = new WebSocket.Server({ port: PORT });

let clients = new Set();

console.log(`[Gateway] Running on ws://localhost:${PORT}`);

/**
 * FIND CURRENT LEADER
 */
async function findLeader() {
  for (let replica of replicas) {
    try {
      const res = await axios.get(`${replica}/leader`);

      if (res.data.state === "LEADER") {
        return replica;
      }
    } catch (err) {}
  }

  return null;
}

/**
 * BROADCAST TO ALL CLIENTS
 */
function broadcast(message) {
  for (let client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}

/**
 * HANDLE NEW CLIENT CONNECTION
 */
wss.on("connection", (ws) => {
  console.log("[Gateway] Client connected");

  clients.add(ws);

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === "stroke") {
        console.log("[Gateway] Stroke received from client");

        // Step 1: find leader
        const leader = await findLeader();

        if (!leader) {
          console.log("[Gateway] No leader found");
          return;
        }

        try {
          // Step 2: send stroke to leader
          const res = await axios.post(`${leader}/stroke`, message.data);

          // Step 3: broadcast commit
          if (res.data.success) {
            console.log("[Gateway] Broadcasting committed stroke");

            broadcast({
              type: "commit",
              data: res.data.entry,
            });
          }

        } catch (err) {
          console.log("[Gateway] Error sending to leader");

          // Leader might have changed → retry once
          const newLeader = await findLeader();

          if (newLeader) {
            const res = await axios.post(`${newLeader}/stroke`, message.data);

            if (res.data.success) {
              broadcast({
                type: "commit",
                data: res.data.entry,
              });
            }
          }
        }
      }

    } catch (err) {
      console.error("[Gateway] Invalid message:", err);
    }
  });

  ws.on("close", () => {
    console.log("[Gateway] Client disconnected");
    clients.delete(ws);
  });
});