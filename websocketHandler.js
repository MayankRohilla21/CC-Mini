const axios = require("axios");
const { getLeader, resetLeader } = require("./replicaManager");

function setupWebSocket(wss) {
    wss.on("connection", (ws) => {
        console.log("Client connected");

        ws.on("message", async (message) => {
            try {
                const parsed = JSON.parse(message);

                if (parsed.type === "stroke") {
                    let leader = await getLeader();

                    if (!leader) {
                        console.log("No leader found");
                        return;
                    }

                    try {
                        // ✅ ADDED LOG
                        console.log("Forwarding stroke to leader:", leader);

                        await axios.post(`${leader}/append-entries`, {
                            stroke: parsed.data
                        });

                    } catch (err) {
                        console.log("Leader failed, retrying...");
                        resetLeader();

                        // retry once
                        leader = await getLeader();

                        if (leader) {
                            // ✅ ADDED LOG (again for retry)
                            console.log("Retrying with new leader:", leader);

                            await axios.post(`${leader}/append-entries`, {
                                stroke: parsed.data
                            });
                        }
                    }
                }

            } catch (err) {
                console.error("Error:", err.message);
            }
        });

        ws.on("close", () => {
            console.log("Client disconnected");
        });
    });
}

module.exports = { setupWebSocket };