/**
 * Handles creator-specific messages and state transitions.
 * 
 * Messages received from clients:
 * - creator.startGame: When the creator wants to start the game
 *   Input: { startUrl: string, endUrl: string }
 * 
 * - creator.kickUser: When the creator wants to remove a player
 *   Input: { playerName: string }
 * 
 * - creator.restartGame: When the creator wants to restart the game
 *   Input: {}
 * 
 * - creator.continueGame: When the creator wants to continue the game
 *   Input: { playerName: string }
 *   Note: Only works when creator continuation is enabled
 * 
 * State transitions:
 * - LOBBY -> RUNNING: When game starts
 * - RUNNING -> LOBBY: When game restarts
 * - WAITING -> HANDOUT: When creator chooses to continue (only if creator continuation is enabled)
 */

const { broadcastGameState } = require('../../gameStateManager');
const { GameStates } = require('../gameStates');
const { stateChangeManager } = require('./stateHandlers');
const { handlePlayerLeave } = require('../../connectionHandler');

// List of actions this handler handles
const HANDLED_ACTIONS = [
    'creator.startGame',
    'creator.kickUser',
    'creator.restartGame',
    'creator.continueGame'
];

function handleStartGame(room, data) {
    // Get URLs from room state
    const { startUrl, endUrl } = room;
    
    // Validate URLs
    if (!startUrl || !endUrl) {
        console.warn('Start and end URLs are required to start the game');
        return;
    }

    // Start the game
    stateChangeManager.changeState(room, GameStates.RUNNING, {
        startUrl,
        endUrl,
        currentUrl: startUrl
    });
}

function handleKickUser(room, data) {
    const { playerName } = data;
    
    // Find player type
    const playerType = room.players.has(playerName) ? 'player' : 'observer';
    
    // Send kicked message to the player
    const player = room.players.get(playerName) || room.observers.get(playerName);
    if (player && player.ws) {
        player.ws.send(JSON.stringify({
            type: 'player_kicked',
            playerName: playerName,
            reason: 'player kicked by creator'
        }));
    }
    
    // Use connectionHandler to remove the player
    handlePlayerLeave(room, playerName, playerType);
}

function handleRestartGame(room, data) {
    stateChangeManager.changeState(room, GameStates.LOBBY, data);
}

function handleContinueGame(room, data) {
    const { playerName } = data;
    
    // Verify this is the creator
    if (playerName !== room.creator) {
        console.warn(`Player ${playerName} is not the creator`);
        return;
    }

    // Verify creator continuation is enabled
    if (room.config.continuation !== "creator") {
        console.warn("Creator continuation is not enabled");
        return;
    }

    // Continue to handout state
    room.waitingForCreator = false;
    stateChangeManager.changeState(room, GameStates.HANDOUT, data);
}

// Main handler function that routes to specific handlers
function handle(room, data) {
    switch (data.type) {
        case 'creator.startGame':
            handleStartGame(room, data);
            break;
        case 'creator.kickUser':
            handleKickUser(room, data);
            break;
        case 'creator.restartGame':
            handleRestartGame(room, data);
            break;
        case 'creator.continueGame':
            handleContinueGame(room, data);
            break;
        default:
            console.warn(`Unknown creator action: ${data.type}`);
    }
}

module.exports = {
    HANDLED_ACTIONS,
    handle
};
