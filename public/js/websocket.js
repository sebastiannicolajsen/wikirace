import timerManager from './timer.js';
import popupManager from './popup.js';

class WebSocketManager {
  constructor() {
    this.ws = null;
    this.roomId = null;
    this.playerName = null;
    this.playerType = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000; // 3 seconds
    this.messageHandlers = new Map();
    this.gameState = null;
    this.stateUpdateHandlers = new Set();
    this.isIntentionalDisconnect = false;
    this.config = null;
    this.reconnectTimer = null;
    this.isReconnecting = false; // Add flag to track reconnection state
    this.connectionHandlers = new Set(); // Add set for connection handlers
  }

  async initialize() {
    try {
      const response = await fetch("/api/config");
      this.config = await response.json();
    } catch (error) {
      console.error("Failed to fetch server configuration:", error);
      this.showError("Failed to connect to server. Please refresh the page.");
    }
  }

  async connect(roomId, playerName, playerType) {
    if (!this.config) {
      await this.initialize();
    }

    this.roomId = roomId;
    this.playerName = playerName;
    this.playerType = playerType;

    this.connectWebSocket();
  }

  connectWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws/${this.roomId}`;

    console.log("Connecting to WebSocket:", wsUrl);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.sendMessage({
        type: "join",
        playerName: this.playerName,
        playerType: this.playerType,
      });
      // Notify all connection handlers
      this.connectionHandlers.forEach(handler => handler());
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    this.ws.onclose = (event) => {
      console.log("WebSocket disconnected:", event.code, event.reason);
      if (this.isIntentionalDisconnect) {
        // Reset the intentional disconnect flag after handling the close
        this.isIntentionalDisconnect = false;
        // Clean up the WebSocket reference
        this.ws = null;
        return; // Don't show error or attempt reconnect for intentional disconnects
      }

      // Try to parse the reason as JSON
      let closeReason;
      try {
        closeReason = JSON.parse(event.reason);
      } catch (e) {
        closeReason = { intentional: false };
      }

      if (closeReason.intentional) {
        // This is an intentional disconnect, don't treat as error
        this.ws = null;
        return;
      }

      // Handle non-intentional disconnects
      if (event.code === 1000) {
        const errorMessage = event.reason || "Connection attempt failed";
        localStorage.setItem("connectionError", errorMessage);
        // Dispatch websocket-close event with the parsed reason
        window.dispatchEvent(
          new CustomEvent("websocket-close", {
            detail: { 
              code: event.code,
              reason: closeReason
            }
          })
        );
      } else {
        this.handleDisconnect();
      }
      // Clean up the WebSocket reference
      this.ws = null;
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
      );
      // Show reconnection popup only after first attempt fails
      if (this.reconnectAttempts > 1) {
        popupManager.showInfo(
          `Connection lost. Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
          "info"
        );
      }
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }
      this.isReconnecting = true;
      this.reconnectTimer = setTimeout(() => {
        this.isReconnecting = false;
        this.connectWebSocket();
      }, this.reconnectInterval);
    } else {
      console.log("Max reconnection attempts reached");
      window.dispatchEvent(
        new CustomEvent("websocket-error", {
          detail: { message: "Connection lost. Please refresh the page." },
        })
      );
    }
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error("WebSocket is not connected");
    }
  }

  // State update handling
  handleGameState(state) {
    const previousState = this.gameState?.state;
    this.gameState = state;
    
    // Only handle redirects if we're not already on the correct page
    const currentPath = window.location.pathname;
    const isOnGamePage = currentPath === `/game/${this.roomId}`;
    const isOnObserverPage = currentPath === `/observer/${this.roomId}`;
    
    // Handle state-based redirects
    if (state.state === 'running' && previousState === 'lobby') {
      if (this.playerType === 'observer' && !isOnObserverPage) {
        // Close WebSocket before redirecting
        this.unintentionalDisconnect();
        // Redirect observers to observer page
        window.location.href = `/observer/${this.roomId}`;
        return;
      } else if (this.playerType === 'player' && !isOnGamePage) {
        // Close WebSocket before redirecting
        this.unintentionalDisconnect();
        // Redirect players to game page
        window.location.href = `/game/${this.roomId}`;
        return;
      }
    }

    // Handle waiting timer
    if (state.state === 'waiting' && state.waitingTimerStartTime) {
      const now = Date.now();
      const startTime = state.waitingTimerStartTime;
      const duration = state.countdownTime * 1000; // Convert seconds to milliseconds
      const elapsed = now - startTime;
      const remaining = Math.max(0, duration - elapsed);
      
      // Only start the timer if there's remaining time and we're not already in waiting state
      if (remaining > 0 && previousState !== 'waiting') {
        timerManager.startWaitingTimer(startTime, duration);
      }
    } else if (previousState === 'waiting') {
      timerManager.stopWaitingTimer();
    }
    
    // Notify all state update handlers
    this.stateUpdateHandlers.forEach((handler) => handler(state));
  }

  onStateUpdate(handler) {
    this.stateUpdateHandlers.add(handler);
    // If we already have a state, call the handler immediately
    if (this.gameState) {
      handler(this.gameState);
    }
  }

  // Message handlers
  handleAdditionUsed(message) {
    console.log('Handling addition used:', message);
    const event = new CustomEvent("addition-used", {
      detail: {
        sender: message.data.sender,
        type: message.data.selection.type,
        target: message.data.selection.target
      },
    });
    window.dispatchEvent(event);
  }

  handleRequestAddition(message) {
    const event = new CustomEvent("request-addition", {
      detail: {
        availableAdditions: message.availableAdditions,
        count: message.count,
      },
    });
    window.dispatchEvent(event);
  }

  handleRequestRandomUrl(message) {
    const event = new CustomEvent("request-random-url", {
      detail: {
        count: message.count,
      },
    });
    window.dispatchEvent(event);
  }

  handleRequestRandomUrls(message) {
    const event = new CustomEvent("request-random-urls", {
      detail: {
        count: message.count,
      },
    });
    window.dispatchEvent(event);
  }

  handleRequestContinueGame(message) {
    const event = new CustomEvent("request-continue-game");
    window.dispatchEvent(event);
  }

  handleRequestContinue(message) {
    const event = new CustomEvent("request-continue");
    window.dispatchEvent(event);
  }

  handleRequestSelectForMissingPlayers(message) {
    const event = new CustomEvent("request-select-for-missing-players", {
      detail: {
        selections: message.selections,
      },
    });
    window.dispatchEvent(event);
  }

  handleSelectForMissingPlayers(message) {
    console.log('Handling select_for_missing_players for player:', this.playerName);
    console.log('Message content:', message);
    const event = new CustomEvent('select_for_missing_players', {
        detail: message
    });
    console.log('Dispatching select_for_missing_players event for player:', this.playerName);
    window.dispatchEvent(event);
  }

  // Helper methods for sending messages
  sendUseAddition(additionType, targetPlayer) {
    this.sendMessage({
      type: "player.useAdditionResponse",
      playerName: this.playerName,
      selection: {
        type: additionType,
        target: targetPlayer,
      },
    });
  }

  sendGiveAddition(targetPlayer, additionType) {
    this.sendMessage({
      type: "creator.giveAddition",
      playerName: this.playerName,
      target: targetPlayer,
      additionType: additionType
    });
  }

  sendReadyToContinue() {
    this.sendMessage({
      type: "player.continueGame",
      playerName: this.playerName
    });
  }

  sendReadyToContinueFromHandout() {
    this.sendMessage({
      type: "player.readyToContinue",
      playerName: this.playerName
    });
  }

  sendPlayerSurrender() {
    this.sendMessage({
      type: "player.surrender",
      playerName: this.playerName
    });
  }

  sendCreatorLeave() {
    this.sendMessage({
      type: "creator_leave",
    });
  }

  sendStartGame() {
    this.sendMessage({
      type: "creator.startGame",
    });
  }

  sendKickUser(playerName) {
    this.sendMessage({
      type: "creator.kickUser",
      playerName,
    });
  }

  sendRestartGame() {
    this.sendMessage({
      type: "creator.restartGame",
    });
  }

  sendContinueGame() {
    this.sendMessage({
      type: "creator.continueGame",
      playerName: this.playerName
    });
  }

  sendSelectLink(url) {
    this.sendMessage({
      type: "player.selectLink",
      playerName: this.playerName,
      url,
    });
  }

  sendSelectRandomLink(url) {
    this.sendMessage({
      type: "player.randomSelectResponse",
      playerName: this.playerName,
      url,
    });
  }

  sendRandomUrlsResponse(urls) {
    this.sendMessage({
      type: "player.randomUrlsResponse",
      playerName: this.playerName,
      urls,
    });
  }

  sendSelectionForOthers(urls) {
    this.sendMessage({
      type: "player.selectionForOthers",
      playerName: this.playerName,
      urls,
    });
  }

  sendSelectForMissingPlayersResponse(selections) {
    this.sendMessage({
      type: "player.selectForMissingPlayersResponse",
      playerName: this.playerName,
      selections,
    });
  }

  sendRandomSelectResponse(url) {
    this.sendMessage({
      type: "player.randomSelectResponse",
      playerName: this.playerName,
      url,
    });
  }

  sendKickPlayer(playerName) {
    this.sendMessage({
      type: "creator.kickPlayer",
      playerName: playerName,
    });
  }

  disconnect() {
    if (this.ws) {
      this.isIntentionalDisconnect = true;
      // Send leave message
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.ws.close(
        1000,
        JSON.stringify({
          intentional: true,
          playerName: this.playerName
        })
      );
    }
  }

  unintentionalDisconnect() {
    if (this.ws) {
      if (this.isReconnecting) {
        console.log("Already attempting to reconnect, skipping...");
        return;
      }
      this.isIntentionalDisconnect = false;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.isReconnecting = false; // Reset reconnecting state
      this.ws.close();
    }
  }

  showError(message) {
    const event = new CustomEvent("websocket-error", { detail: { message } });
    window.dispatchEvent(event);
  }

  // Main message handler - should be at the bottom
  handleMessage(message) {
    console.log('WebSocket message received:', message);
    if (message.type === 'ping') {
      // Respond to ping with pong, including the timestamp
      this.sendMessage({ 
        type: 'pong',
        timestamp: message.timestamp 
      });
      return;
    }
    if (message.type === 'select_for_missing_players') {
        console.log('select_for_missing_players message received for player:', this.playerName);
        console.log('Message content:', message);
        // Only dispatch the event if this player is the first submitter
        if (message.playerName === this.playerName) {
            console.log('This player is the intended recipient, dispatching event');
            this.handleSelectForMissingPlayers(message);
        } else {
            console.log('This player is not the intended recipient, ignoring message');
        }
        return;
    }
    if (message.type === "close_popup") {
      // Close all popups
      popupManager.closeAllPopups();
      return;
    }
    switch (message.type) {
      case "game_state":
        this.handleGameState(message.state);
        break;
      case "addition_used":
        this.handleAdditionUsed(message);
        break;
      case "request_addition":
        this.handleRequestAddition(message);
        break;
      case "request_random_url":
        this.handleRequestRandomUrl(message);
        break;
      case "request_random_urls":
        this.handleRequestRandomUrls(message);
        break;
      case "request_continue_game":
        this.handleRequestContinueGame(message);
        break;
      case "request_continue":
        this.handleRequestContinue(message);
        break;
      case "request_select_for_missing_players":
        this.handleRequestSelectForMissingPlayers(message);
        break;
      case "select_for_missing_players":
        console.log('Received select_for_missing_players message in handleMessage');
        this.handleSelectForMissingPlayers(message);
        break;
      case "player_kicked":
        console.log('Handling player_kicked message:', message);
        this.handlePlayerKicked(message);
        break;
      default:
        console.warn("Unknown message type:", message.type);
    }
  }

  handlePlayerKicked(message) {
    console.log('Handling player kicked:', message);
    // Dispatch the player-kicked event
    const event = new CustomEvent("player-kicked", {
      detail: {
        playerName: message.playerName,
        reason: message.reason
      },
    });
    window.dispatchEvent(event);
  }

  onConnection(handler) {
    this.connectionHandlers.add(handler);
    // If we're already connected, call the handler immediately
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      handler();
    }
  }
}

// Create a singleton instance
const websocketManager = new WebSocketManager();

// Handle page unload
window.addEventListener("beforeunload", () => {
  websocketManager.unintentionalDisconnect();
});

// Handle page hide
window.addEventListener("pagehide", () => {
  websocketManager.unintentionalDisconnect();
});

// Handle visibility change
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // Page is hidden, close WebSocket if open
    if (websocketManager.ws && websocketManager.ws.readyState === WebSocket.OPEN) {
      websocketManager.unintentionalDisconnect();
    }
  } else {
    // Page is visible, only reconnect if:
    // 1. There's no WebSocket connection
    // 2. The connection is closed
    // 3. We're not already attempting to reconnect
    if ((!websocketManager.ws || websocketManager.ws.readyState === WebSocket.CLOSED) && 
        !websocketManager.isReconnecting) {
      websocketManager.connectWebSocket();
    }
  }
});

export default websocketManager;
