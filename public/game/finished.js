import websocketManager from "/js/websocket.js";
import { urlToTitle } from "/js/wikiHelper.js";
import popupManager from "/js/popup.js";
import websocket from "/js/websocket.js";

// Function to get effect emoji
function getEffectEmoji(effect) {
    switch (effect) {
        case 'start': return '📍';
        case 'end': return '🏁';
        case 'bombed': return '💣';
        case 'swapped': return '🔄';
        case 'returned': return '↩️';
        case 'random': return '🎲';
        case 'user_selected': return '👥';
        case 'surrender': return '🏳️';
        case 'cancelled': return '❌';
        default: return '➡️';
    }
}

// Function to create a path entry element
function createPathEntry(url, effect) {
    const entry = document.createElement('div');
    entry.className = `path-entry ${effect ? `effect-${effect}` : ''}`;
    
    const emoji = document.createElement('span');
    emoji.className = 'effect-emoji';
    emoji.textContent = getEffectEmoji(effect);
    
    const urlSpan = document.createElement('span');
    urlSpan.className = 'path-url';
    urlSpan.textContent = urlToTitle(url);
    
    entry.appendChild(emoji);
    entry.appendChild(urlSpan);
    
    return entry;
}

// Function to create a player path element
function createPlayerPath(player, isCurrentPlayer = false) {
    console.log('Creating path for player:', player.name, 'isCurrentPlayer:', isCurrentPlayer);
    const container = document.createElement('div');
    container.className = 'player-path';
    if (isCurrentPlayer) {
        container.classList.add('current-player');
    }
    
    // Add player name
    const nameDiv = document.createElement('div');
    nameDiv.className = 'player-name';
    nameDiv.textContent = isCurrentPlayer ? `${player.name} (you)` : player.name;
    container.appendChild(nameDiv);
    
    // Create container for path entries
    const entriesContainer = document.createElement('div');
    entriesContainer.className = 'path-entries';
    
    // Add path entries
    player.path.forEach(entry => {
        entriesContainer.appendChild(createPathEntry(entry.url, entry.effect));
    });
    
    container.appendChild(entriesContainer);
    return container;
}

// Function to setup swipe functionality
function setupSwipeFunctionality(subpageElement) {
    const swipeContainer = subpageElement.querySelector('.swipe-container');
    const dots = subpageElement.querySelectorAll('.dot');
    let startX, scrollLeft;
    let currentIndex = 0;

    // Update dots based on current section
    function updateDots(index) {
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
    }

    // Handle scroll events
    swipeContainer.addEventListener('scroll', () => {
        const scrollPosition = swipeContainer.scrollLeft;
        const sectionWidth = swipeContainer.offsetWidth;
        const newIndex = Math.round(scrollPosition / sectionWidth);
        
        if (newIndex !== currentIndex) {
            currentIndex = newIndex;
            updateDots(currentIndex);
        }
    });

    // Handle click/tap on right side of screen
    swipeContainer.addEventListener('click', (e) => {
        const rect = swipeContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const containerWidth = rect.width;
        
        // If click is on the right half of the screen
        if (clickX > containerWidth / 2) {
            const sectionWidth = swipeContainer.offsetWidth;
            const maxIndex = Math.floor(swipeContainer.scrollWidth / sectionWidth) - 1;
            
            if (currentIndex < maxIndex) {
                currentIndex++;
                swipeContainer.scrollTo({
                    left: currentIndex * sectionWidth,
                    behavior: 'smooth'
                });
                updateDots(currentIndex);
            }
        }
        // If click is on the left half of the screen
        else if (clickX < containerWidth / 2) {
            if (currentIndex > 0) {
                currentIndex--;
                const sectionWidth = swipeContainer.offsetWidth;
                swipeContainer.scrollTo({
                    left: currentIndex * sectionWidth,
                    behavior: 'smooth'
                });
                updateDots(currentIndex);
            }
        }
    });

    // Only setup touch events for mobile
    if (window.innerWidth < 768) {
        // Touch events for swipe
        swipeContainer.addEventListener('touchstart', (e) => {
            startX = e.touches[0].pageX - swipeContainer.offsetLeft;
            scrollLeft = swipeContainer.scrollLeft;
        });

        swipeContainer.addEventListener('touchmove', (e) => {
            if (!startX) return;
            e.preventDefault();
            const x = e.touches[0].pageX - swipeContainer.offsetLeft;
            const walk = (x - startX) * 1.5;
            swipeContainer.scrollLeft = scrollLeft - walk;
        });

        swipeContainer.addEventListener('touchend', () => {
            if (!startX) return;
            const sectionWidth = swipeContainer.offsetWidth;
            const scrollPosition = swipeContainer.scrollLeft;
            const targetIndex = Math.round(scrollPosition / sectionWidth);
            
            swipeContainer.scrollTo({
                left: targetIndex * sectionWidth,
                behavior: 'smooth'
            });
            startX = null;
        });
    }

    // Click on dots to navigate
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            const sectionWidth = swipeContainer.offsetWidth;
            swipeContainer.scrollTo({
                left: index * sectionWidth,
                behavior: 'smooth'
            });
        });
    });

    // Initialize first dot as active
    updateDots(0);
}

// Function to set up the finished page content
function setupFinishedPage(state, subpageElement) {
    console.log('Setting up finished page with state:', state);
    const swipeContainer = subpageElement.querySelector('.swipe-container');
    const dotsContainer = subpageElement.querySelector('.swipe-indicator');
    
    // Remove header
    const header = document.querySelector('header');
    if (header) {
        header.style.display = 'none';
    }
    
    // Clear existing content
    swipeContainer.innerHTML = '';
    dotsContainer.innerHTML = '';
    
    // Set room name and URLs
    const roomName = subpageElement.querySelector('.game-title');
    const startUrl = subpageElement.querySelector('.start-url');
    const endUrl = subpageElement.querySelector('.end-url');
    const restartButton = subpageElement.querySelector('.restart-button');
    
    if (roomName) roomName.textContent = state.name || 'Game Results';
    if (startUrl) startUrl.textContent = urlToTitle(state.startUrl);
    if (endUrl) endUrl.textContent = urlToTitle(state.endUrl);
    
    // Show restart button for creator
    if (restartButton) {
        console.log('Current player:', websocketManager.playerName);
        console.log('Creator:', state.creator);
        console.log('Is creator?', websocketManager.playerName === state.creator);
        
        if (websocketManager.playerName === state.creator) {
            console.log('Showing restart button for creator');
            restartButton.style.display = 'inline-block';
            restartButton.addEventListener('click', () => {
                console.log('Restart button clicked');
                websocketManager.sendMessage({
                    type: 'creator.restartGame'
                });
            });
        } else {
            console.log('Hiding restart button for non-creator');
            restartButton.style.display = 'none';
        }
    }
    
    // Get all players including surrendered ones
    const allPlayers = [...state.players];
    if (state.surrenderedPlayers) {
        // Handle surrendered players as a plain object
        const surrenderedPlayers = Object.entries(state.surrenderedPlayers).map(([name, data]) => ({
            name,
            path: data.path || []
        }));
        allPlayers.push(...surrenderedPlayers);
    }
    
    // Sort players into categories
    const winner = allPlayers.find(p => p.name === state.winner);
    const reachedGoal = allPlayers.filter(p => 
        p.name !== state.winner && 
        p.path.length > 0 && 
        p.path[p.path.length - 1].url === state.endUrl
    );
    const otherPlayers = allPlayers.filter(p => 
        p.name !== state.winner && 
        !reachedGoal.includes(p)
    );
    
    // Create sections for each player
    if (winner) {
        const section = document.createElement('div');
        section.className = 'player-section winner-section';
        section.innerHTML = `
            <div class="section-title">Winner</div>
            <div class="player-paths"></div>
        `;
        const isCurrentPlayer = winner.name === websocketManager.playerName;
        console.log('Winner is current player:', isCurrentPlayer, 'winner:', winner.name, 'currentPlayer:', websocketManager.playerName);
        const playerCard = createPlayerPath(winner, isCurrentPlayer);
        section.querySelector('.player-paths').appendChild(playerCard);
        swipeContainer.appendChild(section);
        dotsContainer.appendChild(createDot(true));
    }
    
    if (reachedGoal.length > 0) {
        reachedGoal.forEach((player, index) => {
            const section = document.createElement('div');
            section.className = 'player-section reached-goal-section';
            section.innerHTML = `
                <div class="section-title">Finisher</div>
                <div class="player-paths"></div>
            `;
            const isCurrentPlayer = player.name === websocketManager.playerName;
            console.log('Finisher is current player:', isCurrentPlayer, 'player:', player.name, 'currentPlayer:', websocketManager.playerName);
            const playerCard = createPlayerPath(player, isCurrentPlayer);
            section.querySelector('.player-paths').appendChild(playerCard);
            swipeContainer.appendChild(section);
            dotsContainer.appendChild(createDot(false));
        });
    }
    
    if (otherPlayers.length > 0) {
        otherPlayers.forEach((player, index) => {
            const section = document.createElement('div');
            section.className = 'player-section other-players-section';
            section.innerHTML = `
                <div class="section-title">Remaining Players</div>
                <div class="player-paths"></div>
            `;
            const isCurrentPlayer = player.name === websocketManager.playerName;
            console.log('Other player is current player:', isCurrentPlayer, 'player:', player.name, 'currentPlayer:', websocketManager.playerName);
            const playerCard = createPlayerPath(player, isCurrentPlayer);
            section.querySelector('.player-paths').appendChild(playerCard);
            swipeContainer.appendChild(section);
            dotsContainer.appendChild(createDot(false));
        });
    }
    
    // Setup swipe functionality
    setupSwipeFunctionality(subpageElement);

    // Show dots on desktop only if horizontal scroll is possible
    if (window.innerWidth >= 768) {
        if (swipeContainer && dotsContainer) {
            if (swipeContainer.scrollWidth > swipeContainer.clientWidth) {
                dotsContainer.style.display = 'flex';
            } else {
                dotsContainer.style.display = 'none';
            }
        }
    }
}

// Helper function to create a dot
function createDot(isActive) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    if (isActive) {
        dot.classList.add('active');
    }
    return dot;
}

// Exported function to handle incoming state updates
export async function handleStateUpdate(state, subpageElement, timerContainerElement) {
    if (!state || !subpageElement) {
        console.error("Finished handleStateUpdate: Missing state or subpageElement");
        return;
    }
    
    try {
        // Fetch the finished HTML template
        const response = await fetch('/game/finished.html');
        if (!response.ok) {
            throw new Error(`Failed to fetch finished.html: ${response.statusText}`);
        }
        const html = await response.text();
        
        // Load the HTML into the provided subpage element
        subpageElement.innerHTML = html;

        // Setup the content and initialize the subpage
        setupFinishedPage(state, subpageElement);

    } catch (error) {
        console.error(`Error processing finished state update:`, error);
        // Optionally display error in the subpageElement
        subpageElement.innerHTML = `<p style="color: red;">Error loading finished view: ${error.message}</p>`;
    }
} 