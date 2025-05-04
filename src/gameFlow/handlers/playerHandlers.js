/**
 * Handles player-specific messages and state transitions.
 * 
 * Messages received from clients:
 * - player.continueGame: When a player wants to continue the game
 *   Input: { playerName: string }
 *   State: WAITING -> HANDOUT (when all players continue)
 *   Note: Only works when democratic continuation is enabled
 * 
 * - player.surrender: When a player wants to surrender from the game
 *   Input: { playerName: string }
 *   State: Any -> Removes player from active players
 * 
 * - player.allSelected: When all players have selected their links
 *   Input: { playerName: string }
 *   State: WAITING -> PAUSED
 * 
 * - player.joined: When a player joins the game
 *   Input: { playerName: string, playerType: string }
 *   State: Updates player list
 * 
 * - player.left: When a player leaves the game
 *   Input: { playerName: string }
 *   State: Removes player from game
 * 
 * State transitions:
 * - WAITING -> HANDOUT: When all players have chosen to continue (democratic)
 * - Any state: When a player surrenders, they are removed from active players
 *   and added to surrendered players list with their final path
 */

const { broadcastGameState } = require('../../gameStateManager');
const { GameStates } = require('../gameStates');
const { stateChangeManager } = require('./stateHandlers');

// List of actions this handler handles
const HANDLED_ACTIONS = [
    'player.continueGame',
    'player.surrender',
    'player.allSelected',
    'player.joined',
    'player.left'
];

function handleContinueGame(room, data) {
    const { playerName } = data;
    
    // Verify this is a player
    const player = room.players.get(playerName);
    if (!player) {
        console.warn(`Player ${playerName} not found`);
        return;
    }

    // Verify we're waiting for player responses
    if (!room.waitingForPlayers) {
        console.warn("Not waiting for player responses");
        return;
    }

    // Verify democratic continuation is enabled
    if (room.config.continuation !== "democratic") {
        console.warn("Democratic continuation is not enabled");
        return;
    }

    // Initialize continueResponses if not exists
    if (!room.continueResponses) {
        room.continueResponses = new Set();
    }

    // Add this player's response
    room.continueResponses.add(playerName);

    // Check if all players have responded
    if (room.continueResponses.size === room.players.size) {
        // All players have responded, continue to handout state
        room.waitingForPlayers = false;
        room.continueResponses = null;
        stateChangeManager.changeState(room, GameStates.HANDOUT, data);
    } else {
        // Still waiting for more responses
        broadcastGameState(room);
    }
}

function handleSurrender(room, data) {
    const { playerName } = data;
    
    // Verify this is a player
    const player = room.players.get(playerName);
    if (!player) {
        console.warn(`Player ${playerName} not found`);
        return;
    }

    // Verify we're in a valid state for surrender
    if (room.status !== GameStates.RUNNING && room.status !== GameStates.WAITING) {
        console.warn(`Cannot surrender in state ${room.status}`);
        return;
    }

    // Initialize surrendered players map if it doesn't exist
    if (!room.surrenderedPlayers) {
        room.surrenderedPlayers = new Map();
    }

    // Mark the last link as surrendered
    if (player.path.length > 0) {
        const lastLink = player.path[player.path.length - 1];
        lastLink.effect = "surrender";
    }

    // Store the player's final state in surrendered players
    room.surrenderedPlayers.set(playerName, {
        path: [...player.path],
        finalUrl: player.currentUrl,
        surrenderTime: Date.now()
    });

    // Add player as observer before removing from active players
    room.observers.set(playerName, {
        type: 'observer',
        ws: player.ws
    });

    // Remove player from active players
    room.players.delete(playerName);

    // If this was the creator, update the creator
    if (playerName === room.creator && room.players.size > 0) {
        room.creator = Array.from(room.players.keys())[0];
    }

    // If this was the last player, end the game with the last surrendered player as winner
    if (room.players.size === 0) {
        stateChangeManager.changeState(room, GameStates.FINISHED, {
            ...data,
            winner: playerName,
            reason: "last_player_surrendered"
        });
        return;
    }

    // If this was the second-to-last player, end the game with the remaining player as winner
    if (room.players.size === 1) {
        const remainingPlayer = Array.from(room.players.keys())[0];
        stateChangeManager.changeState(room, GameStates.FINISHED, {
            ...data,
            winner: remainingPlayer,
            reason: "last_player_standing"
        });
        return;
    }

    // If we were waiting for this player's response, remove them from the waiting list
    if (room.waitingForPlayers && room.submittedPlayers) {
        room.submittedPlayers.delete(playerName);
    }
    if (room.continueResponses) {
        room.continueResponses.delete(playerName);
    }

    // Broadcast the updated game state
    broadcastGameState(room);
}

// Main handler function that routes to specific handlers
function handle(room, data) {
    switch (data.type) {
        case 'player.continueGame':
            handleContinueGame(room, data);
            break;
        case 'player.surrender':
            handleSurrender(room, data);
            break;
        default:
            console.warn(`Unknown player action: ${data.type}`);
    }
}

module.exports = {
    HANDLED_ACTIONS,
    handle
}; 