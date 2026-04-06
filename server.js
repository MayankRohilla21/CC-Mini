const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const { setupWebSocket } = require("./websocketHandler");

const app = express();
app.use(express.json());

const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server });

// Attach WebSocket logic
setupWebSocket(wss);

// Health check
app.get("/", (req, res) => {
    res.send("Gateway is running");
});

// Endpoint: replicas send committed strokes here
app.post("/commit-stroke", (req, res) => {
    const stroke = req.body;

    console.log("Received committed stroke:", stroke);

    // Broadcast to all clients
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: "stroke",
                data: stroke
            }));
        }
    });

    res.send({ status: "ok" });
});

server.listen(3000, () => {
    console.log("Gateway running on port 3000");
});