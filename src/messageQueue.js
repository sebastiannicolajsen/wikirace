const messageQueues = new Map(); // Map of player name to message queue

// Helper function to queue message for a player
function queueMessage(playerName, message) {
    if (!messageQueues.has(playerName)) {
        messageQueues.set(playerName, new Map());
    }
    const queue = messageQueues.get(playerName);
    
    // Store message by type, overwriting any existing message of the same type
    queue.set(message.type, message);
}

// Helper function to send queued messages to a player
function sendQueuedMessages(playerName, ws) {
    if (messageQueues.has(playerName)) {
        const queue = messageQueues.get(playerName);
        
        // Convert Map to array and send messages
        const messages = Array.from(queue.values());
        while (messages.length > 0) {
            const message = messages.shift();
            try {
                ws.send(JSON.stringify(message));
            } catch (error) {
                // Put the message back in the queue
                queue.set(message.type, message);
                break;
            }
        }
        
        if (queue.size === 0) {
            messageQueues.delete(playerName);
        }
    }
}

/**
 * Sends a message to a player, queuing it if the WebSocket is not available
 * @param {string} playerName - The name of the player
 * @param {Object} message - The message to send
 * @param {WebSocket} ws - The WebSocket connection
 */
function sendMessageWithQueue(playerName, message, ws) {
    if (ws && ws.readyState === 1) {
        try {
            ws.send(JSON.stringify(message));
        } catch (error) {
            queueMessage(playerName, message);
        }
    } else {
        queueMessage(playerName, message);
    }
}

/**
 * Broadcasts a message to all players and observers in a room, with message queue backup
 * @param {Object} room - The room object
 * @param {Object} message - The message to broadcast
 */
function broadcastToAll(room, message) {
    // Broadcast to players
    room.players.forEach((player, playerName) => {
        sendMessageWithQueue(
            playerName,
            message,
            player.ws
        );
    });

    // Broadcast to observers
    room.observers.forEach((observer, observerName) => {
        sendMessageWithQueue(
            observerName,
            message,
            observer.ws
        );
    });
}

module.exports = {
    queueMessage,
    sendQueuedMessages,
    sendMessageWithQueue,
    messageQueues,
    broadcastToAll
}; 