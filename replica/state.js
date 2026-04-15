let state = "FOLLOWER"; // FOLLOWER | CANDIDATE | LEADER

let currentTerm = 0;
let votedFor = null;
let leaderId = null;

function setState(newState) {
  state = newState;
  console.log(`[STATE] Transition → ${newState}`);
}

function incrementTerm() {
  currentTerm++;
  votedFor = null;
}

function setTerm(term) {
  if (term > currentTerm) {
    currentTerm = term;
    votedFor = null;
  }
}

function voteFor(candidateId) {
  votedFor = candidateId;
}

function setLeader(id) {
  leaderId = id;
}

module.exports = {
  getState: () => state,
  setState,
  getTerm: () => currentTerm,
  incrementTerm,
  setTerm,
  voteFor,
  getVotedFor: () => votedFor,
  setLeader,
  getLeader: () => leaderId,
};