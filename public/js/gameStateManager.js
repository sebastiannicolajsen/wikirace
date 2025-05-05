import websocketManager from "/js/websocket.js";
import popupManager from "/js/popup.js";

// Track if we're currently in a running state transition
let isRunningStateTransition = false;

// Track if this is a page reload
let isPageReload = false;

// Track the last received state version
let lastReceivedStateVersion = 0;

// Track state initialization
let isStateInitialized = false;

// Set reload flag on unload
window.addEventListener('unload', () => {
    localStorage.setItem('isPageReload', 'true');
});

// Check for page reload on load
window.addEventListener('load', () => {
    isPageReload = localStorage.getItem('isPageReload') === 'true';
    localStorage.removeItem('isPageReload');
    
    // If this is a reload, clear all state
    if (isPageReload) {
        console.log('Page reload detected, clearing all state');
        clearAllState();
    }
});

// Function to clear all state
function clearAllState() {
    // Clear all localStorage items
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('game_') || 
            key === 'currentGameState' || 
            key === 'currentWikiLink' || 
            key === 'selectedWikiLink' || 
            key === 'pendingSelections' || 
            key === 'selectedUrls' || 
            key === 'currentIndex' || 
            key === 'isPageReload') {
            localStorage.removeItem(key);
        }
    });

    // Clear all sessionStorage items
    Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('game_') || 
            key === 'timerState' || 
            key === 'pendingSelections' || 
            key === 'selectedUrls' || 
            key === 'currentIndex') {
            sessionStorage.removeItem(key);
        }
    });

    // Reset module-level variables
    isRunningStateTransition = false;
    isPageReload = false;
    lastReceivedStateVersion = 0;
    isStateInitialized = false;
}

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
    
    // Clear all state first
    clearAllState();
    
    // Set running state transition flag
    isRunningStateTransition = true;
    
    // Close all popups and clean up UI
    closeAllPopups();
    
    // Clean up any remaining overlays
    const remainingOverlays = document.querySelectorAll('.popup-overlay');
    remainingOverlays.forEach(overlay => {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    });
    
    // Reset subpage content
    const subpageElement = document.querySelector('.subpage');
    if (subpageElement) {
        subpageElement.innerHTML = '';
        subpageElement.dataset.state = 'running';
    }
    
    // Clear any existing timers
    const timerElement = document.getElementById('gameTimer');
    if (timerElement) {
        timerElement.textContent = '--:--';
    }
    
    console.log('State reset complete');
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

    // Handle lobby state transition
    if (state.state === 'lobby') {
        console.log('Received lobby state, redirecting to room');
        window.location.href = `/room/${state.id}`;
        return;
    }

    // Check if containers were provided
    if (!gameContentContainer) {
        console.error("loadGameState: gameContentContainer element was not provided!");
        return;
    }

    // Get current state from localStorage
    const currentState = localStorage.getItem('currentGameState') || '';

    // Handle state transitions and cleanup
    if (state.state === 'running' && (!isStateInitialized || currentState !== 'running')) {
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

    // Check if we need to reload the subpage
    const currentSubpageType = subpageElement.dataset.subpageType;
    const newSubpageType = state.state;
    
    // For running/waiting states, we don't want to show loading state if the URL hasn't changed
    const isRunningOrWaiting = state.state === 'running' || state.state === 'waiting';
    const currentUrl = subpageElement.dataset.currentUrl;
    const newUrl = getCurrentPlayerUrl(state);
    const urlChanged = currentUrl !== newUrl;
    
    // Only show loading state if:
    // 1. The subpage type has changed AND we're not in running/waiting state, OR
    // 2. We're in running/waiting state AND the URL has changed
    const shouldShowLoading = (currentSubpageType !== newSubpageType && !isRunningOrWaiting) || 
                            (isRunningOrWaiting && urlChanged);
    
    if (shouldShowLoading) {
        console.log(`Showing loading state: type changed=${currentSubpageType !== newSubpageType}, not running/waiting=${!isRunningOrWaiting}, url changed=${urlChanged}`);
        subpageElement.innerHTML = '<div class="loading">Loading...</div>';
        // Reset scroll position only when loading a different subpage type
        if (currentSubpageType !== newSubpageType) {
            window.scrollTo(0, 0);
            if (gameContentContainer) {
                gameContentContainer.scrollTop = 0;
            }
        }
    } else {
        console.log(`Skipping loading state: type unchanged (${newSubpageType}) and URL unchanged`);
    }
    
    // Always update the subpage type and URL
    subpageElement.dataset.subpageType = newSubpageType;
    if (isRunningOrWaiting) {
        subpageElement.dataset.currentUrl = newUrl;
    }
    
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