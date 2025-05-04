import websocketManager from "/js/websocket.js";
import popupManager from "/js/popup.js";

// --- Timer Management ---
let gameTimer = null;
const TIMER_ELEMENT_ID = 'gameTimer';

// Add at the top of the file, after imports
let additionNotificationQueue = [];

// Function to format time (seconds only)
function formatTime(seconds) {
    return `${Math.ceil(seconds)}s`;
}

// Function to update the timer display
function updateTimer(endTime) {
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }

    const timerElement = document.getElementById(TIMER_ELEMENT_ID);
    const timerTextElement = document.querySelector('.timer-text');
    if (!timerElement || !timerTextElement) {
        console.error(`Timer elements not found.`);
        return;
    }

    // Get the initial duration from the end time
    const initialDuration = (endTime - Date.now()) / 1000;

    function updateTimerDisplay() {
        const now = Date.now();
        const remaining = Math.max(0, (endTime - now) / 1000);
        const progress = (remaining / initialDuration) * 100;
        
        // Update the timer text and progress bar
        timerTextElement.textContent = formatTime(remaining);
        timerElement.style.background = `linear-gradient(to right, #2196F3 ${progress}%, #e0e0e0 ${progress}%)`;

        if (remaining <= 0) {
            clearInterval(gameTimer);
            timerTextElement.textContent = "0s";
            timerElement.style.background = "#e0e0e0";
            gameTimer = null;
        }
    }

    updateTimerDisplay();
    gameTimer = setInterval(updateTimerDisplay, 1000);
}

// Function to stop the timer
function stopTimer() {
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }
    
    const timerElement = document.getElementById(TIMER_ELEMENT_ID);
    const timerTextElement = document.querySelector('.timer-text');
    if (timerElement && timerTextElement) {
        timerTextElement.textContent = "--";
        timerElement.style.background = "#e0e0e0";
    }
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
                    ? getAdditionEmoji(lastLink.effect.replace('ed', '')) 
                    : '';
                const linkText = formatLinkTitle(lastLink?.url);
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
    const isEligible = state.additionState?.eligiblePlayers?.includes(websocketManager.playerName);
    
    // Find the content container
    const contentContainer = subpageElement.querySelector("#handout-content");
    if (!contentContainer) {
        console.error("Content container not found");
        return;
    }
    
    if (isEligible) {
        // Show the full interface for eligible players
        contentContainer.innerHTML = `
            <div class="handout-message">
                <h3>Play your effects!</h3>
                <p>Choose an addition to use...</p>
            </div>

            <div class="additions-section">
                <h3 class="section-title">Your Additions</h3>
                <div id="playerAdditions" class="additions-list">
                    <!-- Addition items will be added here -->
                </div>
            </div>

            <button id="readyToContinueButton" class="button">Ready to Continue</button>
        `;

        // Update timer if we have an end time
        if (state.additionState?.additionEndTime) {
            updateTimer(state.additionState.additionEndTime);
        } else {
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
        // Show simplified interface for non-eligible players
        contentContainer.innerHTML = `
            <div class="handout-message">
                <h3>Play your effects!</h3>
                <p>Other players are playing effect cards...</p>
            </div>
        `;

        // Update timer if we have an end time
        if (state.additionState?.additionEndTime) {
            updateTimer(state.additionState.additionEndTime);
        } else {
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