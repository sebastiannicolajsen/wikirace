/**
 * Handles link selection-related messages and state transitions.
 * 
 * Messages sent to clients:
 * - request_random_url: When a player needs to select a random URL
 * - request_random_urls: When a player needs to select from multiple random URLs
 * - request_continue_game: When waiting for players to continue
 * - request_select_for_missing_players: When a player needs to select a link for other players
 * 
 * Messages received from clients:
 * - player.selectLink: When a player selects a link
 * - player.randomSelectResponse: When a player responds to a single random URL request
 * - player.randomUrlsResponse: When a player responds to a multiple random URLs request
 * - player.selectForMissingPlayersResponse: When a player selects links for missing players
 * 
 * State transitions:
 * - RUNNING -> WAITING: When players need to select links
 * - WAITING -> PAUSED: When all players have submitted their links
 */

const { broadcastGameState } = require("../../gameStateManager");
const { GameStates } = require("../gameStates");
const { stateChangeManager } = require("./stateHandlers");
const { sendMessageWithQueue } = require("../../messageQueue");




// List of actions this handler handles
const HANDLED_ACTIONS = [
  "player.selectLink",
  "player.randomSelectResponse",
  "player.randomUrlsResponse",
  "player.selectForMissingPlayersResponse"
];

function handleSelectLink(room, data) {
  const { playerName, url } = data;
  const player = room.players.get(playerName);

  if (!player) {
    console.warn(`Player ${playerName} not found in room`);
    return;
  }

  // If the waiting timer has expired (null) and we're in WAITING state, reject the link selection
  if (room.waitingTimer === null && room.status === GameStates.WAITING) {
    console.warn(`Rejecting link selection from ${playerName} after timer expiration`);
    return;
  }

  // If the player has already submitted a link, reject the selection
  if (room.submittedPlayers && room.submittedPlayers.has(playerName)) {
    console.warn(`Rejecting duplicate link selection from ${playerName}`);
    return;
  }

  // the clients url path should be updated with the new url as the next
  player.path.push({ url, effect: "none" });

  // Track that this player has submitted their link
  if (room.waitingForPlayers) {
    room.submittedPlayers.add(playerName);
  }

  // if all players have selected a link, continue to waiting state
  if (
    room.waitingForPlayers &&
    room.submittedPlayers.size === room.players.size
  ) {
    stateChangeManager.changeState(room, GameStates.PAUSED, data);
    return;
  }

  // if the room is not in waiting state, start that state
  if (!room.waitingForPlayers) {
    stateChangeManager.changeState(room, GameStates.WAITING, data);
  } else {
    broadcastGameState(room);
  }
}


function handleRandomSelectResponse(room, data) {
  const { playerName, url } = data;
  const player = room.players.get(playerName);

  if (!player) {
    console.warn(`Player ${playerName} not found in room`);
    return;
  }

  // Add the randomly selected URL to the player's path
  player.path.push({ url, effect: "random" });
  
  // Track that this player has submitted their link
  if (room.waitingForPlayers) {
    room.submittedPlayers.add(playerName);
  }

  // Clear any pending random URLs for this player
  if (room.pendingRandomUrls) {
    room.pendingRandomUrls.delete(playerName);
    // If no more pending URLs, clear the map
    if (room.pendingRandomUrls.size === 0) {
      room.pendingRandomUrls = null;
    }
  }

  // Check for winner first
  if (checkForWinner(room)) {
    stateChangeManager.changeState(room, GameStates.FINISHED, data);
    return;
  }

  // If all players have now submitted and we're not already in PAUSED state, move to paused state
  if (room.waitingForPlayers && room.submittedPlayers.size === room.players.size && room.status !== GameStates.PAUSED) {
    stateChangeManager.changeState(room, GameStates.PAUSED, data);
    return;
  }

  // Always broadcast the game state after processing
  broadcastGameState(room);
}

// Helper function to check for winner
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

function handleRandomUrlsResponse(room, data) {
  console.log('Received randomUrlsResponse:', data);
  const { playerName, urls } = data;
  console.log(`Processing random URLs for player ${playerName}:`, urls);
  
  // Store the URLs for this player
  if (!room.pendingRandomUrls) {
    room.pendingRandomUrls = new Map();
  }
  room.pendingRandomUrls.set(playerName, urls);
  console.log('Current pendingRandomUrls:', Array.from(room.pendingRandomUrls.entries()));

  // If we have all the random URLs, send them to the first player who submitted
  if (room.pendingRandomUrls.size === room.players.size - room.submittedPlayers.size) {
    console.log('All random URLs collected, sending to first submitter');
    const firstSubmitter = Array.from(room.submittedPlayers)[0];
    if (firstSubmitter) {
      const player = room.players.get(firstSubmitter);
      if (player) {
        // Convert the Map to an array of {playerName, urls} objects
        const selectionsNeeded = Array.from(room.pendingRandomUrls.entries()).map(
          ([playerName, urls]) => ({ playerName, urls })
        );
        console.log('Sending selections to first submitter:', selectionsNeeded);
        
        sendMessageWithQueue(
          firstSubmitter,
          {
            type: "select_for_missing_players",
            playerName: firstSubmitter,
            selections: selectionsNeeded
          },
          player.ws
        );
      }
    }
  }
}

// Add new function to handle retries and fallbacks
function handleMissingPlayerResponses(room, data) {
  const missingPlayers = Array.from(room.players.keys()).filter(
    playerName => !room.submittedPlayers.has(playerName)
  );

  // Initialize or update retry counts
  if (!room.randomUrlRetries) {
    room.randomUrlRetries = new Map();
  }

  missingPlayers.forEach(playerName => {
    const player = room.players.get(playerName);
    if (!player) return;

    const retryCount = room.randomUrlRetries.get(playerName) || 0;
    
    if (retryCount < 2) {
      // Send another request
      room.randomUrlRetries.set(playerName, retryCount + 1);
      
      const message = {
        type: room.config.chooser === 'random' ? "request_random_url" : "request_random_urls",
        count: room.config.chooser === 'random' ? 1 : 5
      };
      sendMessageWithQueue(
        playerName,
        message,
        player.ws
      );

      // Set timeout for next retry or fallback
      setTimeout(() => {
        handleMissingPlayerResponses(room, data);
      }, 2000);
    } else {
      // Max retries reached, use fallback
      const player = room.players.get(playerName);
      if (player && player.path && player.path.length > 0) {
        // Get the last 5 (or fewer) links from the player's path
        const lastLinks = player.path.slice(-5).map(entry => entry.url);
        
        // Add these links to pendingRandomUrls
        if (!room.pendingRandomUrls) {
          room.pendingRandomUrls = new Map();
        }
        room.pendingRandomUrls.set(playerName, lastLinks);
        
        // Check if we now have all responses
        if (room.pendingRandomUrls.size === room.players.size - room.submittedPlayers.size) {
          const firstSubmitter = Array.from(room.submittedPlayers)[0];
          if (firstSubmitter) {
            const submitter = room.players.get(firstSubmitter);
            if (submitter) {
              const selectionsNeeded = Array.from(room.pendingRandomUrls.entries()).map(
                ([playerName, urls]) => ({ playerName, urls })
              );
              
              sendMessageWithQueue(
                firstSubmitter,
                {
                  type: "select_for_missing_players",
                  playerName: firstSubmitter,
                  selections: selectionsNeeded
                },
                submitter.ws
              );
            }
          }
        }
      }
    }
  });
}

function handleWaitingTimerExpired(room, data) {
  // Clear the waiting timer
  if (room.waitingTimer) {
    room.waitingTimer = null;
  }

  // Check if any player has reached the goal first
  if (checkForWinner(room)) {
    handleStateChange(room, GameStates.FINISHED, data, true);
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
    // Start the retry process for missing players
    handleMissingPlayerResponses(room, data);
  }

  // Broadcast the updated state
  broadcastGameState(room);
}

function handleSelectionForMissingPlayers(room, data) {
  const { selections } = data;
  
  // Process each selection
  selections.forEach(({ playerName, selectedUrl }) => {
    const player = room.players.get(playerName);
    if (player) {
      // Add the selected URL to the player's path
      player.path.push({ url: selectedUrl, effect: "user_selected" });
      
      // Track that this player has submitted their link
      if (room.waitingForPlayers) {
        room.submittedPlayers.add(playerName);
      }
    }
  });

  // Clear the pending random URLs
  room.pendingRandomUrls = null;

  // If all players have now submitted, move to paused state
  if (room.waitingForPlayers && room.submittedPlayers.size === room.players.size) {
    stateChangeManager.changeState(room, GameStates.PAUSED, data);
    return;
  }

  broadcastGameState(room);
}

// Main handler function that routes to specific handlers
function handle(room, data) {
  switch (data.type) {
    case "player.selectLink":
      handleSelectLink(room, data);
      break;
    case "player.randomSelectResponse":
      handleRandomSelectResponse(room, data);
      break;
    case "player.randomUrlsResponse":
      handleRandomUrlsResponse(room, data);
      break;
    case "player.selectForMissingPlayersResponse":
      handleSelectionForMissingPlayers(room, data);
      break;
    default:
      console.warn(`Unknown link selection action: ${data.type}`);
  }
}


module.exports = {
  HANDLED_ACTIONS,
  handle,
};
