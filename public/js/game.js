// Game-specific functions
function toggleGameInterface(showGame) {
    console.log('toggleGameInterface called with showGame:', showGame);
    const waitingScreen = document.getElementById('waitingScreen');
    const gameFrame = document.getElementById('gameFrame');
    const playerStatus = document.getElementById('playerStatus');
    const timer = document.getElementById('timer');
    
    if (showGame) {
        if (waitingScreen) {
            console.log('Hiding waiting screen');
            waitingScreen.style.display = 'none';
        }
        if (gameFrame) {
            console.log('Showing game frame');
            gameFrame.style.display = 'block';
        }
        if (playerStatus) {
            playerStatus.classList.add('hidden');
        }
        if (timer) {
            timer.classList.add('hidden');
        }
    } else {
        if (waitingScreen) {
            console.log('Showing waiting screen');
            waitingScreen.style.display = 'flex';
        }
        if (gameFrame) {
            console.log('Hiding game frame');
            gameFrame.style.display = 'none';
        }
    }
}

function showWaitingScreen(message, waitingForPlayers) {
    console.log('showWaitingScreen called with message:', message, 'waiting for:', waitingForPlayers);
    const waitingScreen = document.getElementById('waitingScreen');
    const waitingText = document.createElement('div');
    waitingText.className = 'text-center mb-4';
    
    // Format the end URL for display
    const endUrl = currentRoom.endUrl;
    const endTitle = endUrl.split('/wiki/').pop()?.replace(/_/g, ' ') || '';
    const formattedEndUrl = decodeURIComponent(endTitle);
    
    waitingText.innerHTML = `
        <h2 class="text-2xl font-bold mb-4">${message}</h2>
        <p class="text-gray-600 mb-4">Still waiting for: ${waitingForPlayers.join(', ')}</p>
        <div class="mb-4">
            <p class="text-gray-600 font-semibold">Current: <span class="text-blue-600">${decodeURIComponent(currentRoom.currentUrl.split('/wiki/').pop()?.replace(/_/g, ' ') || '')}</span></p>
            <p class="text-gray-600 font-semibold">Goal: <span class="text-blue-600">${formattedEndUrl}</span></p>
            <p class="text-gray-600 text-sm">${endUrl}</p>
        </div>
    `;
    
    waitingScreen.innerHTML = '';
    waitingScreen.appendChild(waitingText);
    console.log('Setting waiting screen display to flex');
    waitingScreen.style.display = 'flex';

    // If the message is "We picked for you!", hide the screen after 10 seconds
    if (message === 'We picked for you!') {
        // First hide the game interface
        toggleGameInterface(false);
        
        // Then set a timeout to show it again after 10 seconds
        setTimeout(() => {
            waitingScreen.style.display = 'none';
            toggleGameInterface(true);
        }, 10000);
    } else {
        // For other messages, just hide the game interface
        toggleGameInterface(false);
    }
}

// Export the functions
window.GameManager = {
    toggleGameInterface,
    showWaitingScreen
}; 