import websocketManager from "/js/websocket.js";
import { urlToTitle } from "/js/wikiHelper.js";
import popupManager from "/js/popup.js";
import timerManager from "/js/timer.js"; // Import timerManager

// --- State Management ---
// let latestState = null; // No longer needed at module level

// --- Other Module Variables ---
// Remove variables not needed here, they belong in the instance scope if necessary
// let pendingRandomUrls = null;
// let hasMadeRandomSelection = false;
// let missingPlayersSelections = null;
// let currentPopup = null;
// let gameTimer = null; // Timer handled by timerManager

// REMOVED loadPendingSelections, fetchWikiContent, processWikiContent, startTimer
// These are not relevant for the paused state view

// Function to set up the paused page content and interactions
function setupPausedPage(state, subpageElement, timerContainerElement) {
    // Close any existing popups when setting up paused page
    popupManager.closeAllPopups();

    // Update player status list within the subpageElement
    const playerStatusList = subpageElement.querySelector("#playerStatusList");
    if (playerStatusList) {
        playerStatusList.innerHTML = ""; // Clear previous list

        // Find current player
        const currentPlayer = state.players.find(p => p.name === websocketManager.playerName);
        if (currentPlayer) {
            const currentPlayerSection = document.createElement("div");
            currentPlayerSection.className = "current-player-section";
            
            // Get the next URL from the player's path
            const nextUrl = currentPlayer.path[currentPlayer.path.length - 1]?.url || "";
            const nextUrlTitle = nextUrl ? urlToTitle(nextUrl) : "";
            const lastPathEntry = currentPlayer.path[currentPlayer.path.length - 1];
            const effect = lastPathEntry?.effect;
            
            currentPlayerSection.innerHTML = `
                <h4>Your Next Link</h4>
                <div class="current-player-url ${effect ? `effect-${effect}` : ''}">
                    <span class="next-url">
                        📍 ${nextUrlTitle}
                    </span>
                    ${effect === "random" ? `
                        <span class="url-effect">Randomly selected</span>
                    ` : effect === "user_selected" ? `
                        <span class="url-effect">Selected by another player</span>
                    ` : `
                        <span class="url-effect">You chose this link</span>
                    `}
                </div>
            `;
            playerStatusList.appendChild(currentPlayerSection);
        }

        // Add a divider
        const divider = document.createElement("div");
        divider.className = "player-list-divider";
        divider.innerHTML = "<h4>Other Players</h4>";
        playerStatusList.appendChild(divider);

        // Sort other players
        const otherPlayers = state.players
            .filter(p => p.name !== websocketManager.playerName)
            .sort((a, b) => a.name.localeCompare(b.name));

        otherPlayers.forEach((player) => {
            const statusItem = document.createElement("div");
            statusItem.className = "player-status-item";
            statusItem.style.textAlign = "left";
            statusItem.style.display = "flex";
            statusItem.style.flexDirection = "column";
            statusItem.style.alignItems = "flex-start";
            
            // Get the next URL from the player's path
            const nextUrl = player.path[player.path.length - 1]?.url || "";
            const nextUrlTitle = nextUrl ? urlToTitle(nextUrl) : "";
            
            // Determine if the URL was chosen by another player and its effect
            const lastPathEntry = player.path[player.path.length - 1];
            const wasChosenByOther = lastPathEntry?.chosenBy;
            const effect = lastPathEntry?.effect;
            
            // Set background color based on continuation status
            if (state.config.continuation === "democratic") {
                statusItem.style.backgroundColor = state.continueResponses.includes(player.name) ? "#e6ffe6" : "#fffde7";
            }
            
            statusItem.innerHTML = `
                <div class="player-info">
                    <span class="player-name">${player.name}</span>
                </div>
                <div class="player-path">
                    <span class="next-url ${wasChosenByOther ? 'chosen-by-other' : ''} ${effect ? `effect-${effect}` : ''}">
                        📍 ${nextUrlTitle}
                    </span>
                    ${effect === "random" ? `
                        <span class="chosen-by-text">Randomly selected</span>
                    ` : effect === "user_selected" ? `
                        <span class="chosen-by-text">Selected by another player</span>
                    ` : wasChosenByOther ? `
                        <span class="chosen-by-text">Chosen by ${wasChosenByOther}</span>
                    ` : `
                        <span class="chosen-by-text">The player chose this link</span>
                    `}
                </div>
            `;
            playerStatusList.appendChild(statusItem);
        });
    }

    // Update waiting message based on continuation mode
    const waitingMessage = subpageElement.querySelector("#waitingMessage");
    if (waitingMessage) {
        if (state.config.continuation === "creator") {
            waitingMessage.textContent = "Waiting for owner to continue...";
        } else {
            waitingMessage.textContent = "Waiting for players to continue...";
        }
    }

    // Handle continue button within the subpageElement
    const buttonGroup = subpageElement.querySelector(".button-group");
    if (buttonGroup) {
        // Only create and add the button if needed
        if (state.config.continuation === "creator") {
            // In creator mode, only show button to creator
            if (websocketManager.playerName === state.creator) {
                const continueButton = buttonGroup.querySelector("#continueButton");
                if (continueButton) {
                    const newButton = continueButton.cloneNode(true);
                    continueButton.parentNode.replaceChild(newButton, continueButton);

                    newButton.addEventListener("click", () => {
                        websocketManager.sendContinueGame();
                        newButton.disabled = true;
                        newButton.textContent = "Waiting for others...";
                    });
                }
            } else {
                buttonGroup.remove();
            }
        } else if (state.config.continuation === "democratic") {
            // In democratic mode, show button to players who haven't responded
            const continueButton = buttonGroup.querySelector("#continueButton");
            if (continueButton) {
                const newButton = continueButton.cloneNode(true);
                continueButton.parentNode.replaceChild(newButton, continueButton);

                if (state.continueResponses.includes(websocketManager.playerName)) {
                    // Player has already responded - show disabled button
                    newButton.disabled = true;
                    newButton.textContent = "Waiting for others...";
                } else {
                    // Player hasn't responded yet - show active button
                    newButton.addEventListener("click", () => {
                        websocketManager.sendReadyToContinue();
                        newButton.disabled = true;
                        newButton.textContent = "Waiting for others...";
                    });
                }
            }
        } else {
            // For any other continuation mode, remove the button
            buttonGroup.remove();
        }
    }

    // Start waiting timer if applicable, passing the specific container
    if (state.timeLimit && timerContainerElement) {
        // --- DEBUG LOG --- 
        console.log(`[DEBUG paused.js] setupPausedPage calling startWaitingTimer. Timer Container:`, timerContainerElement);
        timerManager.startWaitingTimer(state.waitingTimerStartTime, state.timeLimit * 1000, timerContainerElement);
    } else {
        // --- DEBUG LOG --- 
        console.log(`[DEBUG paused.js] setupPausedPage stopping waiting timer. Timer Container:`, timerContainerElement);
        // Ensure timer is stopped/hidden if no limit or container missing
        timerManager.stopWaitingTimer();
    }
}

// REMOVED _processStateUpdate

// Exported function to handle incoming state updates
// Refactored to load HTML into subpageElement and call setup
export async function handleStateUpdate(state, subpageElement, timerContainerElement) { 
    // --- DEBUG LOG --- 
    console.log(`[DEBUG paused.js] handleStateUpdate received. Timer Container:`, timerContainerElement);

    if (!state || !subpageElement) {
        console.error("Paused handleStateUpdate: Missing state or subpageElement");
        return;
    }
    
    try {
        // Close any existing popups when entering paused state
        popupManager.closeAllPopups();
        
        // Fetch the paused HTML template
        const response = await fetch('/game/paused.html');
        if (!response.ok) {
            throw new Error(`Failed to fetch paused.html: ${response.statusText}`);
        }
        const html = await response.text();
        
        // Load the HTML into the provided subpage element
        subpageElement.innerHTML = html;

        // Setup the content, listeners, and timer
        setupPausedPage(state, subpageElement, timerContainerElement);

    } catch (error) {
        console.error(`Error processing paused state update:`, error);
        // Optionally display error in the subpageElement
        subpageElement.innerHTML = `<p style="color: red;">Error loading paused view: ${error.message}</p>`;
    }
}

// REMOVED initializeSubpage export 