const log = require("./log");

// simulate term
const currentTerm = 1;

// add some entries
log.appendEntry(currentTerm, { type: "stroke", data: { x: 10, y: 20 } });
log.appendEntry(currentTerm, { type: "stroke", data: { x: 30, y: 40 } });

console.log("Last Index:", log.getLastLogIndex());
console.log("Last Term:", log.getLastLogTerm());

// commit entries
log.commit(2);

// apply entries
const applied = log.getUnappliedEntries();
console.log("Applied entries:", applied);