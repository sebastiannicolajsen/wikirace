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

// Store previous continueResponses for toast notifications
let previousContinueResponses = [];

// Toast for ready-to-continue (styled like handout.js)
function showReadyToContinuePopup(name) {
    // Create notification container if it doesn't exist
    let notificationContainer = document.getElementById('effect-notifications');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'effect-notifications';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
            width: auto;
            max-width: 90%;
        `;
        document.body.appendChild(notificationContainer);
    }
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        background: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        font-size: 14px;
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s ease;
        pointer-events: none;
        white-space: normal;
        min-width: 200px;
        max-width: 400px;
    `;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="color: #0066cc; font-weight: bold;">${name}</span>
            <span>is ready to continue!</span>
        </div>
    `;
    notificationContainer.appendChild(notification);
    requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

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
                <div class="current-player-url ${effect ? `effect-${effect}` : ''}">
                    <span class="next-url">
                        ⏭️ ${nextUrlTitle}
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

        // --- NEW: Wrap other players in a card section ---
        const otherPlayersSection = document.createElement("div");
        otherPlayersSection.className = "other-players-section";

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

            // --- NEW: Status icon logic ---
            let statusIconHTML = "";
            let isDone = false;
            if (state.config.continuation === "democratic") {
                if (state.continueResponses.includes(player.name)) {
                    statusIconHTML = '<span class="status-icon"><span class="status-check"><svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="10" fill="#43a047"/><path d="M6 10.5L9 13.5L14 7.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></span>';
                    isDone = true;
                } else {
                    statusIconHTML = '<span class="status-icon"><span class="status-spinner"></span></span>';
                    statusItem.classList.add('player-waiting');
                }
            }
            if (isDone) statusItem.classList.add('player-done');
            
            statusItem.innerHTML = `
                <div class="player-info">
                    <span class="player-name">${player.name}</span>
                    ${statusIconHTML}
                </div>
                <div class="player-path">
                    <span class="next-url ${wasChosenByOther ? 'chosen-by-other' : ''} ${effect ? `effect-${effect}` : ''}">
                        ⏭️ ${nextUrlTitle}
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
            otherPlayersSection.appendChild(statusItem);
        });
        playerStatusList.appendChild(otherPlayersSection);
    }

    // Update waiting message based on continuation mode
    const waitingMessage = subpageElement.querySelector("#waitingMessage");
    if (waitingMessage) {
        if (state.config.continuation === "creator") {
            if (websocketManager.playerName === state.creator) {
                waitingMessage.textContent = "Waiting on you";
            } else {
                waitingMessage.textContent = "Waiting for owner to continue...";
            }
            waitingMessage.classList.add("waiting-for-creator");
        } else {
            waitingMessage.textContent = "Waiting for players to continue...";
            waitingMessage.classList.remove("waiting-for-creator");
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

        // --- READY TO CONTINUE TOAST LOGIC ---
        if (state.config?.continuation === 'democratic') {
            const currentContinueResponses = state.continueResponses || [];
            // Find new names in continueResponses
            const newReady = currentContinueResponses.filter(name => !previousContinueResponses.includes(name));
            console.debug('[Paused] New ready to continue:', newReady);
            newReady.forEach(name => {
                if (name !== websocketManager.playerName) { // Don't toast for self
                    showReadyToContinuePopup(name);
                }
            });
            previousContinueResponses = [...currentContinueResponses];
        }

    } catch (error) {
        console.error(`Error processing paused state update:`, error);
        // Optionally display error in the subpageElement
        subpageElement.innerHTML = `<p style="color: red;">Error loading paused view: ${error.message}</p>`;
    }
}

// REMOVED initializeSubpage export 