import PlayerCharacter from "./playerCharacter.js";
import PlayerPath from "./playerPath.js";

class PlayerLanes {
  constructor(container, state) {
    this.container = container;
    this.state = state;
    this.lanes = new Map();
    this.characters = new Map();
    this.paths = new Map();
    this.pathsVis = new Map();
    this.pathCutoffs = new Map(); // Track cutoffs for each player
    this.pathVisualizations = new Map();
    this.animationFrame = null;
    this.lastUpdateTime = 0;
    this.updateInterval = 1000 / 60; // 60 FPS
    this.isActive = true;
    this.backgroundScene = null; // Add reference to background scene
    this.gameStateListener = null; // Track the event listener

    // Start the animation loop
    this.animate();

    // Listen for game state changes
    this.setupGameStateListener();
  }

  // Add reset method
  reset() {
    // Clean up existing state
    this.cleanup();
    
    // Reset all Maps
    this.lanes.clear();
    this.characters.clear();
    this.paths.clear();
    this.pathsVis.clear();
    this.pathCutoffs.clear();
    this.pathVisualizations.clear();
    
    // Reset animation state
    this.lastUpdateTime = 0;
    this.isActive = true;
    
    // Restart animation loop
    this.animate();
    
    // Re-setup game state listener
    this.setupGameStateListener();
  }

  animate() {
    if (!this.isActive) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastUpdateTime;

    if (deltaTime >= this.updateInterval) {
      this.lastUpdateTime = currentTime;

      // Start animation for any characters that don't have it running
      this.characters.forEach((character) => {
        if (!character.animationFrame) {
          character.startAnimation();
        }
      });
    }

    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  setupGameStateListener() {
    // Remove existing listener if any
    if (this.gameStateListener) {
      window.removeEventListener("gameStateUpdate", this.gameStateListener);
    }
    
    // Create new listener
    this.gameStateListener = (event) => {
      const newState = event.detail;

      // Check if we're being redirected to lobby
      if (newState.state === "lobby") {
        this.cleanup();
      }
    };
    
    // Add new listener
    window.addEventListener("gameStateUpdate", this.gameStateListener);
  }

  cleanup() {
    if (!this.isActive) return;
    this.isActive = false;

    // Clear all path visualizations and their storage
    this.pathsVis.forEach((visualization) => {
      visualization.clearStorage();
    });
    this.pathsVis.clear();

    // Stop all character animations
    this.characters.forEach((character) => {
      character.stopAnimation();
    });

    // Remove all lanes from container
    this.lanes.forEach((lane) => {
      if (lane && lane.parentNode) {
        lane.parentNode.removeChild(lane);
      }
    });

    // Cancel any pending animation frame
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Remove game state listener
    if (this.gameStateListener) {
      window.removeEventListener("gameStateUpdate", this.gameStateListener);
      this.gameStateListener = null;
    }
  }

  update(state) {
    const currentNames = new Set(state.players.map((player) => player.name));
    const previousPaths = new Map(this.paths);

    // Set game state on container for path visualization to access
    this.container.setAttribute('data-state', state.state);

    // Remove lanes/characters/paths for players no longer present
    for (const [name, lane] of this.lanes.entries()) {
      if (!currentNames.has(name)) {
        // Don't remove surrendered players' paths
        const player = state.players.find(p => p.name === name);
        if (!player || !player.path?.some(url => url.effect === 'surrender')) {
          this.container.removeChild(lane);
          this.lanes.delete(name);
          const character = this.characters.get(name);
          if (character) {
            character.stopAnimation();
            this.characters.delete(name);
          }
          this.paths.delete(name);
          this.pathCutoffs.delete(name);
          const pathVis = this.pathsVis.get(name);
          if (pathVis) {
            if (pathVis.svg && pathVis.svg.parentNode)
              pathVis.svg.parentNode.removeChild(pathVis.svg);
            this.pathsVis.delete(name);
          }
        }
      }
    }

    // Get all player names for character assignment
    const allPlayerNames = state.state === 'finished' ? 
      [...state.players.map(p => p.name), ...Object.keys(state.surrenderedPlayers || {})] :
      state.players.map(p => p.name);

    // Check if all players have reached the reduction threshold
    let shouldReduce = true;
    let minPathLength = Infinity;

    // Add new lanes/characters as needed, and update paths
    const playersToProcess = state.state === 'finished' ? 
      [...state.players, ...Object.entries(state.surrenderedPlayers || {}).map(([name, path]) => ({ 
        name, 
        path: Array.isArray(path) ? path : Object.values(path),
        isSurrendered: true
      }))] : 
      state.players;

    playersToProcess.forEach((player) => {
      // Check if this is a surrendered player in finished state
      const isSurrendered = player.isSurrendered || (Array.isArray(player.path) && player.path.some(url => url.effect === 'surrender'));
      const shouldAddLane = !this.lanes.has(player.name) && 
        (state.state !== 'finished' || state.state === 'finished');

      if (shouldAddLane) {
        const lane = document.createElement("div");
        lane.className = "player-lane";
        lane.setAttribute('data-player', player.name);
        this.container.appendChild(lane);
        this.lanes.set(player.name, lane);
        
        // Only add path visualization if not surrendered
        if (!isSurrendered) {
          const pathVis = new PlayerPath(lane, state.id);
          this.pathsVis.set(player.name, pathVis);
        }
        
        // Create and render character after lane is added to DOM
        let character = this.characters.get(player.name);
        if (!character) {
          character = new PlayerCharacter(player.name, allPlayerNames);
          this.characters.set(player.name, character);
          character.render(lane);
        }
        
        this.pathCutoffs.set(player.name, 0); // Initialize cutoff for new player
      }

      // Always update the path for each player
      this.paths.set(player.name, player.path);

      // Update path visualization and character position only if not surrendered
      if (!isSurrendered && this.pathsVis.has(player.name)) {
        const pathVis = this.pathsVis.get(player.name);
        pathVis.update(player.path, state.state);
        const latestPosition = pathVis.getLatestPlatePosition();
        if (latestPosition) {
          let character = this.characters.get(player.name);
          if (!character) {
            character = new PlayerCharacter(player.name, allPlayerNames);
            this.characters.set(player.name, character);
            const lane = this.lanes.get(player.name);
            if (lane) {
              character.render(lane);
            }
          }
          if (character) {
            character.updatePosition(latestPosition);
            if (state.state === "finished") {
              character.setEmoji("🍾");
            }
          }
        }
      } else if (isSurrendered) {
        // For surrendered players, just position the character in the middle of the lane
        let character = this.characters.get(player.name);
        if (character) {
          const lane = this.lanes.get(player.name);
          if (lane) {
            const rect = lane.getBoundingClientRect();
            character.updatePosition({
              x: rect.width / 2,
              y: rect.height / 2
            });
            // Set surrender flag emoji for surrendered players
            character.setEmoji("🏳️");
          }
        }
      }

      // Count non-cancelled URLs, taking into account the cutoff
      const nonCancelledCount = player.path.filter(
        (url) => url.effect !== "cancelled"
      ).length;
      const effectiveLength =
        nonCancelledCount - (this.pathCutoffs.get(player.name) || 0);
      minPathLength = Math.min(minPathLength, effectiveLength);

      // Check if this player has reached the threshold
      if (effectiveLength < 4 || effectiveLength % 4 !== 0) {
        shouldReduce = false;
      }
    });

    // If all players have reached the threshold, trigger reduction
    if (shouldReduce && minPathLength >= 4) {
      // Only trigger reduction if we're not in finished state
      if (state.state !== 'finished') {
        this.triggerBackgroundTransition();
        // Trigger reduction for each player with a random delay
        state.players.forEach((player) => {
          const pathVis = this.pathsVis.get(player.name);
          if (pathVis) {
            // Random delay between 0 and 300ms
            const delay = Math.random() * 300;
            setTimeout(() => {
              pathVis.reducePath();
              // Update the cutoff after reduction
              this.pathCutoffs.set(
                player.name,
                (this.pathCutoffs.get(player.name) || 0) + 3
              );
              // Start continuous updates during reduction
              const updateInterval = setInterval(() => {
                if (!pathVis.isReducing) {
                  clearInterval(updateInterval);
                  return;
                }
                const latestPosition = pathVis.getLatestPlatePosition();
                if (latestPosition) {
                  this.characters.get(player.name).updatePosition(latestPosition);
                }
              }, 16); // Update at ~60fps
            }, delay);
          }
        });
      }
    }

    // Update path visualization
    state.players.forEach((player) => {
      if (this.pathsVis.has(player.name)) {
        // Pass the game state to the path visualization
        const pathVis = this.pathsVis.get(player.name);
        pathVis.update(player.path, state.state);
        // Get the latest plate position and update character position
        const latestPosition = pathVis.getLatestPlatePosition();
        if (latestPosition) {
          this.characters.get(player.name).updatePosition(latestPosition);
        }
      }

      // in the running / waiting state, if the player has not selected a link show one emoji, otherwise another:
      if (state.state === "running" || state.state === "waiting") {
        // if the timer has run out, show different emojis:
        if (state.timerExpired === 0) {
          if (state.submittedPlayers[0] === player.name) {
            this.characters.get(player.name).setEmoji("🤔");
          } else {
            this.characters.get(player.name).setEmoji("💀");
          }
        } else {
          // if the player has not submitted a link, show one emoji, otherwise show another
          if (!state.submittedPlayers.includes(player.name)) {
            this.characters.get(player.name).setEmoji("❓");
          } else {
            this.characters.get(player.name).setEmoji("🔗");
          }
        }
      }
      if (state.state === "paused") {
        if (state.continueResponses.includes(player.name)) {
          this.characters.get(player.name).setEmoji("✅");
        } else {
          this.characters.get(player.name).setEmoji("⏸️");
        }
      }
      if (state.state === "handout") {
        if (
          state.additionState.eligiblePlayers.includes(player.name) &&
          !state.additionState.readyPlayers.includes(player.name)
        ) {
          this.characters.get(player.name).setEmoji("🎁");
        } else if (state.additionState.readyPlayers.includes(player.name)) {
          this.characters.get(player.name).setEmoji("✅");
        } else {
          this.characters.get(player.name).setEmoji("⏸️");
        }
      }

      if (state.state === "finished") {
        const character = this.characters.get(player.name);
        if (character) {
          character.setEmoji("🍾");
        }
      }
    });
  }

  // Add method to set background scene
  setBackgroundScene(scene) {
    this.backgroundScene = scene;
  }

  // Add method to trigger background transition
  triggerBackgroundTransition() {
    if (this.backgroundScene) {
      this.backgroundScene.startTransition();
    }
  }

  getPlayerPath(playerName) {
    return this.pathsVis.get(playerName);
  }

  getPlayerPosition(playerName) {
    const pathVis = this.pathsVis.get(playerName);
    const lane = this.lanes.get(playerName);
    if (!lane) return null;

    if (pathVis) {
      // For regular players, use the path position
      const position = pathVis.getLatestPlatePosition();
      if (position) {
        const laneRect = lane.getBoundingClientRect();
        return {
          x: laneRect.left + laneRect.width / 2,
          y: position.y + 100 // Position below the character
        };
      }
    } else {
      // For surrendered players, position them lower in the lane
      const laneRect = lane.getBoundingClientRect();
      return {
        x: laneRect.left + laneRect.width / 2,
        y: laneRect.top + laneRect.height * 0.6 // Position at 80% of lane height
      };
    }
    return null;
  }
}

export default PlayerLanes;
