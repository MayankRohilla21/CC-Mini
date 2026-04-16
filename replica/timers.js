/*    let electionTimeout;
    let heartbeatInterval;

    let electionCallback = null;

    function setElectionCallback(cb) {
    electionCallback = cb;
    }

    function randomTimeout() {
    return Math.floor(Math.random() * 300) + 500;
    }

    function resetElectionTimer() {
    clearTimeout(electionTimeout);

    if (!electionCallback) {
        console.error("Election callback not set!");
        return;
    }

    electionTimeout = setTimeout(() => {
        electionCallback();
    }, randomTimeout());
    }

    function startHeartbeat(callback) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(callback, 150);
    }

    function stopHeartbeat() {
    clearInterval(heartbeatInterval);
    }

    function stopElectionTimer() {
    clearTimeout(electionTimeout);
    }

    module.exports = {
    resetElectionTimer,
    startHeartbeat,
    stopHeartbeat,
    setElectionCallback,
    stopElectionTimer,
    };

    */

let electionTimeout;
let heartbeatInterval;
let electionCallback = null;

function setElectionCallback(cb) {
    electionCallback = cb;
}

function randomTimeout() {
    return Math.floor(Math.random() * 300) + 500; // 500–800ms
}
function resetElectionTimer() {
    clearTimeout(electionTimeout);

    if (!electionCallback) {
        console.error("Election callback not set!");
        return;
    }

    const timeout = randomTimeout();
    console.log(`[TIMER] Reset election timer: ${timeout}ms`);

    electionTimeout = setTimeout(() => {
        console.log("[TIMER] Election timeout reached");
        electionCallback();
    }, timeout);
}

function startHeartbeat(callback) {
    clearInterval(heartbeatInterval);

    heartbeatInterval = setInterval(() => {
        callback();
    }, 150);
}

function stopHeartbeat() {
    clearInterval(heartbeatInterval);
}

function stopElectionTimer() {
    clearTimeout(electionTimeout);
}

module.exports = {
    resetElectionTimer,
    startHeartbeat,
    stopHeartbeat,
    setElectionCallback,
    stopElectionTimer,
};