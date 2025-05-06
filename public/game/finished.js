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
function createPathEntry(url, effect, isGhosted = false) {
    const entry = document.createElement('div');
    entry.className = `path-entry ${effect ? `effect-${effect}` : ''} ${isGhosted ? 'ghosted' : ''}`;
    
    const emoji = document.createElement('span');
    emoji.className = 'effect-emoji';
    if (effect === 'end') {
        emoji.textContent = '🏁';
    } else if (effect === 'start') {
        emoji.textContent = '📍';
    } else if (effect === 'bombed') {
        emoji.textContent = '💣';
    } else if (effect === 'swapped') {
        emoji.textContent = '🔄';
    } else if (effect === 'returned') {
        emoji.textContent = '↩️';
    } else if (effect === 'random') {
        emoji.textContent = '🎲';
    } else if (effect === 'user_selected') {
        emoji.textContent = '👥';
    } else if (effect === 'surrender') {
        emoji.textContent = '🏳️';
    } else if (effect === 'cancelled') {
        emoji.textContent = '❌';
    } else if (effect === 'stop') {
        emoji.textContent = '🛑';
    } else {
        emoji.textContent = '➡️';
    }
    
    const urlSpan = document.createElement('span');
    urlSpan.className = 'path-url';
    urlSpan.textContent = urlToTitle(url);
    
    entry.appendChild(emoji);
    entry.appendChild(urlSpan);
    
    return entry;
}

// Function to create a player path element
function createPlayerPath(player, isCurrentPlayer = false, position, state) {
    console.log('Creating path for player:', player);
    
    // Create container for the entire player section
    const container = document.createElement('div');
    container.className = 'player-content';
    
    // Add position first
    const positionDiv = document.createElement('div');
    positionDiv.className = 'player-position';
    // Add position-based color class
    if (position === 1) {
        positionDiv.classList.add('gold');
    } else if (position === 2) {
        positionDiv.classList.add('silver');
    } else if (position === 3) {
        positionDiv.classList.add('bronze');
    }
    const positionText = position === 1 ? '🥇 1st Place' : position === 2 ? '🥈 2nd Place' : position === 3 ? '🥉 3rd Place' : `${position}th Place`;
    positionDiv.textContent = positionText;
    container.appendChild(positionDiv);

    // Add player name
    const nameDiv = document.createElement('div');
    nameDiv.className = 'player-name';
    // Try both name and playerName properties, with fallback to empty string
    const playerName = player.name || player.playerName || 'Unknown Player';
    nameDiv.textContent = isCurrentPlayer ? `${playerName} (you)` : playerName;
    if (player.surrendered) {
        nameDiv.textContent += ' 🏳️';
    }
    // Add position-based color class
    if (position === 1) {
        nameDiv.classList.add('gold');
    } else if (position === 2) {
        nameDiv.classList.add('silver');
    } else if (position === 3) {
        nameDiv.classList.add('bronze');
    }
    container.appendChild(nameDiv);
    
    // Create container for path entries
    const entriesContainer = document.createElement('div');
    entriesContainer.className = 'path-entries';
    
    // Add path entries
    if (player.path && Array.isArray(player.path)) {
        console.log('Adding path entries for player:', playerName, 'path:', player.path);
        player.path.forEach((entry, index) => {
            if (entry && entry.url) {
                // If it's the last entry
                if (index === player.path.length - 1) {
                    if (entry.url === state.endUrl) {
                        entry.effect = 'end';
                    } else if (player.surrendered) {
                        entry.effect = 'surrender';
                    } else {
                        entry.effect = 'stop';
                    }
                }
                entriesContainer.appendChild(createPathEntry(entry.url, entry.effect));
            }
        });
    } else {
        console.log('No path found for player:', playerName, 'path property:', player.path);
    }
    
    container.appendChild(entriesContainer);

    // Add shortest path information if available
    console.log('Checking shortest path for player:', playerName, 'shortestPathToEnd:', player.shortestPathToEnd);
    if (player.shortestPathToEnd) {
        console.log('Shortest path exists, type:', typeof player.shortestPathToEnd, 'value:', player.shortestPathToEnd);
        const shortestPathContainer = document.createElement('div');
        shortestPathContainer.className = 'shortest-path-info';

        if (player.shortestPathToEnd === 'disabled') {
            console.log('Shortest path is disabled');
            // Don't add anything for disabled
            container.appendChild(entriesContainer);
            return container;
        } else if (player.shortestPathToEnd === 'not-found') {
            console.log('Shortest path not found');
            shortestPathContainer.innerHTML = `
                <div class="shortest-path-warning">
                    <span class="warning-emoji">⚠️</span> Path data not found
                </div>
            `;
        } else if (player.shortestPathToEnd.example && Array.isArray(player.shortestPathToEnd.example)) {
            console.log('Shortest path example found, length:', player.shortestPathToEnd.example.length);
            
            // Create ghosted path entries
            const ghostedEntries = document.createElement('div');
            ghostedEntries.className = 'ghosted-entries';
            
            // Skip the first entry as it's the current position
            const remainingPath = player.shortestPathToEnd.example.slice(1);
            console.log('Remaining path entries:', remainingPath);
            remainingPath.forEach((url, index) => {
                // If it's the last entry in the suggested path, use 'end' effect
                const effect = index === remainingPath.length - 1 ? 'end' : null;
                ghostedEntries.appendChild(createPathEntry(url, effect, true));
            });

            // Add divider before ghosted entries
            const divider = document.createElement('div');
            divider.className = 'shortest-path-divider';
            shortestPathContainer.appendChild(divider);
            shortestPathContainer.appendChild(ghostedEntries);
        } else {
            console.log('Shortest path is neither disabled, not-found, nor has example array');
        }

        container.appendChild(entriesContainer);
        container.appendChild(shortestPathContainer);
    } else {
        console.log('No shortest path data available');
        container.appendChild(entriesContainer);
    }
    
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
        let startX, startY, scrollLeft;
        let isSwiping = false;

        // Touch events for swipe
        swipeContainer.addEventListener('touchstart', (e) => {
            startX = e.touches[0].pageX - swipeContainer.offsetLeft;
            startY = e.touches[0].pageY;
            scrollLeft = swipeContainer.scrollLeft;
            isSwiping = false;
        });

        swipeContainer.addEventListener('touchmove', (e) => {
            if (!startX || !startY) return;
            
            const x = e.touches[0].pageX - swipeContainer.offsetLeft;
            const y = e.touches[0].pageY;
            
            const deltaX = Math.abs(x - startX);
            const deltaY = Math.abs(y - startY);
            
            // If we haven't determined if this is a swipe yet
            if (!isSwiping) {
                // If horizontal movement is greater than vertical, it's a swipe
                if (deltaX > deltaY) {
                    isSwiping = true;
                    e.preventDefault();
                }
                return;
            }
            
            // If we've determined this is a swipe, handle it
            if (isSwiping) {
                e.preventDefault();
                const walk = (x - startX) * 1.5;
                swipeContainer.scrollLeft = scrollLeft - walk;
            }
        });

        swipeContainer.addEventListener('touchend', () => {
            if (!startX || !isSwiping) return;
            const sectionWidth = swipeContainer.offsetWidth;
            const scrollPosition = swipeContainer.scrollLeft;
            const targetIndex = Math.round(scrollPosition / sectionWidth);
            
            swipeContainer.scrollTo({
                left: targetIndex * sectionWidth,
                behavior: 'smooth'
            });
            startX = null;
            startY = null;
            isSwiping = false;
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

// Function to create path entries for the overlay
function createOverlayPathEntries(path) {
    const container = document.createElement('div');
    container.className = 'overlay-path-entries';
    
    path.forEach((url, index) => {
        const effect = index === 0 ? 'start' : index === path.length - 1 ? 'end' : null;
        container.appendChild(createPathEntry(url, effect));
    });
    
    return container;
}

// Function to show shortest path overlay
function showShortestPathOverlay(state, isStartUrl) {
    console.log('Showing shortest path overlay, state:', state);
    console.log('Shortest paths data:', state.shortestpaths);
    
    // Check if shortest paths data exists and is valid
    if (!state.shortestpaths || state.shortestpaths === 'disabled' || state.shortestpaths === 'not-found') {
        console.log('No valid shortest paths data available');
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'shortest-path-overlay';
    
    const content = document.createElement('div');
    content.className = 'overlay-content';
    
    const header = document.createElement('div');
    header.className = 'overlay-header';
    header.textContent = 'Shortest Path Example';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'overlay-close';
    closeButton.textContent = '×';
    closeButton.onclick = () => overlay.remove();
    
    const pathContainer = document.createElement('div');
    pathContainer.className = 'overlay-path-container';
    
    if (state.shortestpaths.example && Array.isArray(state.shortestpaths.example)) {
        console.log('Found example path:', state.shortestpaths.example);
        pathContainer.appendChild(createOverlayPathEntries(state.shortestpaths.example));
    } else {
        console.log('No example path found in shortest paths data');
    }
    
    header.appendChild(closeButton);
    content.appendChild(header);
    content.appendChild(pathContainer);
    overlay.appendChild(content);
    
    // Close on click outside
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    };
    
    document.body.appendChild(overlay);
}

// Function to set up the finished page content
function setupFinishedPage(state, subpageElement) {
    console.log('Setting up finished page with state:', state);
    const swipeContainer = subpageElement.querySelector('.swipe-container');
    const dotsContainer = subpageElement.querySelector('.swipe-indicator');
    
    // Store initial total player count if not already stored
    if (!window.initialTotalPlayers) {
        window.initialTotalPlayers = state.players.length + (state.surrenderedPlayers ? Object.keys(state.surrenderedPlayers).length : 0);
        console.log('Stored initial total players:', window.initialTotalPlayers);
    }
    
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
    
    // Check if shortest paths data is available
    const hasShortestPaths = state.shortestpaths && state.shortestpaths !== 'disabled' && state.shortestpaths !== 'not-found';
    
    if (startUrl) {
        startUrl.textContent = urlToTitle(state.startUrl);
    }
    
    if (endUrl) {
        endUrl.textContent = urlToTitle(state.endUrl);
    }

    // Add shortest path button if data is available
    if (hasShortestPaths) {
        const urlsContainer = subpageElement.querySelector('.urls');
        const shortestPathButton = document.createElement('button');
        shortestPathButton.className = 'shortest-path-button';
        shortestPathButton.textContent = '🎯 Show Shortest Path Example';
        shortestPathButton.onclick = () => {
            console.log('Shortest path button clicked');
            showShortestPathOverlay(state, false);
        };
        urlsContainer.appendChild(shortestPathButton);
    }
    
    // Show restart button for creator
    if (restartButton) {
        if (websocketManager.playerName === state.creator) {
            restartButton.style.display = 'inline-block';
            restartButton.addEventListener('click', () => {
                websocketManager.sendMessage({
                    type: 'creator.restartGame'
                });
            });
        } else {
            restartButton.style.display = 'none';
        }
    }

    // Add leave game button for all players
    const leaveButton = document.createElement('button');
    leaveButton.className = 'restart-button';
    leaveButton.textContent = websocketManager.playerName === state.creator ? 'Close Room' : 'Leave Game';
    leaveButton.onclick = () => {
        websocketManager.isIntentionalDisconnect = true;
        if (websocketManager.playerName === state.creator) {
            // Set isCreator flag in session storage
            sessionStorage.setItem('isCreator', 'true');
        }
        websocketManager.sendMessage({
            type: 'leave',
            playerName: websocketManager.playerName,
        });
        window.location.href = '/';
    };
    subpageElement.querySelector('.game-info').appendChild(leaveButton);

    // Check if ranking is ready using the stored initial total
    if (!state.ranking || state.ranking.length !== window.initialTotalPlayers) {
        // Show loading screen
        swipeContainer.innerHTML = `
            <div class="loading-screen">
                <div class="loading-spinner"></div>
                <div class="loading-text">Calculating final rankings...</div>
            </div>
        `;
        return;
    }

    // Create sections for each player in ranking order
    state.ranking.forEach((player, index) => {
        const position = index + 1;
        const section = document.createElement('div');
        section.className = 'player-section';
        
        // Add appropriate class based on position
        if (position === 1) {
            section.classList.add('winner-section');
        } else if (position === 2) {
            section.classList.add('second-place-section');
        } else if (position === 3) {
            section.classList.add('third-place-section');
        } else {
            section.classList.add('other-players-section');
        }

        section.innerHTML = `
            <div class="player-paths"></div>
        `;
        
        const isCurrentPlayer = player.name === websocketManager.playerName;
        const playerCard = createPlayerPath(player, isCurrentPlayer, position, state);
        section.querySelector('.player-paths').appendChild(playerCard);
        swipeContainer.appendChild(section);
        dotsContainer.appendChild(createDot(position === 1));
    });
    
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