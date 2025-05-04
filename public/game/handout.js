import websocketManager from "/js/websocket.js";
import popupManager from "/js/popup.js";
import { urlToTitle } from "/js/wikiHelper.js";

// --- Timer Management ---
let gameTimer = null;
const TIMER_ELEMENT_ID = 'gameTimer';
let totalDuration = null; // Store the total duration at module level

// Add at the top of the file, after imports
let additionNotificationQueue = [];

// Function to format time (seconds only)
function formatTime(seconds) {
    return `${Math.ceil(seconds)}s`;
}

// Function to start/update the game timer based on server state
function updateTimer(endTime, isEligible = true) {
    if (gameTimer) {
        cancelAnimationFrame(gameTimer);
        gameTimer = null;
    }

    const timerElement = document.getElementById(TIMER_ELEMENT_ID);
    if (!timerElement) {
        console.error(`Timer element with ID '${TIMER_ELEMENT_ID}' not found.`);
        return;
    }

    // Only calculate total duration if it hasn't been set yet
    if (totalDuration === null) {
        totalDuration = (endTime - Date.now()) / 1000;
    }
    
    function updateTimerDisplay() {
        const now = Date.now();
        const remaining = Math.max(0, (endTime - now) / 1000);
        const formattedTime = formatTime(remaining);
        
        // Calculate progress percentage based on the total duration
        const progress = (remaining / totalDuration) * 100;
        
        // Update the timer text and background
        timerElement.textContent = formattedTime;
        // Use rgb(226, 229, 234) for active players, lighter gray for others
        const activeColor = isEligible ? 'rgb(226, 229, 234)' : 'rgb(240, 240, 240)';
        timerElement.style.background = `linear-gradient(to right, ${activeColor} ${progress}%, white ${progress}%)`;

        if (remaining <= 0) {
            cancelAnimationFrame(gameTimer);
            timerElement.textContent = "0s";
            timerElement.style.background = "white";
            gameTimer = null;
            totalDuration = null; // Reset total duration when timer completes
        } else {
            gameTimer = requestAnimationFrame(updateTimerDisplay);
        }
    }

    updateTimerDisplay();
}

// Function to stop the timer
function stopTimer() {
    if (gameTimer) {
        cancelAnimationFrame(gameTimer);
        gameTimer = null;
    }
    
    const timerElement = document.getElementById(TIMER_ELEMENT_ID);
    if (timerElement) {
        timerElement.textContent = "--";
        timerElement.style.background = "rgba(224, 224, 224, 0.9)";
    }
    totalDuration = null; // Reset total duration when timer is stopped
}

// Function to get emoji for addition type
function getAdditionEmoji(type) {
    switch (type) {
        case 'bomb': return '💣';
        case 'swap': return '🔄';
        case 'return': return '↩️';
        default: return '❓';
    }
}

// Function to check if a player can receive an addition
function canReceiveAddition(player, state) {
    if (!player.path || player.path.length === 0) return true;
    
    // If additions_application is 'once', check if the player's recent links are already affected
    if (state.config?.additions_application === 'once') {
        const lastLink = player.path[player.path.length - 1];
        const secondLastLink = player.path.length > 1 ? player.path[player.path.length - 2] : null;
        
        // Check if the last link has an effect from an addition
        const isLastLinkAffected = lastLink.effect && ['bombed', 'swapped', 'returned', 'cancelled'].includes(lastLink.effect);
        // Check if the second last link was cancelled
        const isSecondLastLinkCancelled = secondLastLink && secondLastLink.effect === 'cancelled';
        
        if (isLastLinkAffected || isSecondLastLinkCancelled) {
            return false;
        }
    }
    
    // For all cases, check if the last link has an effect
    const lastEntry = player.path[player.path.length - 1];
    return !lastEntry.effect || !['swap', 'bomb', 'return'].includes(lastEntry.effect);
}

// Function to format link title
function formatLinkTitle(url) {
    if (!url) return 'No links yet';
    const title = url.split('/').pop();
    return title
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

// Function to show target selection popup
function showTargetSelectionPopup(additionType, state) {
    const popup = document.createElement('div');
    popup.className = 'target-selection-popup';
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 1.5rem;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        min-width: 300px;
        max-width: 90%;
    `;

    const eligiblePlayers = state.players.filter(p => 
        p.name !== websocketManager.playerName && 
        canReceiveAddition(p, state)
    );

    popup.innerHTML = `
        <h3 style="margin: 0 0 1rem;">Select Target for ${getAdditionEmoji(additionType)} ${additionType}</h3>
        <div class="target-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${eligiblePlayers.map(player => {
                const lastLink = player.path[player.path.length - 1];
                const effectEmoji = lastLink?.effect && ['swapped', 'returned', 'bombed'].includes(lastLink.effect) 
                    ? getAdditionEmoji(lastLink.effect.replace('ed', '')) + ' ' 
                    : '';
                const linkText = lastLink?.url ? urlToTitle(lastLink.url) : 'No links yet';
                return `
                    <button class="target-button" data-player="${player.name}" style="
                        padding: 0.75rem;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        background: white;
                        cursor: pointer;
                        text-align: left;
                        transition: background-color 0.2s;
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                    ">
                        <div style="font-weight: bold;">${player.name}</div>
                        <div style="font-size: 0.9em; color: #666;">
                            ${effectEmoji}${linkText}
                        </div>
                    </button>
                `;
            }).join('')}
        </div>
    `;

    // Add click handlers
    popup.querySelectorAll('.target-button').forEach(button => {
        button.addEventListener('click', () => {
            const targetPlayer = button.dataset.player;
            websocketManager.sendUseAddition(additionType, targetPlayer);
            document.body.removeChild(overlay);
            document.body.removeChild(popup);
        });
        
        // Add hover effects
        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = '#f5f5f5';
        });
        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = 'white';
        });
    });

    // Add overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
    `;
    overlay.addEventListener('click', () => {
        document.body.removeChild(overlay);
        document.body.removeChild(popup);
    });

    document.body.appendChild(overlay);
    document.body.appendChild(popup);
}

function setupHandoutPage(state, subpageElement) {
    console.log('Setting up handout page with state:', state);
    const isEligible = state.additionState?.eligiblePlayers?.includes(websocketManager.playerName);
    const isReady = state.additionState?.readyPlayers?.includes(websocketManager.playerName);
    
    // Find the content container
    const contentContainer = subpageElement.querySelector("#handout-content");
    if (!contentContainer) {
        console.error("Content container not found");
        return;
    }

    // Add spacing to prevent content from being hidden under header and timer
    contentContainer.style.cssText = `
        margin-top: 80px;  /* Add space for header and timer */
        padding: 20px;
    `;
    
    if (isEligible && !isReady) {
        // Show the full interface for eligible players who haven't used their addition
        contentContainer.innerHTML = `
            <div class="handout-message">
                <h3>Play your effects!</h3>
                <p>Choose an effect to use...</p>
            </div>

            <div class="additions-section">
                <h3 class="section-title">Your Effects</h3>
                <div id="playerAdditions" class="additions-list">
                    <!-- Addition items will be added here -->
                </div>
            </div>

            <button id="readyToContinueButton" class="button">Ready to Continue</button>
        `;

        // Update timer if we have an end time
        if (state.additionState?.additionEndTime) {
            console.log('Starting timer with end time:', state.additionState.additionEndTime);
            updateTimer(state.additionState.additionEndTime, true);
        } else {
            console.log('No end time found in state, stopping timer');
            stopTimer();
        }

        // Update player additions
        const playerAdditions = contentContainer.querySelector("#playerAdditions");
        playerAdditions.innerHTML = "";
        const player = state.players.find(p => p.name === websocketManager.playerName);
        if (player && player.additions) {
            // Check if there are any eligible players
            const hasEligiblePlayers = state.players.some(p => 
                p.name !== websocketManager.playerName && 
                canReceiveAddition(p, state)
            );

            Object.entries(player.additions).forEach(([type, count]) => {
                const additionItem = document.createElement("div");
                additionItem.className = "addition-item";
                const isEnabled = count > 0 && hasEligiblePlayers;
                additionItem.style.cssText = `
                    padding: 1rem;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: ${isEnabled ? 'pointer' : 'not-allowed'};
                    opacity: ${isEnabled ? '1' : '0.5'};
                    transition: background-color 0.2s;
                `;
                
                additionItem.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.5rem;">${getAdditionEmoji(type)}</span>
                        <span>${type}</span>
                    </div>
                    <span style="font-weight: bold;">${count}</span>
                `;

                if (isEnabled) {
                    additionItem.addEventListener('click', () => {
                        showTargetSelectionPopup(type, state);
                    });
                    additionItem.addEventListener('mouseover', () => {
                        additionItem.style.backgroundColor = '#f5f5f5';
                    });
                    additionItem.addEventListener('mouseout', () => {
                        additionItem.style.backgroundColor = 'white';
                    });
                }

                playerAdditions.appendChild(additionItem);
            });
        }

        // Handle ready to continue button
        const readyToContinueButton = contentContainer.querySelector("#readyToContinueButton");
        readyToContinueButton.addEventListener("click", () => {
            websocketManager.sendReadyToContinueFromHandout();
            readyToContinueButton.disabled = true;
            readyToContinueButton.textContent = "Waiting for others...";
        });

    } else {
        // Get list of eligible players who haven't used their effects
        const activePlayers = state.additionState?.eligiblePlayers?.filter(
            player => !state.additionState?.readyPlayers?.includes(player)
        ) || [];

        // Show simplified interface for non-eligible players or players who have used their addition
        contentContainer.innerHTML = `
            <div class="handout-message">
                <h3>${activePlayers.map(name => `<span style="color: #0066cc;">${name}</span>`).join(', ')} are choosing to play effect cards!</h3>
            </div>
        `;

        // Update timer if we have an end time
        if (state.additionState?.additionEndTime) {
            console.log('Starting timer with end time:', state.additionState.additionEndTime);
            updateTimer(state.additionState.additionEndTime, false);
        } else {
            console.log('No end time found in state, stopping timer');
            stopTimer();
        }
    }
}

// Function to process the notification queue
function processNotificationQueue() {
    while (additionNotificationQueue.length > 0) {
        const notification = additionNotificationQueue.shift();
        showEffectUsagePopup(notification.sender, notification.type, notification.target);
    }
}

// Function to handle addition used event
function handleAdditionUsed(event) {
    console.log('Addition used event received:', event.detail);
    const { sender, type, target } = event.detail;
    // Add to queue instead of showing immediately
    additionNotificationQueue.push({ sender, type, target });
    // Process queue after a short delay to ensure DOM is ready
    setTimeout(processNotificationQueue, 100);
}

// Function to show effect usage popup
function showEffectUsagePopup(sender, type, target) {
    console.log('Showing effect usage popup:', { sender, type, target });
    const emoji = getAdditionEmoji(type);
    
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
            <span style="color: #0066cc; font-weight: bold;">${sender}</span>
            used ${emoji} ${type} on
            <span style="color: #0066cc; font-weight: bold;">${target}</span>
        </div>
    `;
    
    // Add to container
    notificationContainer.appendChild(notification);
    
    // Trigger animation
    requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    });
    
    // Remove after delay
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300); // Wait for fade out animation
    }, 3000);
}

export async function handleStateUpdate(state, subpageElement) {
    if (!state || !subpageElement) {
        console.error("Handout handleStateUpdate: Missing state or subpageElement");
        return;
    }
    
    try {
        // Fetch the handout HTML template
        const response = await fetch('/game/handout.html');
        if (!response.ok) {
            throw new Error(`Failed to fetch handout.html: ${response.statusText}`);
        }
        const html = await response.text();
        
        // Load the HTML into the provided subpage element
        subpageElement.innerHTML = html;

        // Setup the content and listeners
        setupHandoutPage(state, subpageElement);

        // Process any queued notifications after state update
        setTimeout(processNotificationQueue, 100);

    } catch (error) {
        console.error(`Error processing handout state update:`, error);
        subpageElement.innerHTML = `<p style="color: red;">Error loading handout view: ${error.message}</p>`;
    }
}

// Add event listener outside of state update
window.addEventListener('addition-used', handleAdditionUsed); 