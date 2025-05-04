/**
 * Handles addition-related messages and state transitions.
 * 
 * Messages received from clients:
 * - player.useAdditionResponse: When a player uses an addition on another player
 *   Input: { 
 *     playerName: string,
 *     selection: { 
 *       type: string,  // 'bomb', 'swap', or 'return'
 *       target: string // target player name
 *     }
 *   }
 *   State: Updates player paths and addition counts
 * 
 * - player.readyToContinue: When a player is ready to continue from the addition phase
 *   Input: { playerName: string }
 *   State: HANDOUT -> RUNNING (when all players are ready)
 * 
 * - creator.giveAddition: When the creator gives an addition to a player
 *   Input: { 
 *     playerName: string,  // creator's name
 *     target: string,      // target player name
 *     additionType: string // type of addition to give
 *   }
 *   State: Updates target player's addition count
 * 
 * Messages sent to clients:
 * - addition_used: When an addition is used
 *   Output: { 
 *     type: "addition_used",
 *     data: {
 *       sender: string,
 *       selection: {
 *         type: string,
 *         target: string
 *       }
 *     }
 *   }
 * 
 * - received_addition: When a player receives an addition
 *   Output: {
 *     type: "received_addition",
 *     additions: [{
 *       type: string,
 *       count: number
 *     }]
 *   }
 * 
 * - select_addition: When a player needs to choose an addition type
 *   Output: {
 *     type: "select_addition",
 *     availableAdditions: string[],
 *     count: number
 *   }
 * 
 * State transitions:
 * - HANDOUT -> RUNNING: When all players are ready to continue
 * - RUNNING -> HANDOUT: When addition phase starts
 */

const { broadcastGameState } = require('../../gameStateManager');
const { GameStates } = require('../gameStates');
const { handleStateChange } = require('./stateHandlers');
const { sendMessageWithQueue, broadcastToAll } = require('../../messageQueue');

const DEBUG = true; // Set to false to disable debug logging

// List of actions this handler handles
const HANDLED_ACTIONS = [
    'player.useAdditionResponse',
    'player.readyToContinue',
    'creator.giveAddition'
];

function handleUseAdditionResponse(room, data) {
    if (DEBUG) console.log(`[additionHandlers] Received useAdditionResponse from ${data.playerName} for ${data.selection.type} on ${data.selection.target}`);
    const { playerName, selection } = data;
    const player = room.players.get(playerName);
    
    if (!player) {
        console.warn(`[additionHandlers] Player ${playerName} not found in room`);
        return;
    }

    // Verify selection is valid
    if (!selection.type || !room.config.additions || !(selection.type in room.config.additions)) {
        console.warn(`[additionHandlers] Invalid addition type ${selection.type} for player ${playerName}`);
        return;
    }

    if (!selection.target || !room.players.has(selection.target)) {
        console.warn(`[additionHandlers] Invalid target player ${selection.target} for addition use by ${playerName}`);
        return;
    }

    // Verify player is eligible to use additions
    if (room.config.additions_callType === 'round_robin') {
        // In round-robin mode, check if this is the current player
        const currentPlayer = room.additionOrder[room.currentPlayerIndex];
        if (playerName !== currentPlayer) {
            console.warn(`[additionHandlers] Player ${playerName} is not the current player in round-robin mode`);
            return;
        }
    } else {
        // In free_for_all mode, check if player is in eligiblePlayers
        if (!room.eligiblePlayers || !room.eligiblePlayers.includes(playerName)) {
            console.warn(`[additionHandlers] Player ${playerName} is not eligible to use additions at this time`);
            return;
        }
    }

    const targetPlayer = room.players.get(selection.target);
    if (!targetPlayer) return;

    // Check if target's recent links are already affected when additions_application is "once"
    if (room.config.additions_application === 'once' && targetPlayer.path.length > 0) {
        const lastLink = targetPlayer.path[targetPlayer.path.length - 1];
        const secondLastLink = targetPlayer.path.length > 1 ? targetPlayer.path[targetPlayer.path.length - 2] : null;
        
        // Only consider a link affected if it has a specific effect from an addition
        const isLastLinkAffected = lastLink.effect && ['bombed', 'swapped', 'returned', 'cancelled'].includes(lastLink.effect);
        const isSecondLastLinkCancelled = secondLastLink && secondLastLink.effect === 'cancelled';
        
        if (isLastLinkAffected || isSecondLastLinkCancelled) {
            console.warn(`[additionHandlers] Cannot apply addition to ${selection.target} - their recent links are already affected`);
            return;
        }
    }

    // Apply addition effects based on type
    switch (selection.type) {
        case 'return':
            if (DEBUG) console.log(`[additionHandlers] Applying return effect for ${playerName} on ${selection.target}`);
            
            if (targetPlayer.path.length > 1) {
                // Mark the latest link as cancelled
                targetPlayer.path[targetPlayer.path.length - 1].effect = 'cancelled';
                if (DEBUG) console.log(`[additionHandlers] Marked last link as cancelled for ${selection.target}`);
                
                // Take the link before the cancelled one and add it to the end
                const previousLink = targetPlayer.path[targetPlayer.path.length - 2];
                const returnedLink = {
                    url: previousLink.url,
                    timestamp: Date.now(),
                    effect: 'returned'
                };
                targetPlayer.path.push(returnedLink);
                if (DEBUG) console.log(`[additionHandlers] Added previous link to end of path for ${selection.target}:`, returnedLink);
            }
            break;

        case 'bomb':
            if (DEBUG) console.log(`[additionHandlers] Applying bomb effect for ${playerName} on ${selection.target}`);
            // Mark the latest link as bombed
            if (targetPlayer.path.length > 0) {
                targetPlayer.path[targetPlayer.path.length - 1].effect = 'bombed';
            }
            break;

        case 'swap':
            if (DEBUG) console.log(`[additionHandlers] Applying swap effect for ${playerName} on ${selection.target}`);
            // Only swap if both players have paths
            if (targetPlayer.path.length > 0 && player.path.length > 0) {
                const targetLastLink = targetPlayer.path[targetPlayer.path.length - 1];
                const playerLastLink = player.path[player.path.length - 1];
                
                // Swap the URLs
                targetPlayer.path[targetPlayer.path.length - 1] = {
                    url: playerLastLink.url,
                    effect: 'swapped'
                };
                player.path[player.path.length - 1] = {
                    url: targetLastLink.url,
                    effect: 'swapped'
                };
            }
            break;
    }

    // Increase target player's received additions counter
    const currentCount = room.receivedAdditions.get(selection.target) || 0;
    room.receivedAdditions.set(selection.target, currentCount + 1);

    // Decrease the sending player's addition count
    player.additions[selection.type]--;

    // Mark player as having used an addition if multiplePerRound is false
    if (!room.config.additions_multiplePerRound) {
        player.usedAddition = true;
        // Remove player from eligible players if in free_for_all mode
        if (room.config.additions_callType === 'free_for_all') {
            room.eligiblePlayers = room.eligiblePlayers.filter(name => name !== playerName);
            
            // Initialize readyToContinue set if it doesn't exist
            if (!room.readyToContinue) {
                room.readyToContinue = new Set();
            }
            
            // Add player to ready set
            room.readyToContinue.add(playerName);
            
            // If all players are ready, continue to running state
            if (room.readyToContinue.size === room.players.size) {
                room.readyToContinue = null;
                if (DEBUG) console.log(`[additionHandlers] All players are ready, moving to RUNNING state`);
                handleStateChange(room, GameStates.RUNNING, data);
                return; // Exit early since we changed state
            }
        }
    }

    // Broadcast the addition usage to all players
    const message = {
        type: 'addition_used',
        data: {
            sender: playerName,
            selection: {
                type: selection.type,
                target: selection.target
            }
        }
    };
    if (DEBUG) console.log(`[additionHandlers] Broadcasting addition used:`, JSON.stringify(message));
    broadcastToAll(room, message);

    // If in round_robin mode and multiplePerRound is false, move to next player
    if (room.config.additions_callType === 'round_robin' && !room.config.additions_multiplePerRound) {
        // Clear existing timer
        if (room.additionTimer) {
            clearTimeout(room.additionTimer);
            room.additionTimer = null;
        }

        room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.additionOrder.length;
        if (room.currentPlayerIndex === 0) {
            // We've gone through all players, move to running state
            if (DEBUG) console.log(`[additionHandlers] All players have used additions, moving to RUNNING state`);
            handleStateChange(room, GameStates.RUNNING, data, true);
        } else {
            // Reset timer for next player
            room.additionEndTime = Date.now() + (room.config.additions_timer * 1000);
            // Start new timer
            room.additionTimer = setTimeout(() => {
                handleAdditionTimerExpired(room, data);
            }, room.config.additions_timer * 1000);
            // Update eligible players to only include current player
            room.eligiblePlayers = [room.additionOrder[room.currentPlayerIndex]];
            if (DEBUG) console.log(`[additionHandlers] Moving to next player: ${room.eligiblePlayers[0]}`);
            // Broadcast the updated state since we didn't change states
            broadcastGameState(room);
        }
    } else {
        // If we didn't change states, broadcast the updated state
        if (DEBUG) console.log(`[additionHandlers] Broadcasting updated state after addition use`);
        broadcastGameState(room);
    }
}

function handleReadyToContinue(room, data) {
    if (DEBUG) console.log(`[additionHandlers] Received readyToContinue from ${data.playerName}`);
    const { playerName } = data;
    const player = room.players.get(playerName);
    
    if (!player) {
        console.warn(`[additionHandlers] Player ${playerName} not found in room`);
        return;
    }

    // Initialize readyToContinue set if it doesn't exist
    if (!room.readyToContinue) {
        room.readyToContinue = new Set();
    }

    // Add player to ready set
    room.readyToContinue.add(playerName);

    if (room.config.additions_callType === 'free_for_all') {
        // In free_for_all mode, check if all players are ready
        if (room.readyToContinue.size === room.players.size) {
            room.readyToContinue = null;
            if (DEBUG) console.log(`[additionHandlers] All players are ready, moving to RUNNING state`);
            handleStateChange(room, GameStates.RUNNING, data);
        } else {
            if (DEBUG) console.log(`[additionHandlers] Not all players are ready yet (${room.readyToContinue.size}/${room.players.size})`);
            // Not all players are ready, broadcast the updated state
            broadcastGameState(room);
        }
    } else { // round_robin mode
        // Clear existing timer
        if (room.additionTimer) {
            clearTimeout(room.additionTimer);
            room.additionTimer = null;
        }

        // Move to next player
        room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.additionOrder.length;
        
        if (room.currentPlayerIndex === 0) {
            // We've gone through all players, move to running state
            if (DEBUG) console.log(`[additionHandlers] All players have used additions, moving to RUNNING state`);
            handleStateChange(room, GameStates.RUNNING, data);
        } else {
            // Reset timer for next player
            room.additionEndTime = Date.now() + (room.config.additions_timer * 1000);
            // Start new timer
            room.additionTimer = setTimeout(() => {
                handleAdditionTimerExpired(room, data);
            }, room.config.additions_timer * 1000);
            // Update eligible players to only include current player
            const currentPlayer = room.additionOrder[room.currentPlayerIndex];
            if (currentPlayer) {
                room.eligiblePlayers = [currentPlayer];
            }
            if (DEBUG) console.log(`[additionHandlers] Moving to next player: ${currentPlayer}`);
            // Broadcast the updated state
            broadcastGameState(room);
        }
    }
}

function handleGiveAddition(room, data) {
    if (DEBUG) console.log(`[additionHandlers] Received giveAddition from ${data.playerName} to ${data.target} for ${data.additionType}`);
    const { playerName, target, additionType } = data;
    
    // Verify this is the creator
    if (playerName !== room.creator) {
        console.warn(`[additionHandlers] Player ${playerName} is not the creator`);
        return;
    }

    // Verify creator can give additions
    if (!room.config.additions_creatorGive) {
        console.warn(`[additionHandlers] Creator giving additions is not enabled for this room`);
        return;
    }

    // Verify target player exists
    const targetPlayer = room.players.get(target);
    if (!targetPlayer) {
        console.warn(`[additionHandlers] Target player ${target} not found in room`);
        return;
    }

    // Verify addition type is valid
    if (!(additionType in room.config.additions)) {
        console.warn(`[additionHandlers] Invalid addition type ${additionType}`);
        return;
    }

    // Initialize additions if not exists
    if (!targetPlayer.additions) {
        targetPlayer.additions = {};
    }

    // Increase the target player's addition count
    targetPlayer.additions[additionType] = (targetPlayer.additions[additionType] || 0) + 1;
    if (DEBUG) console.log(`[additionHandlers] Gave ${additionType} to ${target}, new count: ${targetPlayer.additions[additionType]}`);

    // Broadcast the updated state
    broadcastGameState(room);
}

// Main handler function that routes to specific handlers
function handle(room, data) {
    if (DEBUG) console.log(`[additionHandlers] Handling message:`, JSON.stringify(data));
    switch (data.type) {
        case "player.useAdditionResponse":
            handleUseAdditionResponse(room, data);
            break;
        case "player.readyToContinue":
            handleReadyToContinue(room, data);
            break;
        case "creator.giveAddition":
            handleGiveAddition(room, data);
            break;
        default:
            console.warn(`[additionHandlers] Unknown addition action: ${data.type}`);
    }
}

module.exports = {
    HANDLED_ACTIONS,
    handle
}; 