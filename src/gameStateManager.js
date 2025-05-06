/**
 * @module gameStateManager
 * @description Manages the game state for WikiRace rooms, including state retrieval, broadcasting, and player communication.
 * This module handles the core game state management functionality, including:
 * - Retrieving and formatting game state for rooms
 * - Broadcasting game state updates to players and observers
 * - Managing player and observer communications
 */

const { sendMessageWithQueue } = require('./messageQueue');

// Track the last state version for each room
const roomStateVersions = new Map();

/**
 * @typedef {Object} PlayerData
 * @property {string} name - The player's name
 * @property {string} type - The player's type
 * @property {Array<string>} path - The player's current path
 * @property {Object} additions - The player's current additions
 */

/**
 * @typedef {Object} ObserverData
 * @property {string} name - The observer's name
 * @property {string} type - The observer's type
 */

/**
 * @typedef {Object} RoomConfig
 * @property {boolean} continuation - Whether the game continues after a winner
 * @property {string} chooser - The player who chooses the next addition
 * @property {boolean} additions - Whether additions are enabled
 * @property {boolean} additions_creatorGive - Whether the creator can give additions
 * @property {boolean} additions_obtainWithExposure - Whether additions can be obtained through exposure
 * @property {boolean} additions_obtainWithTimer - Whether additions can be obtained through timer
 * @property {string} additions_application - How additions are applied
 * @property {string} additions_callType - The type of addition call
 * @property {number} additions_timer - The timer duration for additions
 * @property {boolean} additions_multiplePerRound - Whether multiple additions can be used per round
 */

/**
 * @typedef {Object} AdditionState
 * @property {Array<string>} eligiblePlayers - List of players eligible for additions
 * @property {number} currentPlayerIndex - Current player index in the addition queue
 * @property {number} additionEndTime - When the addition period ends
 * @property {Array<string>} readyPlayers - List of players ready for the next addition
 */

/**
 * @typedef {Object} GameState
 * @property {string} id - Room ID
 * @property {string} name - Room name
 * @property {string} state - Current game state
 * @property {string} startUrl - Starting Wikipedia URL
 * @property {string} endUrl - Target Wikipedia URL
 * @property {string} startPreview - Starting Wikipedia preview
 * @property {string} endPreview - Target Wikipedia preview
 * @property {string} creator - Room creator's name
 * @property {Date} createdAt - Room creation timestamp
 * @property {Array<PlayerData>} players - List of players in the room
 * @property {Array<ObserverData>} observers - List of observers in the room
 * @property {Object} surrenderedPlayers - Map of surrendered players and their final state
 * @property {string|null} winner - Current winner (if any)
 * @property {boolean} hasWinner - Whether there is a winner
 * @property {string|null} winnerReason - Reason for the current winner (if any)
 * @property {boolean} hasAdditions - Whether there are active additions
 * @property {string|null} nextAddition - Next addition to be given
 * @property {number} countdownTime - Current countdown time
 * @property {number|null} timerExpired - When the current timer expires
 * @property {number|null} waitingTimerStartTime - When the waiting timer started
 * @property {Object} missedLinks - Map of missed links
 * @property {Object} receivedAdditions - Map of received additions
 * @property {boolean} waitingForPlayers - Whether waiting for player responses
 * @property {Array<string>} continueResponses - List of players who have responded
 * @property {Array<string>} submittedPlayers - List of players who have submitted
 * @property {RoomConfig} config - Room configuration
 * @property {AdditionState|null} additionState - Current addition state (if in handout state)
 */

/**
 * Retrieves the current game state for a room
 * @param {Object} room - The room object containing game state
 * @returns {GameState} The formatted game state
 * @throws {Error} If room is not provided
 */
function getGameState(room) {
    if (!room) {
        throw new Error('Room is required');
    }

    // Increment the state version for this room
    const currentVersion = (roomStateVersions.get(room.id) || 0) + 1;
    roomStateVersions.set(room.id, currentVersion);

    // Calculate remaining time for handout state
    let remainingTime = null;
    if (room.status === 'handout' && room.additionEndTime) {
        remainingTime = Math.max(0, room.additionEndTime - Date.now());
    } else if (room.status === 'waiting' && room.waitingTimerStartTime) {
        remainingTime = Math.max(0, (room.waitingTimerStartTime + (room.countdownTime * 1000)) - Date.now());
    }

    // Ensure all required properties exist
    const state = {
        // Add version tracking
        version: currentVersion,
        
        // Basic room info
        id: room.id,
        name: room.name,
        state: room.status || 'in_lobby',
        startUrl: room.startUrl,
        endUrl: room.endUrl,
        startPreview: room.startPreview || '',
        endPreview: room.endPreview || '',
        creator: room.creator,
        createdAt: room.createdAt,

        // Player data
        players: Array.from(room.players.entries()).map(([name, data]) => ({
            name,
            type: data.type,
            path: data.path || [],
            additions: data.additions || {}
        })),
        observers: Array.from(room.observers.entries()).map(([name, data]) => ({
            name,
            type: data.type
        })),
        surrenderedPlayers: room.surrenderedPlayers ? 
            Object.fromEntries(Array.from(room.surrenderedPlayers.entries()).map(([name, data]) => [
                name,
                {
                    path: data.path,
                    finalUrl: data.finalUrl,
                    surrenderTime: data.surrenderTime
                }
            ])) : {},

        // Game state
        winner: room.winner || null,
        hasWinner: room.hasWinner || false,
        winnerReason: room.winnerReason || null,
        hasAdditions: room.hasAdditions || false,
        nextAddition: room.nextAddition || null,

        // Timers and timing
        countdownTime: room.countdownTime,
        timerExpired: remainingTime,
        waitingTimerStartTime: room.waitingTimerStartTime || null,

        // Player tracking
        missedLinks: Object.fromEntries(room.missedLinks || new Map()),
        receivedAdditions: Object.fromEntries(room.receivedAdditions || new Map()),
        waitingForPlayers: room.waitingForPlayers || false,
        continueResponses: Array.from(room.continueResponses || new Set()),
        submittedPlayers: Array.from(room.submittedPlayers || new Set()),

        // Room configuration
        config: {
            continuation: room.config.continuation,
            chooser: room.config.chooser,
            additions: room.config.additions || {},
            additions_creatorGive: room.config.additions_creatorGive,
            additions_obtainWithExposure: room.config.additions_obtainWithExposure,
            additions_obtainWithTimer: room.config.additions_obtainWithTimer,
            additions_application: room.config.additions_application,
            additions_callType: room.config.additions_callType,
            additions_timer: room.config.additions_timer,
            additions_multiplePerRound: room.config.additions_multiplePerRound
        },

        // Addition-specific state
        additionState: room.status === 'handout' ? {
            eligiblePlayers: room.eligiblePlayers || [],
            currentPlayerIndex: room.currentPlayerIndex || 0,
            additionEndTime: room.additionEndTime || null,
            readyPlayers: Array.from(room.readyToContinue || new Set())
        } : null,

        // Shortest paths data
        shortestpaths: process.env.PATH_API ? (room.shortestpaths === "not-found" ? "not-found" : 
            (room.shortestpaths ? {
                length: room.shortestpaths.length,
                paths: room.shortestpaths.paths,
                example: room.shortestpaths.example
            } : null)) : "disabled"
    };

    // Add ranking when game is finished
    if (room.status === 'finished' && room.ranking) {
        state.ranking = room.ranking.map(player => ({
            name: player.name,
            type: player.type,
            path: player.path || [],
            additions: player.additions || {},
            shortestPathToEnd: player.shortestPathToEnd,
            surrendered: player.surrendered || false,
            surrenderTime: player.surrenderTime
        }));
    }

    return state;
}

/**
 * Broadcasts the current game state to all players and observers in a room
 * @param {Object} room - The room object containing game state
 */
function broadcastGameState(room) {
    const baseGameState = getGameState(room);
    
    // Broadcast to players using message queue
    room.players.forEach((player, playerName) => {
        if (player.ws) {
            try {
                // For players, only include example if game is finished
                const playerState = {
                    ...baseGameState,
                    shortestpaths: baseGameState.shortestpaths === "disabled" ? "disabled" : 
                        (baseGameState.shortestpaths === "not-found" ? "not-found" :
                        (baseGameState.shortestpaths ? {
                            length: baseGameState.shortestpaths.length,
                            paths: baseGameState.shortestpaths.paths,
                            example: room.status === 'finished' ? baseGameState.shortestpaths.example : undefined
                        } : null))
                };
                
                sendMessageWithQueue(
                    playerName,
                    {
                        type: 'game_state',
                        state: playerState
                    },
                    player.ws
                );
            } catch (error) {
                console.error(`Error sending game state to player ${playerName}:`, error);
            }
        }
    });

    // Broadcast to observers using message queue
    room.observers.forEach((observer, observerName) => {
        if (observer.ws) {
            try {
                // For observers, always include the example
                sendMessageWithQueue(
                    observerName,
                    {
                        type: 'game_state',
                        state: baseGameState
                    },
                    observer.ws
                );
            } catch (error) {
                console.error(`Error sending game state to observer ${observerName}:`, error);
            }
        }
    });
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

// Add cleanup function for when rooms are deleted
function cleanupRoom(roomId) {
    roomStateVersions.delete(roomId);
}

module.exports = {
    getGameState,
    broadcastGameState,
    broadcastToAll,
    cleanupRoom
}; 