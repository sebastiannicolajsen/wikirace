/**
 * Handles game flow messages and routes them to appropriate handlers.
 * 
 * Message handling is organized into four main categories:
 * 1. Player messages (playerHandlers):
 *    - player.continueGame: When a player wants to continue the game
 *    - player.surrender: When a player wants to surrender
 *    - player.allSelected: When all players have selected their links
 *    - player.joined: When a player joins the game
 *    - player.left: When a player leaves the game
 * 
 * 2. Addition messages (additionHandlers):
 *    - player.useAdditionResponse: When a player uses an addition
 *    - player.readyToContinue: When a player is ready to continue
 *    - creator.giveAddition: When the creator gives an addition
 * 
 * 3. Creator messages (creatorHandlers):
 *    - creator.startGame: When the creator starts the game
 *    - creator.kickUser: When the creator kicks a player
 *    - creator.restartGame: When the creator restarts the game
 *    - creator.continueGame: When the creator continues the game
 * 
 * 4. Link selection messages (selectLinksHandlers):
 *    - player.selectLink: When a player selects a link
 *    - player.randomSelectLink: When a player selects a random link
 *    - player.randomSelectMultiple: When a player selects multiple random links
 *    - player.selectionForOthers: When a player selects for others
 *    - player.randomSelectResponse: Response to random selection
 *    - player.randomUrlsResponse: Response to multiple random URLs
 *    - player.selectForMissingPlayersResponse: Response for missing players
 */

const playerHandlers = require("./handlers/playerHandlers");
const additionHandlers = require("./handlers/additionHandlers");
const selectLinksHandlers = require("./handlers/selectLinksHandlers");
const creatorHandlers = require("./handlers/creatorHandlers");
const { getRoom } = require("../roomManager");

// Handle game flow messages
function handleGameFlowMessage(roomId, messageType, data) {
  // check if room exists using getRoom
  const room = getRoom(roomId);
  if (!room) {
    console.warn(`Room ${roomId} does not exist`);
    return;
  }

  // Check if this is a link selection action
  if (selectLinksHandlers.HANDLED_ACTIONS.includes(messageType)) {
    selectLinksHandlers.handle(room, data);
    return;
  }
  // Check if this is a creator action
  if (creatorHandlers.HANDLED_ACTIONS.includes(messageType)) {
    creatorHandlers.handle(room, data);
    return;
  }
  // Check if this is an addition action
  if (additionHandlers.HANDLED_ACTIONS.includes(messageType)) {
    additionHandlers.handle(room, data);
    return;
  }
  // Check if this is a player action
  if (playerHandlers.HANDLED_ACTIONS.includes(messageType)) {
    playerHandlers.handle(room, data);
    return;
  }

  // Handle other game flow messages
  switch (messageType) {
    default:
      console.warn(`Unknown message type: ${messageType}`);
  }
}

module.exports = {
  handleGameFlowMessage,
};
