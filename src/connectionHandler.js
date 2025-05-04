const { broadcastGameState } = require('./gameStateManager');
const { sendQueuedMessages, messageQueues } = require('./messageQueue');
const { getRoom, isRoomEmpty, deleteRoom, roomCleanupTimers, setRoomCleanupTimer, clearRoomCleanupTimer } = require('./roomManager');
const { sendMessageWithQueue } = require('./messageQueue');
const { GameStates } = require('./gameFlow/gameStates');

// Debug flag for connection logging
const DEBUG_CONNECTIONS = false;

/**
 * Connection Handler Module
 * 
 * This module handles WebSocket connections and messages for the WikiRace game.
 * It processes the following types of messages:
 * 
 * 1. Initial Connection ("join"):
 *    - playerName: string - Name of the player
 *    - playerType: string - Either 'player' or 'observer'
 * 
 * 2. Leave ("leave"):
 *    - type: string - Message type
 *    - playerName: string - Name of the player sending the message
 * 
 * The module manages:
 * - New player connections
 * - Player reconnections
 * - Player disconnections
 * - Room cleanup
 * - Game state broadcasting
 */

// Function to handle initial connection and validation
function handleInitialConnection(ws, roomId, data) {
    const room = getRoom(roomId);
    if (!room) {
        if (DEBUG_CONNECTIONS) console.log(`[Room ${roomId}] Connection attempt failed: Room not found`);
        ws.close(1000, 'Room not found');
        return;
    }

    const { playerName, playerType } = data;
    
    if (!playerName) {
        if (DEBUG_CONNECTIONS) console.log(`[Room ${roomId}] Connection attempt failed: Player name is required`);
        ws.close(1000, 'Player name is required');
        return;
    }

    // Check if player is reconnecting (has no active WebSocket)
    if (room.players.has(playerName)) {
        const playerData = room.players.get(playerName);
        if (!playerData.ws) {
            if (DEBUG_CONNECTIONS) console.log(`[Room ${roomId}] Player reconnecting: ${playerName}`);
            return {
                playerName,
                isObserver: false,
                isReconnecting: true
            };
        }
    }

    if (room.observers.has(playerName)) {
        const observerData = room.observers.get(playerName);
        if (!observerData.ws) {
            if (DEBUG_CONNECTIONS) console.log(`[Room ${roomId}] Observer reconnecting: ${playerName}`);
            return {
                playerName,
                isObserver: true,
                isReconnecting: true
            };
        }
    }

    // Check if player is joining as new
    if (playerType === 'player' || playerType === 'observer') {
        // Reject new player connections if game is not in lobby state
        if (playerType === 'player' && room.status !== GameStates.LOBBY) {
            if (DEBUG_CONNECTIONS) console.log(`[Room ${roomId}] New player connection rejected: Game is not in lobby state`);
            ws.close(1000, 'Cannot join game in progress');
            return null;
        }
        
        if (DEBUG_CONNECTIONS) console.log(`[Room ${roomId}] New ${playerType} joining: ${playerName}`);
        return {
            playerName,
            isObserver: playerType === 'observer',
            isReconnecting: false
        };
    }

    // Invalid connection attempt
    if (DEBUG_CONNECTIONS) console.log(`[Room ${roomId}] Invalid connection attempt from ${playerName}: Invalid player type`);
    ws.close(1000, 'Invalid connection attempt');
    return null;
}

// Function to handle connection and delegate to appropriate handler
function handleConnection(ws, roomId, data) {
    const room = getRoom(roomId);
    if (!room) {
        if (DEBUG_CONNECTIONS) console.log(`[Room ${roomId}] Connection attempt failed: Room not found`);
        return false;
    }

    // Handle leave message
    if (data.type === 'leave') {
        handleWebSocketClose(roomId, ws, true);
        return null;
    }

    // Get connection result
    const connectionResult = handleInitialConnection(ws, room.id, data);
    if (!connectionResult) return null;

    // Handle reconnection
    if (connectionResult.isReconnecting) {
        const reconnectionResult = handlePlayerReconnection(
            ws, 
            room, 
            connectionResult.playerName, 
            connectionResult.isObserver
        );
        
        if (reconnectionResult === false) {
            ws.close(1000, "Player name already taken");
            return null;
        }
        
        // Clear any existing cleanup timer when someone connects
        if (roomCleanupTimers.has(room.id)) {
            clearTimeout(roomCleanupTimers.get(room.id));
            roomCleanupTimers.delete(room.id);
        }
        
        // Broadcast updated state to all players, including the new connection
        broadcastGameState(room);

        // Send any queued messages after the initial state is sent
        if (messageQueues.has(connectionResult.playerName)) {
            if (DEBUG_CONNECTIONS) console.log(`[${room.id}] Sending queued messages to ${connectionResult.playerName} after initial state`);
            sendQueuedMessages(connectionResult.playerName, ws);
        }
        
        return {
            playerName: connectionResult.playerName,
            isObserver: connectionResult.isObserver
        };
    }

    // Handle new player joining
    handleNewPlayerJoin(ws, room, connectionResult.playerName, connectionResult.isObserver ? 'observer' : 'player');
    
    // Clear any existing cleanup timer when someone connects
    if (roomCleanupTimers.has(room.id)) {
        clearTimeout(roomCleanupTimers.get(room.id));
        roomCleanupTimers.delete(room.id);
    }
    
    // Broadcast updated state to all players, including the new connection
    broadcastGameState(room);

    // Send any queued messages after the initial state is sent
    if (messageQueues.has(connectionResult.playerName)) {
        if (DEBUG_CONNECTIONS) console.log(`[${room.id}] Sending queued messages to ${connectionResult.playerName} after initial state`);
        sendQueuedMessages(connectionResult.playerName, ws);
    }
    
    return connectionResult;
}

// Function to handle player reconnection
function handlePlayerReconnection(ws, room, playerName, isObserver) {
    const playerData = isObserver ? room.observers.get(playerName) : room.players.get(playerName);
    if (playerData) {
        // Check if player already has an active WebSocket connection
        if (playerData.ws && playerData.ws.readyState === WebSocket.OPEN) {
            if (DEBUG_CONNECTIONS) console.log(`[Room ${room.id}] Reconnection rejected: ${playerName} already has an active connection`);
            return false;
        }

        // Cancel any existing reconnection timer
        if (room.reconnectTimers && room.reconnectTimers.has(playerName)) {
            clearTimeout(room.reconnectTimers.get(playerName));
            room.reconnectTimers.delete(playerName);
            if (DEBUG_CONNECTIONS) console.log(`[Room ${room.id}] Cleared reconnection timer for ${playerName}`);
        }

        playerData.ws = ws;
        if (DEBUG_CONNECTIONS) console.log(`[Room ${room.id}] ${isObserver ? 'Observer' : 'Player'} reconnected: ${playerName}`);
        broadcastGameState(room);

        // Send any queued messages after successful reconnection
        if (messageQueues.has(playerName)) {
            if (DEBUG_CONNECTIONS) console.log(`[Room ${room.id}] Sending queued messages to ${playerName} after reconnection`);
            sendQueuedMessages(playerName, ws);
        }

        return true;
    }
    return false;
}

// Function to handle new player joining
function handleNewPlayerJoin(ws, room, playerName, playerType) {
    // Add player to room
    const playerData = {
        type: playerType,
        ws: ws,
        path: [],
        additions: {},
        continued: false
    };

    if (playerType === 'player') {
        room.players.set(playerName, playerData);
        if (DEBUG_CONNECTIONS) console.log(`[Room ${room.id}] New player joined: ${playerName}`);
    } else {
        room.observers.set(playerName, playerData);
        if (DEBUG_CONNECTIONS) console.log(`[Room ${room.id}] New observer joined: ${playerName}`);
    }

    // Clear cleanup timer since room is no longer empty
    clearRoomCleanupTimer(room.id);

    // Broadcast updated state to all players
    broadcastGameState(room);
}

// Function to handle player leaving
function handlePlayerLeave(room, playerName, playerType) {
    if (playerType === 'player') {
        room.players.delete(playerName);
        if (DEBUG_CONNECTIONS) console.log(`[Room ${room.id}] Player left: ${playerName}`);
    } else {
        room.observers.delete(playerName);
        if (DEBUG_CONNECTIONS) console.log(`[Room ${room.id}] Observer left: ${playerName}`);
    }

    // Check if room should be shut down
    if (playerName === room.creator) {
        if (DEBUG_CONNECTIONS) console.log(`[Room ${room.id}] Creator left, kicking all players and closing room`);
        // Kick all players and observers except the creator
        const allPlayers = [...room.players.keys(), ...room.observers.keys()];
        allPlayers.forEach(playerName => {
            const player = room.players.get(playerName) || room.observers.get(playerName);
            if (player && playerName !== room.creator) {
                if (DEBUG_CONNECTIONS) console.log(`[Room ${room.id}] Sending kick message to ${playerName}`);
                sendMessageWithQueue(playerName, {
                    type: 'player_kicked',
                    playerName: playerName,
                    reason: 'Room closed by creator'
                }, player.ws);
            }
        });
        // Delete the room
        deleteRoom(room.id);
    } else if (isRoomEmpty(room)) {
        if (DEBUG_CONNECTIONS) console.log(`[Room ${room.id}] Room is empty, setting cleanup timer`);
        // Set cleanup timer for empty room
        setRoomCleanupTimer(room.id);
    }

    broadcastGameState(room);
}

// Function to handle WebSocket close
function handleWebSocketClose(roomId, ws, intentional = false) {
    // check if room exists
    const room = getRoom(roomId);
    if (!room) {
        if (DEBUG_CONNECTIONS) console.log(`[Room ${roomId}] disconnect attempt failed: Room not found`);
        return;
    }
    
    // Find player with this WebSocket
    let playerName = null;
    let playerType = null;

    room.players.forEach((data, name) => {
        if (data.ws === ws) {
            playerName = name;
            playerType = data.type;
            // Clear the WebSocket reference immediately
            data.ws = null;
        }
    });

    if (!playerName) {
        room.observers.forEach((data, name) => {
            if (data.ws === ws) {
                playerName = name;
                playerType = data.type;
                // Clear the WebSocket reference immediately
                data.ws = null;
            }
        });
    }

    if (playerName) {
        // Check if this was an intentional disconnect by parsing the close reason
        try {
            const closeReason = JSON.parse(ws.closeReason);
            if (closeReason.intentional && closeReason.playerName === playerName) {
                intentional = true;
            }
        } catch (e) {
            // If parsing fails, use the provided intentional parameter
        }

        if (intentional) {
            // If intentional, remove the player immediately
            if (DEBUG_CONNECTIONS) console.log(`[Room ${room.id}] Intentional disconnect: ${playerName}`);
            handlePlayerLeave(room, playerName, playerType);
        } else {
            // For unintentional disconnects, only set a reconnection timer if there isn't one already
            if (!room.reconnectTimers || !room.reconnectTimers.has(playerName)) {
                if (DEBUG_CONNECTIONS) console.log(`[Room ${room.id}] Unintentional disconnect: ${playerName}, setting reconnection timer`);
                const timerId = setTimeout(() => {
                    // Only remove the player if they haven't reconnected
                    if (room.players.has(playerName) && !room.players.get(playerName).ws) {
                        if (DEBUG_CONNECTIONS) console.log(`[Room ${room.id}] Reconnection timer expired for ${playerName}, removing from game`);
                        handlePlayerLeave(room, playerName, playerType);
                    }
                }, 30000); // 30 seconds

                // Store the timer ID in the room for potential cancellation
                if (!room.reconnectTimers) {
                    room.reconnectTimers = new Map();
                }
                room.reconnectTimers.set(playerName, timerId);
            } else {
                if (DEBUG_CONNECTIONS) console.log(`[Room ${room.id}] Unintentional disconnect: ${playerName}, reconnection timer already exists`);
            }
        }
    }
}

module.exports = {
    handleInitialConnection,
    handleConnection,
    handlePlayerReconnection,
    handleNewPlayerJoin,
    handlePlayerLeave,
    handleWebSocketClose
}; 