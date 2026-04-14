const express = require("express");
const routes = require("./routes");
const { startRaft } = require("./raft");

const app = express();
app.use(express.json());

app.use("/", routes);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Replica running on port ${PORT}`);
  startRaft(); // start election system
});