const WebSocket = require("ws");
const axios = require("axios");
const express = require("express");
const logger = require("./logger");

const WS_PORT = Number(process.env.GATEWAY_WS_PORT || 8080);
const HEALTH_PORT = Number(process.env.GATEWAY_HEALTH_PORT || 8081);

const replicas = (process.env.PEERS || "http://localhost:5001,http://localhost:5002,http://localhost:5003")
  .split(",")
  .map((peer) => peer.trim())
  .filter(Boolean);

const wss = new WebSocket.Server({ port: WS_PORT });
const app = express();

let clients = new Set();

logger.info("GATEWAY_WS_STARTED", { wsPort: WS_PORT, replicas });

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    clients: clients.size,
    replicas,
  });
});

app.listen(HEALTH_PORT, () => {
  logger.info("GATEWAY_HEALTH_STARTED", { healthPort: HEALTH_PORT });
});

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
    } catch (_err) {}
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
  logger.info("CLIENT_CONNECTED", { totalClients: clients.size + 1 });

  clients.add(ws);

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === "stroke") {
        logger.info("STROKE_RECEIVED", { totalClients: clients.size });

        const leader = await findLeader();

        if (!leader) {
          logger.warn("NO_LEADER_FOUND");
          return;
        }

        try {
          const res = await axios.post(`${leader}/stroke`, message.data);

          if (res.data.success) {
            broadcast({
              type: "commit",
              data: res.data.entry,
            });
            logger.info("COMMIT_BROADCASTED", { leader, clients: clients.size });
          }
        } catch (err) {
          logger.warn("LEADER_SEND_FAILED_RETRYING", { leader, error: err.message });
          const newLeader = await findLeader();

          if (newLeader) {
            const res = await axios.post(`${newLeader}/stroke`, message.data);

            if (res.data.success) {
              broadcast({
                type: "commit",
                data: res.data.entry,
              });
              logger.info("COMMIT_BROADCASTED_AFTER_RETRY", { newLeader, clients: clients.size });
            }
          } else {
            logger.error("RETRY_FAILED_NO_LEADER");
          }
        }
      }
    } catch (err) {
      logger.error("INVALID_CLIENT_MESSAGE", { error: err.message });
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    logger.info("CLIENT_DISCONNECTED", { totalClients: clients.size });
  });
});