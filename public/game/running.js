import websocketManager from "/js/websocket.js";
import { urlToTitle } from "/js/wikiHelper.js";
import popupManager from "/js/popup.js";
import { filterWikiUrls } from "/js/wikiUrlFilter.js";
import { getCurrentPlayerUrl } from '/js/gameStateManager.js';

// Make websocketManager available globally
window.websocketManager = websocketManager;

// --- State Management ---
let currentPopup = null;
let gameTimer = null;
let selectedUrls = new Set(); // Track selected URLs to avoid duplicates
let availableUrls = new Set(); // Track available URLs from current page
let currentState = null; // Track current game state
let pendingSelections = []; // Track pending selections for missing players
let currentSelections = []; // Track current selections being made
let currentPlayerUrl = null; // Track the current player's URL
let isSelectionChooser = false; // Track if this player is the one who should make selections

// --- Timer Management ---
const TIMER_ELEMENT_ID = 'gameTimer';

// Function to format time (MM:SS)
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Function to start/update the game timer based on server state
function updateTimer(duration, startTime) {
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }

    const timerElement = document.getElementById(TIMER_ELEMENT_ID);
    if (!timerElement) {
        console.error(`Timer element with ID '${TIMER_ELEMENT_ID}' not found.`);
        return;
    }

    const endTime = startTime + duration * 1000;
    
    function updateTimerDisplay() {
        const now = Date.now();
        const remaining = Math.max(0, (endTime - now) / 1000);
        timerElement.textContent = formatTime(remaining);

        if (remaining <= 0) {
            clearInterval(gameTimer);
            timerElement.textContent = "00:00";
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
    if (timerElement) {
        timerElement.textContent = "--:--";
    }
}

async function fetchWikiContent(url) {
    try {
        const response = await fetch(`/api/wiki-content?url=${encodeURIComponent(url)}`);
        if (!response.ok) {
            throw new Error('Failed to fetch Wikipedia content');
        }
        const content = await response.text();
        return content;
    } catch (error) {
        console.error('Error fetching wiki content:', error);
        throw error;
    }
}

function processWikiContent(content) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    
    // Get the main content
    const mainContent = doc.querySelector('#mw-content-text') || doc.querySelector('.mw-parser-output');
    if (!mainContent) {
        console.error('processWikiContent: Could not find main content element');
        throw new Error('Could not find main content');
    }

    // Create a container for the content
    const container = document.createElement('div');
    container.className = 'mw-parser-output';
    container.innerHTML = mainContent.innerHTML;

    // Clear available URLs set
    availableUrls.clear();

    // Check if current URL has 'bombed' effect
    const currentPlayer = currentState.players.find(p => p.name === websocketManager.playerName);
    const currentUrl = getCurrentPlayerUrl(currentState);
    const currentPathEntry = currentPlayer?.path?.find(entry => entry.url === currentUrl);
    const isBombed = currentPathEntry?.effect === 'bombed';

    // Process all links
    const links = container.querySelectorAll('a');
    const validLinks = Array.from(links).filter(link => {
        const href = link.getAttribute('href');
        return href && href.startsWith('/wiki/');
    });

    // If bombed, randomly select half of the links to be affected
    let affectedLinks = [];
    if (isBombed && validLinks.length > 0) {
        const numToAffect = Math.ceil(validLinks.length / 2);
        const shuffled = [...validLinks].sort(() => Math.random() - 0.5);
        affectedLinks = shuffled.slice(0, numToAffect);
    }

    links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;

        // Handle Wikipedia links
        if (href.startsWith('/wiki/')) {
            const fullUrl = `https://en.wikipedia.org${href}`;
            
            // Check if this link should be affected by bomb
            const isAffected = affectedLinks.includes(link);
            
            if (isAffected) {
                // Make link bold, red, and non-clickable
                link.style.fontWeight = 'bold';
                link.style.color = 'red';
                link.style.pointerEvents = 'none';
                link.style.cursor = 'not-allowed';
            } else if (!selectedUrls.has(fullUrl)) {
                // Add to available URLs if not already selected and not affected
                availableUrls.add(fullUrl);
                link.setAttribute('onclick', `event.preventDefault(); window.websocketManager.sendSelectLink('${fullUrl}');`);
            } else {
                // If URL has been selected, make it look disabled
                link.style.opacity = '0.5';
                link.style.pointerEvents = 'none';
            }
        } else {
            // Replace external links with just text
            const text = link.textContent;
            link.replaceWith(text);
        }
    });

    return container;
}

// Function to show waiting for other players popup
function showWaitingForPlayersPopup(waitingPlayers) {
    if (currentPopup) {
            popupManager.closePopup(currentPopup);
        currentPopup = null;
    }

    const popupContent = document.createElement('div');
    popupContent.className = 'waiting-players-popup';
                popupContent.style.cssText = `
                    padding: 2rem;
                    border-radius: 8px;
                    max-width: 80%;
                    max-height: 80vh;
                    overflow-y: auto;
                    background-color: white;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    position: relative;
                    z-index: 1002;
                `;
                popupContent.innerHTML = `
                    <h3>Waiting for other players to select a link</h3>
                    <div class="waiting-players-list">
                        ${waitingPlayers.map(player => `
                            <div class="waiting-player">
                                <span class="player-name">${player.name}</span>
                                <span class="waiting-status">Waiting...</span>
                            </div>
                        `).join('')}
                    </div>
                `;

    currentPopup = popupManager.createPopup('info', '', 'info', true);
    
    // Remove close button
                    const closeButton = currentPopup.querySelector('.popup-close');
                    if (closeButton) {
                        closeButton.remove();
                    }

                    const messageContainer = currentPopup.querySelector('.popup-message-container');
                    if (messageContainer) {
                        messageContainer.style.cssText = `
                            padding: 0;
                            margin: 0;
                            background: none;
                            position: relative;
                            z-index: 1002;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                        `;
                        const messageElement = messageContainer.querySelector('.popup-message');
                        if (messageElement) {
                            messageElement.remove();
                        }
                        messageContainer.insertBefore(popupContent, messageContainer.firstChild);
                    }

    // Style the popup
                    currentPopup.style.cssText = `
                        position: relative;
                        z-index: 1001;
                        background-color: transparent;
                        border-radius: 8px;
                        box-shadow: none;
                        max-width: 80%;
                        max-height: 80vh;
                        overflow-y: auto;
                        margin: 0;
                        padding: 0;
                    `;

                // Style the waiting players list
                popupContent.querySelectorAll('.waiting-player').forEach(player => {
                    player.style.cssText = `
                        padding: 0.75rem 1rem;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        background-color: white;
                        margin-bottom: 0.5rem;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    `;
                });
}

// Function to show timer expired popup
function showTimerExpiredPopup(state) {
                if (currentPopup) {
            popupManager.closePopup(currentPopup);
            currentPopup = null;
        }

    const message = state.config?.chooser === "random" 
        ? "Getting a random link..."
        : "Waiting for another player to select a link...";

            const popupContent = document.createElement('div');
            popupContent.className = 'waiting-players-popup';
            popupContent.style.cssText = `
                padding: 2rem;
                border-radius: 8px;
                max-width: 80%;
                max-height: 80vh;
                overflow-y: auto;
                background-color: white;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                position: relative;
                z-index: 1002;
            `;
            popupContent.innerHTML = `
                <h3>${message}</h3>
                <div class="waiting-players-list">
                    <div class="waiting-player">
                    </div>
                </div>
            `;

    currentPopup = popupManager.createPopup('info', '', 'info', true);
                
    // Remove close button
                const closeButton = currentPopup.querySelector('.popup-close');
                if (closeButton) {
                    closeButton.remove();
                }

                const messageContainer = currentPopup.querySelector('.popup-message-container');
                if (messageContainer) {
                    messageContainer.style.cssText = `
                        padding: 0;
                        margin: 0;
                        background: none;
                        position: relative;
                        z-index: 1002;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    `;
                    const messageElement = messageContainer.querySelector('.popup-message');
                    if (messageElement) {
                        messageElement.remove();
                    }
                    messageContainer.insertBefore(popupContent, messageContainer.firstChild);
                }

    // Style the popup
                currentPopup.style.cssText = `
                    position: relative;
                    z-index: 1001;
                    background-color: transparent;
                    border-radius: 8px;
                    box-shadow: none;
                    max-width: 80%;
                    max-height: 80vh;
                    overflow-y: auto;
                    margin: 0;
                    padding: 0;
                `;
}

// Function to close current popup
function closeCurrentPopup() {
    if (currentPopup) {
        // Remove the popup
        if (currentPopup.parentNode) {
            currentPopup.parentNode.removeChild(currentPopup);
        }
        // Remove any overlay
        const overlay = document.querySelector('div[style*="background-color: rgba(0, 0, 0, 0.5)"]');
        if (overlay) {
            overlay.parentNode.removeChild(overlay);
        }
        currentPopup = null;
    }
}

// Function to save pending selections to localStorage
function savePendingSelections() {
    if (pendingSelections.length > 0) {
        console.log('Saving pending selections:', JSON.stringify(pendingSelections, null, 2));
        localStorage.setItem('pendingSelections', JSON.stringify(pendingSelections));
    } else {
        console.log('No pending selections to save, clearing localStorage');
        localStorage.removeItem('pendingSelections');
    }
}

// Function to load pending selections from localStorage
function loadPendingSelections() {
    const saved = localStorage.getItem('pendingSelections');
    console.log('Loading pending selections for player:', websocketManager.playerName);

    if (saved) {
        console.log('Found saved selections, loading them');
        pendingSelections = JSON.parse(saved);
        // If we have pending selections, process them
        if (pendingSelections.length > 0) {
            console.log('Processing loaded selections:', JSON.stringify(pendingSelections, null, 2));
            processNextSelection();
        }
    } else {
        console.log('No saved selections found');
        pendingSelections = [];
    }
}

// Function to process next selection
function processNextSelection() {
    if (pendingSelections.length === 0) {
        // If we've processed all selections, send the response
        if (currentSelections.length > 0) {
            websocketManager.sendSelectForMissingPlayersResponse(currentSelections);
            currentSelections = []; // Clear selections after sending
            localStorage.removeItem('pendingSelections'); // Clear saved selections
        }
        return;
    }

    const selection = pendingSelections[0];
    console.log('Processing selection:', JSON.stringify(selection, null, 2));
    const urls = selection.urls;
    console.log('URLs for selection:', JSON.stringify(urls, null, 2));
    if (urls && urls.length > 0) {
        showSelectionPopup(selection.playerName, urls, (selectedUrl) => {
            // Store the selection
            currentSelections.push({
                playerName: selection.playerName,
                selectedUrl: selectedUrl
            });
            
            // Remove the processed selection
            pendingSelections.shift();
            // Save updated pending selections
            savePendingSelections();
            
            // Process next selection if any
            processNextSelection();
        });
    } else {
        console.error('No URLs found in selection:', selection);
    }
}

// Function to show selection popup for missing player
function showSelectionPopup(playerName, urls, onSelect) {
    console.log('Showing selection popup for', playerName, 'with URLs:', JSON.stringify(urls, null, 2));
    
    // Create URL list HTML
    const urlArray = Array.isArray(urls) ? urls : [urls];
    console.log('Processing URL array:', JSON.stringify(urlArray, null, 2));

    if (urlArray.length === 0) {
        console.error('No URLs to display in popup');
        return;
    }

    // Create popup content
    const popupContent = document.createElement('div');
    popupContent.className = 'selection-popup';
    popupContent.style.cssText = `
        padding: 2rem;
        border-radius: 8px;
        max-width: 80%;
        max-height: 80vh;
        overflow-y: auto;
        background-color: white;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    `;

    // Add title
    const title = document.createElement('h3');
    title.style.cssText = `
        margin: 0;
        margin-bottom: 1rem;
        text-align: left;
    `;
    title.innerHTML = `Select a link for <span style="color: #0066cc; font-weight: bold;">${playerName}</span>`;
    popupContent.appendChild(title);

    // Add URL list
    const urlList = document.createElement('div');
    urlList.className = 'url-list';
    urlList.style.cssText = `
        margin-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    `;

    urlArray.forEach(url => {
        if (!url) {
            console.warn('Skipping null/undefined URL');
            return;
        }
        const urlItem = document.createElement('div');
        urlItem.className = 'url-item';
        urlItem.textContent = urlToTitle(url);
        urlItem.style.cssText = `
            padding: 0.75rem 1rem;
            border: 1px solid #ddd;
            border-radius: 4px;
            background-color: white;
            cursor: pointer;
            transition: background-color 0.2s ease;
            text-align: left;
        `;
        urlItem.addEventListener('mouseover', () => {
            urlItem.style.backgroundColor = '#f5f5f5';
        });
        urlItem.addEventListener('mouseout', () => {
            urlItem.style.backgroundColor = 'white';
        });
        urlItem.addEventListener('click', () => {
            websocketManager.sendSelectionForOthers([url]);
            closeCurrentPopup();
            if (onSelect) onSelect(url);
        });
        urlList.appendChild(urlItem);
    });

    popupContent.appendChild(urlList);

    // Create and show the popup using popupManager
    currentPopup = popupManager.createPopup('info', '', 'info', true);
    
    // Remove close button
    const closeButton = currentPopup.querySelector('.popup-close');
    if (closeButton) {
        closeButton.remove();
    }

    const messageContainer = currentPopup.querySelector('.popup-message-container');
    if (messageContainer) {
        messageContainer.style.cssText = `
            padding: 0;
            margin: 0;
            background: none;
            position: relative;
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        const messageElement = messageContainer.querySelector('.popup-message');
        if (messageElement) {
            messageElement.remove();
        }
        messageContainer.insertBefore(popupContent, messageContainer.firstChild);
    }

    // Style the popup
    currentPopup.style.cssText = `
        position: relative;
        z-index: 9999;
        background-color: transparent;
        border-radius: 8px;
        box-shadow: none;
        max-width: 80%;
        max-height: 80vh;
        overflow-y: auto;
        margin: 0;
        padding: 0;
    `;
}

// Main state update handler
export async function handleStateUpdate(state, subpageElement) {
    if (!state || !subpageElement) {
        console.error('Invalid state or subpage element');
        return;
    }

    try {
        // Store current state
        currentState = state;

        // 1. Handle URL loading
        const currentUrl = getCurrentPlayerUrl(state);
        if (!currentUrl) {
            throw new Error('Could not determine current URL');
        }

        // Update current player URL
        currentPlayerUrl = currentUrl;

        // Fetch and process content
        try {
            const content = await fetchWikiContent(currentUrl);
            const processedContent = processWikiContent(content);
            
            // Update subpage content
            subpageElement.innerHTML = '';
            subpageElement.appendChild(processedContent);
            subpageElement.style.cssText = `
                display: block;
                visibility: visible;
                opacity: 1;
                transform: none;
                position: relative;
                z-index: 1;
            `;
        } catch (error) {
            console.error('Error fetching wiki content:', error);
            // Show error message in subpage
            subpageElement.innerHTML = `
                <div style="padding: 2rem; text-align: center;">
                    <h3>Error loading content</h3>
                    <p>Could not load the Wikipedia page. Please try again.</p>
                </div>
            `;
        }

        // 2. Handle timer
        if (state.timeLimit && state.waitingTimerStartTime) {
            updateTimer(state.timeLimit, state.waitingTimerStartTime);
        } else {
            stopTimer();
        }

        // 3. Handle popups based on state
        const playerName = websocketManager.playerName;
        
        // Only close popup if we're not in the middle of making selections
        if (currentPopup && pendingSelections.length === 0 && (state.state !== 'waiting' || !state.submittedPlayers?.includes(playerName))) {
            closeCurrentPopup();
        }

        // Show appropriate popup based on state, but only if we're not making selections
        if (state.state === 'waiting' && pendingSelections.length === 0) {
            if (state.submittedPlayers?.includes(playerName)) {
                // Show waiting for other players popup
                const waitingPlayers = state.players.filter(p => !state.submittedPlayers.includes(p.name));
                if (waitingPlayers.length > 0) {
                    showWaitingForPlayersPopup(waitingPlayers);
                }
            } else if (state.timerExpired === 0) {
                // Show timer expired popup
                showTimerExpiredPopup(state);
            }
        }

        // Update selected URLs set
        if (state.players) {
            state.players.forEach(player => {
                if (player.path) {
                    player.path.forEach(entry => {
                        selectedUrls.add(entry.url);
                    });
                }
            });
        }

        // Check for pending selections after any other popups, but only if we're the first submitter
        if (state.submittedPlayers?.[0] === playerName) {
            const saved = localStorage.getItem('pendingSelections');
            if (saved) {
                console.log('Found saved selections after state update, loading them');
                pendingSelections = JSON.parse(saved);
                if (pendingSelections.length > 0) {
                    console.log('Processing loaded selections after state update:', JSON.stringify(pendingSelections, null, 2));
                    // Close any existing popup first
                    closeCurrentPopup();
                    // Then show our selection popup
                    processNextSelection();
                }
            }
        }

    } catch (error) {
        console.error('Error in handleStateUpdate:', error);
        // Ensure subpage is visible even if there's an error
        subpageElement.style.cssText = `
            display: block;
            visibility: visible;
            opacity: 1;
            transform: none;
            position: relative;
            z-index: 1;
        `;
        throw error;
    }
}

// Function to shuffle an array (Fisher-Yates algorithm)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Function to get fallback URL from player's path
function getFallbackUrl() {
    if (!currentState) return null;

    const player = currentState.players?.find(p => p.name === websocketManager.playerName);
    if (!player) return currentState.startUrl;

    // If player has more than one link in their path, use the second last one
    if (player.path && player.path.length > 1) {
        return player.path[player.path.length - 2].url;
    }
    // Otherwise use the start URL
    return currentState.startUrl;
}

// Function to get random URLs including fallback
function getRandomUrls(count) {
    const filteredUrls = filterWikiUrls(Array.from(availableUrls));
    let urls = [...filteredUrls];
    
    // If we don't have enough URLs, add the fallback URL
    if (urls.length < count) {
        const fallbackUrl = getFallbackUrl();
        if (fallbackUrl) {
            urls.push(fallbackUrl);
        }
    }
    
    // Shuffle the URLs
    urls = shuffleArray(urls);
    
    // Take the requested number of URLs, or all if we have fewer
    return urls.slice(0, count);
}

// Set up event listeners for random URL selection and selection for missing players
window.addEventListener('request-random-url', (event) => {
    const count = event.detail?.count || 1;
    const selectedUrls = getRandomUrls(count);
    if (selectedUrls.length > 0) {
        websocketManager.sendRandomSelectResponse(selectedUrls[0]);
    }
});

window.addEventListener('request-random-urls', (event) => {
    const count = event.detail?.count || 1;
    const selectedUrls = getRandomUrls(count);
    if (selectedUrls.length > 0) {
        websocketManager.sendRandomUrlsResponse(selectedUrls);
    }
});

// Add event listener for select-for-missing-players
window.addEventListener('select_for_missing_players', (event) => {
    const selections = event.detail.selections;
    console.log('select_for_missing_players event received by player:', websocketManager.playerName);
    
    if (selections && selections.length > 0) {
        // Store selections and start processing
        pendingSelections = [...selections];
        // Save pending selections
        savePendingSelections();
        console.log('Stored pending selections:', JSON.stringify(pendingSelections, null, 2));
        // Process the first selection immediately
        processNextSelection();
    }
});


// Export the ready promise
export const ready = Promise.resolve();