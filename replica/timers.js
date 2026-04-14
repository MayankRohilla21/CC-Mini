    let electionTimeout;
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