import websocketManager from "/js/websocket.js";
import popupManager from "/js/popup.js";

// Track if we're currently in a running state transition
let isRunningStateTransition = false;

// Track if this is a page reload
let isPageReload = false;

// Track the last received state version
let lastReceivedStateVersion = 0;

// Set reload flag on unload
window.addEventListener('unload', () => {
    localStorage.setItem('isPageReload', 'true');
});

// Check for reload flag on load
window.addEventListener('load', () => {
    isPageReload = localStorage.getItem('isPageReload') === 'true';
});

// Function to get the relevant URL for the current player
export function getCurrentPlayerUrl(state) {
    if (!state) return null;
    
    const player = state.players.find(p => p.name === websocketManager.playerName);
    if (!player) return state.startUrl;
    
    // If player has no path entries, return start URL
    if (!player.path || player.path.length === 0) {
        return state.startUrl;
    }

    // If game is running, return the latest URL
    if (state.state === 'running') {
        return player.path[player.path.length - 1].url;
    }

    // If game is waiting and player has submitted
    if (state.state === 'waiting' && state.submittedPlayers?.includes(player.name)) {
        // If player has more than one link, return the second to last one
        if (player.path.length > 1) {
            return player.path[player.path.length - 2].url;
        }
        // Otherwise return start URL
        return state.startUrl;
    }

    // For any other case, return the latest URL
    return player.path[player.path.length - 1].url;
}

// Function to close all popups
function closeAllPopups() {
    try {
        // First use popupManager's closeAllPopups to close all managed popups
        popupManager.closeAllPopups();
        
        // Then close any remaining popups that might not be tracked by popupManager
        const popups = document.querySelectorAll('.popup');
        popups.forEach(popup => {
            if (popup && popup.classList.contains('popup')) {
                popupManager.closePopup(popup);
            }
        });
        
        // Also close any popup overlays that might be left
        const overlays = document.querySelectorAll('.popup-overlay');
        overlays.forEach(overlay => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        });
    } catch (error) {
        console.error('Error closing popups:', error);
    }
}

// Function to handle transition from lobby to game
export async function handleLobbyToGameTransition() {
    // Redirect to game page immediately
    window.location.href = `/game/${websocketManager.roomId}`;
}

// Function to reset all state when transitioning to running state
async function resetStateForRunning() {
    console.log('Performing complete state reset for running state');
    
    // 1. Reset module-level variables
    isRunningStateTransition = true;
    isPageReload = false;
    
    // 2. Clear localStorage items
    const localStorageItems = [
        'currentGameState',
        'currentWikiLink',
        'selectedWikiLink',
        'pendingSelections',
        'selectedUrls',
        'currentIndex',
        'isPageReload'
    ];
    localStorageItems.forEach(item => localStorage.removeItem(item));
    
    // 3. Clear sessionStorage items
    const sessionStorageItems = [
        'timerState',
        'pendingSelections',
        'selectedUrls',
        'currentIndex'
    ];
    sessionStorageItems.forEach(item => sessionStorage.removeItem(item));
    
    // 4. Close all popups and clean up UI
    closeAllPopups();
    
    // 5. Clean up any remaining overlays
    const remainingOverlays = document.querySelectorAll('.popup-overlay');
    remainingOverlays.forEach(overlay => {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    });
    
    // 6. Reset subpage content
    const subpageElement = document.querySelector('.subpage');
    if (subpageElement) {
        subpageElement.innerHTML = '';
        subpageElement.dataset.state = 'running';
    }
    
    // 7. Clear any existing timers
    const timerElement = document.getElementById('gameTimer');
    if (timerElement) {
        timerElement.textContent = '--:--';
    }
    
    console.log('State reset complete');
}

// Handle state updates
function handleStateUpdate(state) {
    // If we receive an older version of the state, ignore it
    if (state.version && state.version < lastReceivedStateVersion) {
        console.log(`Ignoring outdated state version ${state.version} (current: ${lastReceivedStateVersion})`);
        return;
    }

    // Update the last received version
    if (state.version) {
        lastReceivedStateVersion = state.version;
    }

    // Process the state update
    // ... existing code ...
}

// Reset state version when leaving a room
function resetState() {
    lastReceivedStateVersion = 0;
    // ... existing reset code ...
}

export async function loadGameState(state, gameContentContainer) { 
    // Check state version first
    if (state.version && state.version < lastReceivedStateVersion) {
        console.log(`Ignoring outdated state version ${state.version} (current: ${lastReceivedStateVersion})`);
        return;
    }

    // Update the last received version
    if (state.version) {
        lastReceivedStateVersion = state.version;
    }

    // Check if containers were provided
    if (!gameContentContainer) {
        console.error("loadGameState: gameContentContainer element was not provided!");
        return;
    }

    // Get current state from localStorage
    const currentState = localStorage.getItem('currentGameState') || '';

    // Handle state transitions and cleanup
    if (state.state === 'running' && currentState && currentState !== 'running') {
        console.log('Transitioning to running state, performing cleanup');
        await resetStateForRunning();
    }

    // Close all popups when state changes
    closeAllPopups();
    
    // Update localStorage and subpage state
    localStorage.setItem('currentGameState', state.state);
    gameContentContainer.dataset.state = state.state;

    // Create or get subpage element
    let subpageElement = gameContentContainer.querySelector('.subpage');
    if (!subpageElement) {
        subpageElement = document.createElement('div');
        subpageElement.className = 'subpage';
        gameContentContainer.appendChild(subpageElement);
    }

    // Get timer container
    const timerContainer = document.getElementById('timerContainer');

    // Clear existing content and show loading state
    subpageElement.innerHTML = '<div class="loading">Loading...</div>';
    
    try {
        // Handle different states
        switch (state.state) {
            case 'running':
            case 'waiting':
                const runningModule = await import('/game/running.js');
                await runningModule.handleStateUpdate(state, subpageElement, timerContainer);
                break;
            case 'paused':
                const pauseModule = await import('/game/paused.js');
                await pauseModule.handleStateUpdate(state, subpageElement, timerContainer);
                break;
            case 'handout':
                const handoutModule = await import('/game/handout.js');
                await handoutModule.handleStateUpdate(state, subpageElement, timerContainer);
                break;
            case 'finished':
                const finishedModule = await import('/game/finished.js');
                await finishedModule.handleStateUpdate(state, subpageElement, timerContainer);
                break;
            default:
                // For any other state, just clear the content
                subpageElement.innerHTML = '';
        }

        // Ensure subpage is visible
        subpageElement.style.cssText = `
            display: block;
            visibility: visible;
            opacity: 1;
            transform: none;
            position: relative;
            z-index: 1;
        `;
    } catch (error) {
        console.error('Error during state update:', error);
        subpageElement.innerHTML = `<div class="error">Error loading state: ${error.message}</div>`;
    }
} 