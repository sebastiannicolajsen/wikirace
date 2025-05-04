import { urlToTitle } from "/js/wikiHelper.js";
import websocketManager from "/js/websocket.js";
import popupManager from "/js/popup.js";
import { loadGameState, getCurrentPlayerUrl } from '/js/gameStateManager.js';

// Add at the top after imports
let previousAdditions = null;
let effectNotificationQueue = [];

// Function to create a styled link element
function createStyledLink(emoji, text) {
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '0.75rem';
  container.style.height = '100%';
  container.style.verticalAlign = 'middle';
  container.style.margin = '0';
  container.style.padding = '0';
  container.style.lineHeight = '1';
  container.style.width = '100%';
  
  const emojiElement = document.createElement('span');
  emojiElement.textContent = emoji;
  emojiElement.style.display = 'flex';
  emojiElement.style.alignItems = 'center';
  emojiElement.style.margin = '0';
  emojiElement.style.padding = '0';
  emojiElement.style.lineHeight = '1';
  emojiElement.style.flexShrink = '0';
  
  const textElement = document.createElement('span');
  textElement.style.fontFamily = 'Courier New, monospace';
  textElement.style.color = 'black';
  textElement.style.fontWeight = 'bold';
  textElement.style.fontSize = '0.9rem';
  textElement.style.whiteSpace = 'nowrap';
  textElement.style.overflow = 'hidden';
  textElement.style.textOverflow = 'ellipsis';
  textElement.style.width = '100%';
  textElement.style.display = 'block';
  textElement.style.margin = '0';
  textElement.style.padding = '0';
  textElement.style.lineHeight = '1';
  textElement.textContent = text;
  
  container.appendChild(emojiElement);
  container.appendChild(textElement);
  
  return container;
}

// Function to update header content
export function updateHeader(state) {
  // Find the current player
  const currentPlayer = state.players.find(p => p.name === websocketManager.playerName);
  
  // Update player name
  const playerNameElement = document.getElementById("playerName");
  if (playerNameElement) {
    playerNameElement.textContent = currentPlayer?.name || '';
  }
  
  // Update current URL with latest path URL
  const startUrlElement = document.getElementById("startUrl");
  if (startUrlElement) {
    const currentPlayer = state.players.find(p => p.name === websocketManager.playerName);
    if (currentPlayer?.path?.length > 0) {
      // Always use the latest URL from the path
      const latestUrl = currentPlayer.path[currentPlayer.path.length - 1].url;
      // Compare with getCurrentPlayerUrl only for the emoji
      const currentUrl = getCurrentPlayerUrl(state);
      const latestTitle = urlToTitle(latestUrl);
      const linkElement = createStyledLink(latestUrl !== currentUrl ? '⏭️' : '📍', latestTitle);
      startUrlElement.innerHTML = '';
      startUrlElement.appendChild(linkElement);
    } else if (state.startUrl) {
      const startTitle = urlToTitle(state.startUrl);
      const linkElement = createStyledLink('📍', startTitle);
      startUrlElement.innerHTML = '';
      startUrlElement.appendChild(linkElement);
    }
  }

  // Update end URL
  const endUrlElement = document.getElementById("endUrl");
  if (endUrlElement && state.endUrl) {
    const endTitle = urlToTitle(state.endUrl);
    const linkElement = createStyledLink('🏁', endTitle);
    endUrlElement.innerHTML = '';
    endUrlElement.appendChild(linkElement);
  }

  // Update surrender button visibility
  const surrenderButton = document.getElementById("surrenderButton");
  if (surrenderButton) {
    surrenderButton.style.display = (state.state === 'running' && currentPlayer?.name !== state.creator) ? 'flex' : 'none';
    surrenderButton.onclick = () => showSurrenderPopup();
  }

  // Add creator leave button
  const creatorLeaveButton = document.getElementById("creatorLeaveButton");
  if (creatorLeaveButton) {
    creatorLeaveButton.style.display = currentPlayer?.name === state.creator ? 'flex' : 'none';
    creatorLeaveButton.onclick = () => showCreatorLeavePopup();
  }

  // Update additions info
  const additionsInfo = document.getElementById("additionsInfo");
  if (additionsInfo) {
    additionsInfo.innerHTML = "";

    // Create container for URLs
    const headerLeft = document.createElement('div');
    headerLeft.style.display = 'flex';
    headerLeft.style.flexDirection = 'column';
    headerLeft.style.gap = '0.5rem';
    headerLeft.style.justifyContent = 'center';
    headerLeft.style.alignItems = 'center';
    headerLeft.style.width = '60%';
    headerLeft.style.overflow = 'hidden';
    headerLeft.style.maxWidth = '60%';

    // Get the parent container and replace the old URL container with our new one
    const urlInfo = document.querySelector('.url-info');
    if (urlInfo) {
      // Move the URLs to the new container
      const urlHeader = urlInfo.querySelector('.url-header');
      if (urlHeader) {
        urlHeader.style.width = '100%';
        urlHeader.style.overflow = 'hidden';
        urlHeader.style.textOverflow = 'ellipsis';
        urlHeader.style.paddingLeft = '1rem';
        headerLeft.appendChild(urlHeader);
      }
      urlInfo.parentNode.replaceChild(headerLeft, urlInfo);
    }

    // Check which additions are enabled in the game config
    if (state.config && state.config.additions) {
      const additions = state.config.additions;
      
      // Create container for additions
      const additionsContainer = document.createElement("div");
      additionsContainer.style.display = "flex";
      additionsContainer.style.gap = "0.5rem";
      additionsInfo.appendChild(additionsContainer);
      
      // Show bomb if enabled
      if (additions.bomb !== undefined) {
        const bombContainer = document.createElement("div");
        bombContainer.style.display = "flex";
        bombContainer.style.flexDirection = "column";
        bombContainer.style.alignItems = "center";
        
        const bombEmoji = document.createElement("span");
        bombEmoji.style.opacity = "0.7";
        bombEmoji.textContent = "💣";
        bombContainer.appendChild(bombEmoji);
        
        const bombNumber = document.createElement("span");
        bombNumber.style.opacity = "0.7";
        bombNumber.style.fontWeight = "bold";
        bombNumber.textContent = currentPlayer?.additions?.bomb || 0;
        bombContainer.appendChild(bombNumber);
        
        additionsContainer.appendChild(bombContainer);
      }
      
      // Show swap if enabled
      if (additions.swap !== undefined) {
        const swapContainer = document.createElement("div");
        swapContainer.style.display = "flex";
        swapContainer.style.flexDirection = "column";
        swapContainer.style.alignItems = "center";
        
        const swapEmoji = document.createElement("span");
        swapEmoji.style.opacity = "0.7";
        swapEmoji.textContent = "🔄";
        swapContainer.appendChild(swapEmoji);
        
        const swapNumber = document.createElement("span");
        swapNumber.style.opacity = "0.7";
        swapNumber.style.fontWeight = "bold";
        swapNumber.textContent = currentPlayer?.additions?.swap || 0;
        swapContainer.appendChild(swapNumber);
        
        additionsContainer.appendChild(swapContainer);
      }
      
      // Show return if enabled
      if (additions.return !== undefined) {
        const returnContainer = document.createElement("div");
        returnContainer.style.display = "flex";
        returnContainer.style.flexDirection = "column";
        returnContainer.style.alignItems = "center";
        
        const returnEmoji = document.createElement("span");
        returnEmoji.style.opacity = "0.7";
        returnEmoji.textContent = "↩️";
        returnContainer.appendChild(returnEmoji);
        
        const returnNumber = document.createElement("span");
        returnNumber.style.opacity = "0.7";
        returnNumber.style.fontWeight = "bold";
        returnNumber.textContent = currentPlayer?.additions?.return || 0;
        returnContainer.appendChild(returnNumber);
        
        additionsContainer.appendChild(returnContainer);
      }
    }
  }

  // Add click handler for chart button
  const chartButton = document.getElementById("chartButton");
  if (chartButton) {
    chartButton.onclick = () => showPlayerInfoPopup(state);
  }
}

// Helper function to adjust font size to fit container
function adjustFontSize(element, container) {
  const maxFontSize = 1.0; // Maximum font size in rem (slightly smaller than player name's 1.1rem)
  const minFontSize = 0.8; // Minimum font size in rem
  const step = 0.1; // Step size for font size reduction
  
  // Get the header right section width (additions + chart button)
  const headerRight = container.querySelector('.header-right');
  const headerRightWidth = headerRight ? headerRight.offsetWidth : 0;
  
  // Calculate available width for URLs (70% of remaining space)
  const availableWidth = (container.offsetWidth - headerRightWidth - 20) * 0.7; // 20px buffer
  
  // Start with current font size
  let currentSize = parseFloat(element.style.fontSize);
  
  // If text fits, try increasing size up to max
  while (element.scrollWidth <= availableWidth && currentSize < maxFontSize) {
    currentSize += step;
    element.style.fontSize = `${currentSize}rem`;
  }
  
  // If text overflows, reduce size
  while (element.scrollWidth > availableWidth && currentSize > minFontSize) {
    currentSize -= step;
    element.style.fontSize = `${currentSize}rem`;
  }
  
  // Ensure the element doesn't overflow its container
  if (element.scrollWidth > availableWidth) {
    element.style.fontSize = `${minFontSize}rem`;
  }
}

// Keep track of the current popup
let currentPopup = null;

function showPlayerInfoPopup(state) {
  // Close existing popup if any
  if (currentPopup) {
    popupManager.closePopup(currentPopup);
  }

  const popup = popupManager.createPopup('info', '', 'info');
  currentPopup = popup;
  
  const content = document.createElement('div');
  content.style.padding = '0';
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.gap = '0';
  content.style.width = '100%';
  content.style.margin = '0';

  // Sort players so current player is first
  const sortedPlayers = [...state.players].sort((a, b) => {
    if (a.name === websocketManager.playerName) return -1;
    if (b.name === websocketManager.playerName) return 1;
    return 0;
  });

  sortedPlayers.forEach((player, index) => {
    const playerCard = document.createElement('div');
    playerCard.style.padding = '1.25rem';
    playerCard.style.backgroundColor = 'white';
    playerCard.style.width = '100%';
    playerCard.style.boxSizing = 'border-box';
    playerCard.style.margin = '0';
    playerCard.style.borderRadius = '0';

    const playerName = document.createElement('div');
    playerName.style.fontSize = '1.1rem';
    playerName.style.fontWeight = 'bold';
    playerName.style.marginBottom = '0.75rem';
    playerName.textContent = player.name + (player.name === websocketManager.playerName ? ' (you)' : '');
    if (player.name === websocketManager.playerName) {
      playerName.style.color = 'var(--primary-color)';
    }
    playerCard.appendChild(playerName);

    const currentUrl = document.createElement('div');
    currentUrl.style.display = 'flex';
    currentUrl.style.alignItems = 'center';
    currentUrl.style.gap = '0.5rem';
    currentUrl.style.marginBottom = '0.75rem';
    
    const pinEmoji = document.createElement('span');
    pinEmoji.textContent = '📍';
    pinEmoji.style.opacity = '0.7';
    
    const urlText = document.createElement('span');
    urlText.style.fontWeight = 'bold';
    urlText.textContent = player.path && player.path.length > 0 
      ? urlToTitle(player.path[player.path.length - 1].url)
      : urlToTitle(state.startUrl);
    
    currentUrl.appendChild(pinEmoji);
    currentUrl.appendChild(urlText);
    playerCard.appendChild(currentUrl);

    // Show additions if enabled
    if (state.config?.additions) {
      const additionsContainer = document.createElement('div');
      additionsContainer.style.display = 'flex';
      additionsContainer.style.gap = '1rem';
      additionsContainer.style.marginTop = '0.75rem';

      if (state.config.additions.bomb !== undefined) {
        const bombContainer = document.createElement('div');
        bombContainer.style.display = 'flex';
        bombContainer.style.alignItems = 'center';
        bombContainer.style.gap = '0.25rem';
        
        const bombEmoji = document.createElement('span');
        bombEmoji.textContent = '💣';
        bombEmoji.style.opacity = '0.7';
        
        const bombNumber = document.createElement('span');
        bombNumber.textContent = player.additions?.bomb || 0;
        bombNumber.style.fontWeight = 'bold';
        
        bombContainer.appendChild(bombEmoji);
        bombContainer.appendChild(bombNumber);

        // Add give button for creator if enabled
        if (state.config.additions_creatorGive && websocketManager.playerName === state.creator) {
          const giveButton = document.createElement('button');
          giveButton.textContent = '+';
          giveButton.style.padding = '0.1rem 0.3rem';
          giveButton.style.marginLeft = '0.25rem';
          giveButton.style.fontSize = '0.8rem';
          giveButton.style.border = '1px solid var(--border-color)';
          giveButton.style.borderRadius = '3px';
          giveButton.style.cursor = 'pointer';
          giveButton.style.backgroundColor = 'white';
          giveButton.onclick = () => websocketManager.sendGiveAddition(player.name, 'bomb');
          bombContainer.appendChild(giveButton);
        }
        
        additionsContainer.appendChild(bombContainer);
      }

      if (state.config.additions.swap !== undefined) {
        const swapContainer = document.createElement('div');
        swapContainer.style.display = 'flex';
        swapContainer.style.alignItems = 'center';
        swapContainer.style.gap = '0.25rem';
        
        const swapEmoji = document.createElement('span');
        swapEmoji.textContent = '🔄';
        swapEmoji.style.opacity = '0.7';
        
        const swapNumber = document.createElement('span');
        swapNumber.textContent = player.additions?.swap || 0;
        swapNumber.style.fontWeight = 'bold';
        
        swapContainer.appendChild(swapEmoji);
        swapContainer.appendChild(swapNumber);

        // Add give button for creator if enabled
        if (state.config.additions_creatorGive && websocketManager.playerName === state.creator) {
          const giveButton = document.createElement('button');
          giveButton.textContent = '+';
          giveButton.style.padding = '0.1rem 0.3rem';
          giveButton.style.marginLeft = '0.25rem';
          giveButton.style.fontSize = '0.8rem';
          giveButton.style.border = '1px solid var(--border-color)';
          giveButton.style.borderRadius = '3px';
          giveButton.style.cursor = 'pointer';
          giveButton.style.backgroundColor = 'white';
          giveButton.onclick = () => websocketManager.sendGiveAddition(player.name, 'swap');
          swapContainer.appendChild(giveButton);
        }
        
        additionsContainer.appendChild(swapContainer);
      }

      if (state.config.additions.return !== undefined) {
        const returnContainer = document.createElement('div');
        returnContainer.style.display = 'flex';
        returnContainer.style.alignItems = 'center';
        returnContainer.style.gap = '0.25rem';
        
        const returnEmoji = document.createElement('span');
        returnEmoji.textContent = '↩️';
        returnEmoji.style.opacity = '0.7';
        
        const returnNumber = document.createElement('span');
        returnNumber.textContent = player.additions?.return || 0;
        returnNumber.style.fontWeight = 'bold';
        
        returnContainer.appendChild(returnEmoji);
        returnContainer.appendChild(returnNumber);

        // Add give button for creator if enabled
        if (state.config.additions_creatorGive && websocketManager.playerName === state.creator) {
          const giveButton = document.createElement('button');
          giveButton.textContent = '+';
          giveButton.style.padding = '0.1rem 0.3rem';
          giveButton.style.marginLeft = '0.25rem';
          giveButton.style.fontSize = '0.8rem';
          giveButton.style.border = '1px solid var(--border-color)';
          giveButton.style.borderRadius = '3px';
          giveButton.style.cursor = 'pointer';
          giveButton.style.backgroundColor = 'white';
          giveButton.onclick = () => websocketManager.sendGiveAddition(player.name, 'return');
          returnContainer.appendChild(giveButton);
        }
        
        additionsContainer.appendChild(returnContainer);
      }

      playerCard.appendChild(additionsContainer);
    }

    content.appendChild(playerCard);

    // Add separator line between players (except after the last one)
    if (index < sortedPlayers.length - 1) {
      const separator = document.createElement('div');
      separator.style.height = '1px';
      separator.style.backgroundColor = 'var(--border-color)';
      separator.style.margin = '0';
      content.appendChild(separator);
    }
  });

  // Replace the default message with our styled content
  const messageContainer = popup.querySelector('.popup-message-container');
  if (messageContainer) {
    messageContainer.style.padding = '0';
    messageContainer.style.margin = '0';
    const messageElement = messageContainer.querySelector('.popup-message');
    if (messageElement) {
      messageElement.remove();
    }
    messageContainer.insertBefore(content, messageContainer.firstChild);
  }
}

function showSurrenderPopup() {
  // Close existing popup if any
  if (currentPopup) {
    popupManager.closePopup(currentPopup);
  }

  const popup = popupManager.createPopup('info', '', 'info', false);  // Set preventOutsideClick to false
  currentPopup = popup;
  
  const content = document.createElement('div');
  content.style.padding = '1.5rem';
  content.style.textAlign = 'center';
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.alignItems = 'center';
  content.style.gap = '1.5rem';
  content.style.width = '100%';
  content.style.maxWidth = '400px';
  content.style.margin = '0 auto';
  
  const message = document.createElement('div');
  message.style.fontSize = '1.2rem';
  message.style.fontWeight = 'bold';
  message.textContent = 'Are you sure you want to surrender?';
  content.appendChild(message);
  
  const buttons = document.createElement('div');
  buttons.style.display = 'flex';
  buttons.style.justifyContent = 'center';
  buttons.style.width = '100%';
  
  const confirmButton = document.createElement('button');
  confirmButton.textContent = 'Confirm Surrender';
  confirmButton.className = 'button button-primary';
  confirmButton.style.fontSize = '1rem';
  confirmButton.style.padding = '0.75rem 1.5rem';
  confirmButton.onclick = () => {
    websocketManager.sendPlayerSurrender();
    popupManager.closePopup(popup);
  };
  
  buttons.appendChild(confirmButton);
  content.appendChild(buttons);
  
  // Replace the default message with our content
  const messageContainer = popup.querySelector('.popup-message-container');
  if (messageContainer) {
    messageContainer.style.padding = '0';
    messageContainer.style.margin = '0';
    messageContainer.style.display = 'flex';
    messageContainer.style.alignItems = 'center';
    messageContainer.style.justifyContent = 'center';
    const messageElement = messageContainer.querySelector('.popup-message');
    if (messageElement) {
      messageElement.remove();
    }
    messageContainer.insertBefore(content, messageContainer.firstChild);
  }

  // Ensure close button is visible and properly positioned
  const closeButton = popup.querySelector('.popup-close');
  if (closeButton) {
    closeButton.style.position = 'absolute';
    closeButton.style.top = '0.5rem';
    closeButton.style.right = '0.5rem';
    closeButton.style.zIndex = '1';
  }
}

function showCreatorLeavePopup() {
  // Close existing popup if any
  if (currentPopup) {
    popupManager.closePopup(currentPopup);
  }

  const popup = popupManager.createPopup('info', '', 'info', false);  // Set preventOutsideClick to false
  currentPopup = popup;
  
  const content = document.createElement('div');
  content.style.padding = '1.5rem';
  content.style.textAlign = 'center';
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.alignItems = 'center';
  content.style.gap = '1.5rem';
  content.style.width = '100%';
  content.style.maxWidth = '400px';
  content.style.margin = '0 auto';
  
  const message = document.createElement('div');
  message.style.fontSize = '1.2rem';
  message.style.fontWeight = 'bold';
  message.textContent = 'Are you sure you want to close the room?';
  content.appendChild(message);
  
  const buttons = document.createElement('div');
  buttons.style.display = 'flex';
  buttons.style.justifyContent = 'center';
  buttons.style.width = '100%';
  
  const confirmButton = document.createElement('button');
  confirmButton.textContent = 'Close Room';
  confirmButton.className = 'button button-primary';
  confirmButton.style.fontSize = '1rem';
  confirmButton.style.padding = '0.75rem 1.5rem';
  confirmButton.onclick = () => {
    websocketManager.isIntentionalDisconnect = true;
    websocketManager.sendMessage({
      type: "leave",
      playerName: websocketManager.playerName,
    });
    window.location.href = "/";
    popupManager.closePopup(popup);
  };
  
  buttons.appendChild(confirmButton);
  content.appendChild(buttons);
  
  // Replace the default message with our content
  const messageContainer = popup.querySelector('.popup-message-container');
  if (messageContainer) {
    messageContainer.style.padding = '0';
    messageContainer.style.margin = '0';
    messageContainer.style.display = 'flex';
    messageContainer.style.alignItems = 'center';
    messageContainer.style.justifyContent = 'center';
    const messageElement = messageContainer.querySelector('.popup-message');
    if (messageElement) {
      messageElement.remove();
    }
    messageContainer.insertBefore(content, messageContainer.firstChild);
  }

  // Ensure close button is visible and properly positioned
  const closeButton = popup.querySelector('.popup-close');
  if (closeButton) {
    closeButton.style.position = 'absolute';
    closeButton.style.top = '0.5rem';
    closeButton.style.right = '0.5rem';
    closeButton.style.zIndex = '1';
  }
}

// Function to process the notification queue
function processNotificationQueue() {
    while (effectNotificationQueue.length > 0) {
        const notification = effectNotificationQueue.shift();
        showEffectReceivedNotification(notification.type);
    }
}

// Function to show effect received notification
function showEffectReceivedNotification(type) {
    const emoji = type === 'bomb' ? '💣' : type === 'swap' ? '🔄' : '↩️';
    
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
            Added effect <b>${type}</b> ${emoji}
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

// Function to check for new additions
function checkForNewAdditions(state) {
    const currentPlayer = state.players.find(p => p.name === websocketManager.playerName);
    if (!currentPlayer || !currentPlayer.additions) return;

    // Initialize previous additions if not set
    if (!previousAdditions) {
        previousAdditions = { ...currentPlayer.additions };
        return;
    }

    // Check each addition type
    if (state.config?.additions) {
        if (state.config.additions.bomb !== undefined && 
            (currentPlayer.additions.bomb || 0) > (previousAdditions.bomb || 0)) {
            effectNotificationQueue.push({ type: 'bomb' });
        }
        if (state.config.additions.swap !== undefined && 
            (currentPlayer.additions.swap || 0) > (previousAdditions.swap || 0)) {
            effectNotificationQueue.push({ type: 'swap' });
        }
        if (state.config.additions.return !== undefined && 
            (currentPlayer.additions.return || 0) > (previousAdditions.return || 0)) {
            effectNotificationQueue.push({ type: 'return' });
        }
    }

    // Update previous additions
    previousAdditions = { ...currentPlayer.additions };
}

// Listen for game state updates
websocketManager.onStateUpdate((state) => {
    // Check if current player is no longer in the players list
    const currentPlayer = state.players.find(p => p.name === websocketManager.playerName);
    if (!currentPlayer && state.observers.find(o => o.name === websocketManager.playerName)) {
        // Player is now an observer, redirect to observer page
        window.location.href = `/observer/${websocketManager.roomId}`;
        return;
    }

    // Check for new additions before updating the header
    checkForNewAdditions(state);

    updateHeader(state);
    loadGameState(state);
    
    // If there's an open popup, update it with the new state
    if (currentPopup && document.body.contains(currentPopup)) {
        // Ensure we only update the player info popup if it's the one open
        if (currentPopup.classList.contains('popup-info')) { 
            showPlayerInfoPopup(state);
        }
    }

    // Process any queued notifications after state update
    setTimeout(processNotificationQueue, 100);
});

// Add event listener for popup close
document.addEventListener('popup-closed', () => {
  currentPopup = null;
}); 