// Map to store room cleanup timers
const roomCleanupTimers = new Map();

// Helper function to set a cleanup timer for a room
function setRoomCleanupTimer(roomId, callback) {
    // Clear any existing timer
    if (roomCleanupTimers.has(roomId)) {
        clearTimeout(roomCleanupTimers.get(roomId));
        roomCleanupTimers.delete(roomId);
    }

    // Set new timer
    const timerId = setTimeout(() => {
        console.log(`[Room ${roomId}] Cleanup timer expired`);
        callback();
    }, 30000); // 30 seconds

    roomCleanupTimers.set(roomId, timerId);
    console.log(`[Room ${roomId}] Cleanup timer set for 30 seconds`);
}

// Helper function to clear a room's cleanup timer
function clearRoomCleanupTimer(roomId) {
    if (roomCleanupTimers.has(roomId)) {
        clearTimeout(roomCleanupTimers.get(roomId));
        roomCleanupTimers.delete(roomId);
        console.log(`[Room ${roomId}] Cleanup timer cleared`);
    }
}

module.exports = {
    roomCleanupTimers,
    setRoomCleanupTimer,
    clearRoomCleanupTimer
}; 