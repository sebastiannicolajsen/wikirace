const DEBUG = true; // Set to false to disable debug logging

/**
 * @typedef {Object} PlayerData
 * @property {string} name - The player's name
 * @property {string} type - The player's type
 * @property {Array<PathEntry>} path - The player's current path
 * @property {Object} additions - The player's current additions
 */

/**
 * @typedef {Object} PathEntry
 * @property {string} url - The Wikipedia URL for this path entry
 * @property {number} timestamp - When this URL was added to the path
 * @property {string} [effect] - Optional effect for this path entry (e.g. 'start', 'end', 'addition')
 */

/**
 * @typedef {Object} ObserverData
 * @property {string} name - The observer's name
 * @property {string} type - The observer's type
 */

/**
 * Handles game state transitions and state-specific logic.
 * 
 * Messages received from clients:
 * - player.continueGame: When a player wants to continue the game
 *   Input: { playerName: string }
 * 
 * Messages sent to clients:
 * - request_continue_game: When waiting for players to continue
 *   Output: { type: "request_continue_game" }
 * 
 * State-specific variables and messages:
 * 
 * LOBBY:
 * - Sets: winner = null, hasWinner = false, currentUrl = null, hasAdditions = false, nextAddition = null
 * - Resets: players array, additionRound = 0, additionOrder = [], usedAdditions = new Set()
 * 
 * RUNNING:
 * - Sets: hasAdditions = true, nextAddition = null, waitingForPlayers = false
 * - Distributes: Initial additions if from LOBBY, ongoing additions if from HANDOUT
 * 
 * WAITING:
 * - Sets: waitingForPlayers = true, submittedPlayers = new Set()
 * - Starts: waitingTimer with countdownTime duration
 * - Sends: request_random_url or request_random_urls to missing players when timer expires
 * 
 * PAUSED:
 * - Clears: waitingTimer
 * - Sets: waitingForPlayers = true, continueResponses = new Set()
 * - Sends: request_continue_game to creator (if creatorContinue) or all players (if democraticContinue)
 * 
 * HANDOUT:
 * - Sets: eligiblePlayers based on additions_callType
 * - Starts: additionTimer with additions_timer duration
 * - Updates: eligiblePlayers based on additions_multiplePerRound
 * 
 * FINISHED:
 * - Sets: winner, hasWinner = true, hasAdditions = false, nextAddition = null
 * - Clears: waitingTimer
 * 
 * State transitions:
 * - LOBBY -> RUNNING: When game starts
 * - RUNNING -> WAITING: When players need to select links
 * - WAITING -> PAUSED: When all players have submitted their links
 * - PAUSED -> HANDOUT: When game continues to addition phase
 * - HANDOUT -> RUNNING: When addition phase ends
 * - RUNNING -> FINISHED: When a player reaches the end URL
 * - FINISHED -> LOBBY: When game ends
 */

const { broadcastGameState } = require("../../gameStateManager");
const { GameStates } = require("../gameStates");
const { sendMessageWithQueue } = require("../../messageQueue");

// Define valid state transitions
const StateTransitions = {
    [GameStates.LOBBY]: [GameStates.RUNNING],
    [GameStates.RUNNING]: [GameStates.WAITING, GameStates.FINISHED],
    [GameStates.WAITING]: [GameStates.PAUSED, GameStates.FINISHED, GameStates.HANDOUT, GameStates.RUNNING],
    [GameStates.PAUSED]: [GameStates.HANDOUT, GameStates.RUNNING],
    [GameStates.HANDOUT]: [GameStates.RUNNING],
    [GameStates.FINISHED]: [GameStates.LOBBY]
};

// Validate state transition
function isValidStateTransition(currentState, newState) {
    return StateTransitions[currentState]?.includes(newState) || false;
}

/**
 * Distributes initial additions to all players based on room configuration
 * @param {Object} room - The room object
 */
function distributeInitialAdditions(room) {
    // Skip if no additions are configured
    if (!room.config.additions || Object.keys(room.config.additions).length === 0) {
        return;
    }

    // Initialize additions for each player
    Array.from(room.players.keys()).forEach(playerName => {
        const player = room.players.get(playerName);
        if (!player.additions) {
            player.additions = {};
        }

        // Only distribute addition types that were explicitly selected
        Object.entries(room.config.additions).forEach(([type, amount]) => {
            if (amount !== undefined) {  // Only create entry if amount was explicitly set
                player.additions[type] = amount;
            }
        });
    });
}

/**
 * Distributes additions based on exposure and timer conditions
 * @param {Object} room - The room object
 */
function distributeAdditions(room) {
    // Skip if no additions are configured
    if (!room.config.additions || Object.keys(room.config.additions).length === 0) {
        return;
    }

    const eligiblePlayers = new Map(); // Map of playerName to number of additions to receive

    // Handle additions based on exposure
    if (room.config.additions_obtainWithExposure > 0) {
        // Find players who have received enough additions and calculate how many they should get
        Array.from(room.receivedAdditions.entries())
            .filter(([_, count]) => count >= room.config.additions_obtainWithExposure)
            .forEach(([playerName, count]) => {
                const additionsToReceive = Math.floor(count / room.config.additions_obtainWithExposure);
                eligiblePlayers.set(playerName, (eligiblePlayers.get(playerName) || 0) + additionsToReceive);
            });
    }

    // Handle additions based on timer
    if (room.config.additions_obtainWithTimer > 0) {
        // Find players who have missed enough links and calculate how many they should get
        Array.from(room.missedLinks.entries())
            .filter(([_, count]) => count >= room.config.additions_obtainWithTimer)
            .forEach(([playerName, count]) => {
                const additionsToReceive = Math.floor(count / room.config.additions_obtainWithTimer);
                eligiblePlayers.set(playerName, (eligiblePlayers.get(playerName) || 0) + additionsToReceive);
            });
    }

    if (eligiblePlayers.size > 0) {
        // Get available addition types
        const availableAdditions = Object.keys(room.config.additions);

        // For each eligible player, give them random additions
        eligiblePlayers.forEach((count, playerName) => {
            const player = room.players.get(playerName);
            if (player) {
                // Give them 'count' number of random additions
                for (let i = 0; i < count; i++) {
                    // Randomly select an addition type
                    const randomType = availableAdditions[Math.floor(Math.random() * availableAdditions.length)];
                    // Add the addition
                    player.additions[randomType] = (player.additions[randomType] || 0) + 1;
                }
                
                // Clear their counters
                room.receivedAdditions.set(playerName, 0);
                room.missedLinks.set(playerName, 0);
            }
        });
    }
}

// State-specific handlers
function handleLobbyState(room, data) {
    // Reset game state for new game
    room.winner = null;
    room.hasWinner = false;
    room.currentUrl = null;
    room.hasAdditions = room.config.additions && Object.keys(room.config.additions).length > 0;
    room.nextAddition = null;
    
    // Reset addition-related state
    room.additionRound = 0;  // Track which round of additions we're in
    room.additionOrder = []; // Track the order of players for round-robin additions
    room.usedAdditions = new Set(); // Track which players have used additions this round

    // Handle surrendered players
    if (room.surrenderedPlayers) {
        // Move surrendered players back to active players
        for (const [playerName, playerData] of room.surrenderedPlayers) {
            // Create new player entry with reset path
            room.players.set(playerName, {
                type: 'player',
                path: [],
                additions: {}
            });
        }
        // Clear surrendered players
        room.surrenderedPlayers = new Map();
    }

    // Reset all player paths to empty and clear shortest path results
    for (const player of room.players.values()) {
        player.path = [];
        player.shortestPathToEnd = null;
    }

    return GameStates.LOBBY;
}

function handleRunningState(room, data) {
  // Clean up addition timer if it exists
  if (room.additionTimer) {
    clearTimeout(room.additionTimer);
    room.additionTimer = null;
  }

  // Clean up waiting timer if it exists
  if (room.waitingTimer) {
    clearTimeout(room.waitingTimer);
    room.waitingTimer = null;
  }

  // Clear all state that's no longer needed
  room.waitingForPlayers = false;
  room.submittedPlayers = null;
  room.continueResponses = null;
  room.eligiblePlayers = null;
  room.readyPlayers = null;
  room.additionEndTime = null;
  room.additionRound = 0;
  room.additionOrder = [];
  room.usedAdditions = new Set();
  room.nextAddition = null;
  room.pendingRandomUrls = null;  // Clear pending random URLs
  room.submissionOrder = [];  // Reset submission order

  // Initialize player paths with start URL when transitioning from LOBBY
  if (room.status === GameStates.LOBBY) {
    // Initialize each player's path with the start URL
    room.players.forEach(player => {
      if (!player.path) {
        player.path = [];
      }
      // Only add the start URL if the path is empty
      if (player.path.length === 0) {
        player.path.push({
          url: room.startUrl,
          timestamp: Date.now(),
          effect: 'start'
        });
      }
    });
    distributeInitialAdditions(room);
  } else if (room.status === GameStates.HANDOUT) {
    distributeAdditions(room);
  }

  // Only set hasAdditions to true if there are actual additions
  room.hasAdditions = room.config.additions && Object.keys(room.config.additions).length > 0;

  return GameStates.RUNNING;
}

function handleWaitingState(room, data) {
  // Start waiting timer if configured
  const waitingDuration = room.countdownTime * 1000 || 5000; // Convert seconds to milliseconds, default to 5 seconds
  room.waitingForPlayers = true;
  
  // Initialize submittedPlayers with the player who triggered the state change
  room.submittedPlayers = new Set();
  if (data.playerName) {
    room.submittedPlayers.add(data.playerName);
  }
  
  // Clear any existing timer
  if (room.waitingTimer) {
    clearTimeout(room.waitingTimer);
    room.waitingTimer = null;
  }

  // Clear pending random URLs when entering waiting state
  room.pendingRandomUrls = null;
  
  // Set the timer start time
  room.waitingTimerStartTime = Date.now();
  
  // Set up the new timer
  room.waitingTimer = setTimeout(() => {
    handleWaitingTimerExpired(room, data);
  }, waitingDuration);

  return GameStates.WAITING;
}

function handlePausedState(room, data) {
  // Clear waiting timer
  if (room.waitingTimer) {
    clearTimeout(room.waitingTimer);
    room.waitingTimer = null;
  }

  // Reset continueResponses Set
  room.continueResponses = new Set();

  // Check for winner first
  if (checkForWinner(room)) {
    return handleStateChange(room, GameStates.FINISHED, data, true);
  }

  // If continuation is automatic, move directly to HANDOUT state
  if (room.config.continuation === 'automatic') {
    return handleStateChange(room, GameStates.HANDOUT, data, true);
  }

  // Handle continuation based on room config
  if (room.config.continuation === 'creator') {
    // Send message to creator to continue the game
    const creator = room.players.get(room.creator);
    if (creator) {
      const message = {
        type: "request_continue_game",
      };
      sendMessageWithQueue(
        room.creator,
        message,
        creator.ws
      );
    }
  } else if (room.config.continuation === 'democratic') {
    // Wait for all players' responses
    // Send continue request to all players
    Array.from(room.players.keys()).forEach((playerName) => {
      const player = room.players.get(playerName);
      const message = {
        type: "request_continue_game",
      };
      sendMessageWithQueue(
        playerName,
        message,
        player.ws
      );
    });
  }

  return GameStates.PAUSED;
}

function handleHandoutState(room, data) {
  // If no additions, move directly to running state
  if (!room.hasAdditions) {
    console.log(`[stateHandlers] No additions, moving to RUNNING state for room ${room.id}`);
    return handleStateChange(room, GameStates.RUNNING, data, true);
  }

  // Reset state when entering HANDOUT state
  room.readyToContinue = new Set();
  room.eligiblePlayers = [];

  // Get all player names from the room's players Map
  const playerNames = Array.from(room.players.keys());
  console.log(`[stateHandlers] Available players:`, playerNames);

  // Filter to only players who have at least one addition available
  const playersWithAdditions = playerNames.filter(name => {
    const player = room.players.get(name);
    return player && player.additions && Object.values(player.additions).some(count => count > 0);
  });

  if (playersWithAdditions.length === 0) {
    console.log(`[stateHandlers] No player has any additions left, moving to RUNNING state for room ${room.id}`);
    return handleStateChange(room, GameStates.RUNNING, data, true);
  }

  // Always initialize addition state when entering HANDOUT
  // Create a random order of players for round-robin
  room.additionOrder = playersWithAdditions.sort(() => Math.random() - 0.5);
  console.log(`[stateHandlers] Created addition order:`, room.additionOrder);
  
  // Reset current player index
  room.currentPlayerIndex = 0;

  // Always set up eligible players based on call type
  if (room.config.additions_callType === 'free_for_all') {
    room.eligiblePlayers = playersWithAdditions;
  } else { // round_robin
    // Only include the current player in eligible players
    const currentPlayer = room.additionOrder[room.currentPlayerIndex];
    console.log(`[stateHandlers] Setting eligible player for round-robin:`, currentPlayer);
    if (currentPlayer) {
      room.eligiblePlayers = [currentPlayer];
    }
  }

  // Set up timer if not already done
  if (!room.additionEndTime) {
    room.additionEndTime = Date.now() + (room.config.additions_timer * 1000);
    // Start the timer
    room.additionTimer = setTimeout(() => {
      handleAdditionTimerExpired(room, data);
    }, room.config.additions_timer * 1000);
  }

  // Initialize ready players set if not already done
  if (!room.readyPlayers) {
    room.readyPlayers = new Set();
  }

  return GameStates.HANDOUT;
}

function handleAdditionTimerExpired(room, data) {
  // Clear the timer
  if (room.additionTimer) {
    clearTimeout(room.additionTimer);
    room.additionTimer = null;
  }

  if (room.config.additions_callType === 'free_for_all') {
    // In free_for_all, move to running state when timer expires
    handleStateChange(room, GameStates.RUNNING, data, false);
  } else { // round_robin
    // In round_robin, move to next player
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.additionOrder.length;
    if (room.currentPlayerIndex === 0) {
      // We've gone through all players, move to running state
      handleStateChange(room, GameStates.RUNNING, data, false);
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
      // Broadcast the updated state
      broadcastGameState(room);
    }
  }
}

function handleFinishedState(room, data) {
  if (DEBUG) console.log(`[stateHandlers] Starting handleFinishedState for room ${room.id}`);
  
  // Set winner and finalize game state
  if (!data.winner) {
    // Find the winner if not provided
    for (const [playerName, player] of room.players) {
      if (player.path && player.path.length > 0) {
        const lastPathEntry = player.path[player.path.length - 1];
        if (lastPathEntry.url === room.endUrl) {
          data.winner = playerName;
          break;
        }
      }
    }
  }
  
  // Update room state
  room.winner = data.winner;
  room.hasWinner = true;
  room.hasAdditions = false;
  room.nextAddition = null;
  room.winnerReason = data.reason || 'game_completed';
  room.status = GameStates.FINISHED; // Explicitly set the status

  // Clear any existing timers
  if (room.waitingTimer) {
    clearTimeout(room.waitingTimer);
    room.waitingTimer = null;
  }
  if (room.additionTimer) {
    clearTimeout(room.additionTimer);
    room.additionTimer = null;
  }

  // Clear any waiting states
  room.waitingForPlayers = false;
  room.continueResponses = null;
  room.submittedPlayers = null;
  room.eligiblePlayers = null;
  room.readyPlayers = null;

  // Initialize ranking array
  room.ranking = [];
  
  // First, add the winner to the ranking
  const winner = room.players.get(room.winner);
  if (winner) {
    room.ranking.push({
      ...winner,
      name: room.winner
    });
  }

  // Track players who reached the end URL (excluding winner)
  const playersAtEnd = [];
  // Track players who need shortest path calculation
  const playersNeedingShortestPath = [];
  // Track surrendered players
  const surrenderedPlayers = room.surrenderedPlayers ? 
    Array.from(room.surrenderedPlayers.entries())
      .map(([name, data]) => ({
        name,
        type: 'player',
        path: data.path,
        additions: {},
        surrendered: true,
        surrenderTime: data.surrenderTime,
        finalUrl: data.finalUrl
      }))
      .sort((a, b) => a.surrenderTime - b.surrenderTime) : [];

  // Categorize players
  for (const [playerName, player] of room.players) {
    if (playerName === room.winner) continue; // Skip winner as they're already added

    if (player.path && player.path.length > 0) {
      const lastPathEntry = player.path[player.path.length - 1];
      if (lastPathEntry.url === room.endUrl) {
        playersAtEnd.push({
          ...player,
          name: playerName
        });
      } else {
        playersNeedingShortestPath.push({
          ...player,
          name: playerName
        });
      }
    }
  }

  // Sort players who reached the end according to submission order
  playersAtEnd.sort((a, b) => {
    const aIndex = room.submissionOrder.indexOf(a.name);
    const bIndex = room.submissionOrder.indexOf(b.name);
    return aIndex - bIndex;
  });

  // Add players who reached the end to ranking
  playersAtEnd.forEach(player => {
    room.ranking.push(player);
  });

  // Function to finalize ranking once all shortest paths are received
  const finalizeRanking = () => {
    // Sort players needing shortest path by path length and submission order
    const sortedPlayers = playersNeedingShortestPath
      .map(player => {
        const response = player.shortestPathToEnd;
        return {
          player,
          pathLength: response === "not-found" || response === "disabled" ? Infinity : response.length,
          submissionIndex: room.submissionOrder.indexOf(player.name)
        };
      })
      .sort((a, b) => {
        if (a.pathLength === b.pathLength) {
          return a.submissionIndex - b.submissionIndex;
        }
        return a.pathLength - b.pathLength;
      });

    // Add sorted players to ranking
    sortedPlayers.forEach(({ player }) => {
      room.ranking.push(player);
    });

    // Add surrendered players at the end
    room.ranking.push(...surrenderedPlayers);

    // Broadcast final state with complete ranking
    broadcastGameState(room);
  };

  // Function to calculate shortest paths for surrendered players
  const calculateSurrenderedPaths = (callback) => {
    if (!process.env.PATH_API || surrenderedPlayers.length === 0) {
      callback();
      return;
    }

    let surrenderedPendingResponses = surrenderedPlayers.length;
    surrenderedPlayers.forEach(player => {
      const lastPathEntry = player.path[player.path.length - 1];
      const { fetchShortestPathsAsync } = require('../../shortestPathsManager');
      fetchShortestPathsAsync(lastPathEntry.url, room.endUrl, (result) => {
        player.shortestPathToEnd = result;
        surrenderedPendingResponses--;
        
        if (surrenderedPendingResponses === 0) {
          callback();
        }
      });
    });
  };

  // If PATH_API is not set, just add remaining players by submission order
  if (!process.env.PATH_API) {
    // Sort remaining players by submission order
    playersNeedingShortestPath.sort((a, b) => {
      const aIndex = room.submissionOrder.indexOf(a.name);
      const bIndex = room.submissionOrder.indexOf(b.name);
      return aIndex - bIndex;
    });

    // Add remaining players to ranking
    playersNeedingShortestPath.forEach(player => {
      room.ranking.push(player);
    });

    // Add surrendered players at the end
    room.ranking.push(...surrenderedPlayers);

    broadcastGameState(room);
    return GameStates.FINISHED;
  }

  // If no players need shortest path calculation, calculate for surrendered players
  if (playersNeedingShortestPath.length === 0) {
    calculateSurrenderedPaths(finalizeRanking);
    return GameStates.FINISHED;
  }

  // Fetch shortest paths for remaining players
  let pendingResponses = playersNeedingShortestPath.length;
  playersNeedingShortestPath.forEach(player => {
    const lastPathEntry = player.path[player.path.length - 1];
    const { fetchShortestPathsAsync } = require('../../shortestPathsManager');
    fetchShortestPathsAsync(lastPathEntry.url, room.endUrl, (result) => {
      player.shortestPathToEnd = result;
      pendingResponses--;
      
      if (pendingResponses === 0) {
        calculateSurrenderedPaths(finalizeRanking);
      }
    });
  });

  if (DEBUG) console.log(`[stateHandlers] Completed handleFinishedState for room ${room.id}, winner: ${room.winner}`);
  
  return GameStates.FINISHED;
}

// Helper functions
function checkForWinner(room) {
  // Check if any player has reached the goal first
  for (const [_, player] of room.players) {
    if (player.path && player.path.length > 0) {
      const lastPathEntry = player.path[player.path.length - 1];
      if (lastPathEntry.url === room.endUrl) {
        return true;
      }
    }
  }
  return false;
}

function handleWaitingTimerExpired(room, data) {
  // Clear the waiting timer
  if (room.waitingTimer) {
    room.waitingTimer = null;
  }

  // Check if any player has reached the goal first
  if (checkForWinner(room)) {
    handleStateChange(room, GameStates.FINISHED, data);
    return;
  }

  // Track players who missed clicking links
  Array.from(room.players.keys()).forEach(playerName => {
    if (!room.submittedPlayers.has(playerName)) {
      // Increment the missed links count for this player
      const currentCount = room.missedLinks.get(playerName) || 0;
      room.missedLinks.set(playerName, currentCount + 1);
    }
  });

  // Only proceed with selection if there's no winner
  if (!checkForWinner(room)) {
    if (room.config.chooser === 'random') {
      // Find players who haven't submitted a link
      const missingPlayers = Array.from(room.players.keys()).filter(
        playerName => !room.submittedPlayers.has(playerName)
      );
      
      // Send random selection request to each missing player
      missingPlayers.forEach(playerName => {
        const player = room.players.get(playerName);
        if (player) {
          const message = {
            type: "request_random_url",
            count: 1
          };
          sendMessageWithQueue(
            playerName,
            message,
            player.ws
          );
        }
      });
    } else {
      // Find players who haven't submitted a link
      const missingPlayers = Array.from(room.players.keys()).filter(
        playerName => !room.submittedPlayers.has(playerName)
      );
      
      // Send request for multiple random URLs to each missing player
      missingPlayers.forEach(playerName => {
        const player = room.players.get(playerName);
        if (player) {
          const message = {
            type: "request_random_urls",
            count: 5
          };
          sendMessageWithQueue(
            playerName,
            message,
            player.ws
          );
        }
      });
    }
  }

  // Broadcast the updated state
  // No state change here, but we broadcast the updated missed links
  broadcastGameState(room);
}

// Main state change handler
function handleStateChange(room, newState, data = {}, isNested = false) {
    if (DEBUG) console.log(`[stateHandlers] Attempting state change from ${room.status} to ${newState} for room ${room.id}, triggered by player ${data?.playerName || 'system'}`);
    if (!isValidStateTransition(room.status, newState)) {
        console.warn(`[stateHandlers] Invalid state transition from ${room.status} to ${newState} for room ${room.id}`);
        return false;
    }

    // Handle state-specific logic
    let nextState = newState;
    switch (newState) {
        case GameStates.LOBBY:
            nextState = handleLobbyState(room, data);
            break;
        case GameStates.RUNNING:
            nextState = handleRunningState(room, data);
            break;
        case GameStates.WAITING:
            nextState = handleWaitingState(room, data);
            break;
        case GameStates.PAUSED:
            nextState = handlePausedState(room, data);
            break;
        case GameStates.HANDOUT:
            nextState = handleHandoutState(room, data);
            break;
        case GameStates.FINISHED:
            nextState = handleFinishedState(room, data);
            break;
        default:
            console.warn(`[stateHandlers] Unknown state: ${newState} for room ${room.id}`);
            return false;
    }

    // Only update room state and broadcast if this is not a nested state change
    if (!isNested) {
        const oldState = room.status;
        room.status = nextState;
        console.log(`[stateHandlers] State changed successfully from ${oldState} to ${nextState} for room ${room.id}`);
        if (DEBUG) console.log(`[stateHandlers] Broadcasting state for room ${room.id}`);
        broadcastGameState(room);
        if (DEBUG) console.log(`[stateHandlers] State broadcast complete for room ${room.id}`);
    } else {
        if (DEBUG) console.log(`[stateHandlers] Skipping broadcast for nested state change in room ${room.id}`);
    }

    return nextState;
}

// Create a state change manager to avoid circular dependencies
const stateChangeManager = {
    changeState: handleStateChange
};

// Export the state change manager and other utilities
module.exports = {
    stateChangeManager,
    isValidStateTransition,
    handleStateChange, // Also export the function directly for backward compatibility
    distributeInitialAdditions,
    distributeAdditions
};
