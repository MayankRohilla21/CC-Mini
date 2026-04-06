const axios = require("axios");

// Update ports if your team uses different ones
const replicas = [
    "http://localhost:5001",
    "http://localhost:5002",
    "http://localhost:5003"
];

let currentLeader = null;

async function getLeader() {
    if (currentLeader) return currentLeader;

    console.log("Searching for leader...");

    for (let replica of replicas) {
        try {
            const res = await axios.get(`${replica}/leader`);

            if (res.data.isLeader) {
                currentLeader = replica;
                console.log("Leader found:", replica);
                return replica;
            }

        } catch (err) {
            // ignore dead replicas
        }
    }

    return null;
}

function resetLeader() {
    // ✅ ADDED LOG
    console.log("Resetting leader...");
    currentLeader = null;
}

module.exports = { getLeader, resetLeader };