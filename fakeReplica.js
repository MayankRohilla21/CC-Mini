// fakeReplica.js
/*
const express = require("express");
const app = express();

app.use(express.json());

app.get("/leader", (req, res) => {
    res.send({ isLeader: true });
});

app.post("/append-entries", (req, res) => {
    console.log("Received stroke:", req.body);

    // simulate commit back to gateway
    const axios = require("axios");

    axios.post("http://localhost:3000/commit-stroke", req.body.stroke);

    res.send({ status: "ok" });
});

app.listen(5001, () => console.log("Fake leader running"));
*/