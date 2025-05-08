export default class ObserverPopup {
  constructor() {
    this.popupElement = null;
    this.currentPopup = null;
    this.hideTimeout = null;
    this.hideAnimationTimeout = null;
    this.createPopupElement();
  }

  createPopupElement() {
    this.popupElement = document.createElement("div");
    this.popupElement.className = "observer-popup";

    // Add keyframes for animations
    const style = document.createElement("style");
    style.textContent = `
      @keyframes windRush {
        0% {
          background-position: 0% 50%;
        }
        100% {
          background-position: 100% 50%;
        }
      }

      @keyframes bounceIn {
        0% {
          transform: translate(-50%, -50%) scale(0.3) rotate(-5deg);
          opacity: 0;
        }
        50% {
          transform: translate(-50%, -50%) scale(1.2) rotate(5deg);
          opacity: 1;
        }
        70% {
          transform: translate(-50%, -50%) scale(0.9) rotate(-2deg);
        }
        100% {
          transform: translate(-50%, -50%) scale(1) rotate(0deg);
        }
      }

      @keyframes bounceOut {
        0% {
          transform: translate(-50%, -50%) scale(1) rotate(0deg);
          opacity: 1;
        }
        20% {
          transform: translate(-50%, -50%) scale(1.1) rotate(5deg);
        }
        100% {
          transform: translate(-50%, -50%) scale(0.3) rotate(-5deg);
          opacity: 0;
        }
      }

      @keyframes textPop {
        0% {
          transform: scale(0.8) rotate(-2deg);
          opacity: 0;
        }
        50% {
          transform: scale(1.2) rotate(2deg);
        }
        100% {
          transform: scale(1) rotate(0deg);
          opacity: 1;
        }
      }

      @keyframes woodGrain {
        0% {
          background-position: 0% 0%;
        }
        100% {
          background-position: 100% 100%;
        }
      }

      @keyframes borderPattern {
        0% {
          background-position: 0% 0%;
        }
        100% {
          background-position: 100% 100%;
        }
      }

      @keyframes diagonalLines {
        0% {
          background-position: 0 0;
        }
        100% {
          background-position: 50px 50px;
        }
      }

      .observer-popup {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #8B4513;
        background-image: repeating-linear-gradient(
          45deg,
          rgba(0, 0, 0, 0.1),
          rgba(0, 0, 0, 0.1) 10px,
          rgba(0, 0, 0, 0.2) 10px,
          rgba(0, 0, 0, 0.2) 20px
        );
        background-size: 50px 50px;
        animation: diagonalLines 2s linear infinite;
        padding: 1.5rem 2rem;
        border-radius: 8px;
        box-shadow: 
          0 0 0 4px #5D4037,
          0 0 0 6px #8D6E63,
          0 0 20px rgba(0,0,0,0.5);
        z-index: 1000;
        display: none;
        perspective: 1000px;
        transform-style: preserve-3d;
        border: 2px solid #3E2723;
        overflow: visible;
      }

      .observer-popup::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: inherit;
        filter: blur(5px);
        z-index: -1;
        opacity: 0.7;
        border-radius: 12px;
      }

      .observer-popup::after {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        background: linear-gradient(45deg, #5D4037 25%, #8D6E63 25%, #8D6E63 50%, #5D4037 50%, #5D4037 75%, #8D6E63 75%, #8D6E63);
        background-size: 20px 20px;
        border-radius: 14px;
        z-index: -2;
        opacity: 0.5;
        animation: borderPattern 10s linear infinite;
      }

      .popup-content {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-areas:
          "action action emoji"
          "description description emoji"
          "player player emoji";
        grid-template-columns: 1fr 1fr auto;
        gap: 0.5rem;
        height: 100%;
        padding: 0.75rem;
        overflow: visible;
      }

      .popup-action {
        grid-area: action;
        font-weight: bold;
        color: #FFD700;
        text-shadow: 
          2px 2px 0 #000,
          -2px -2px 0 #000,
          2px -2px 0 #000,
          -2px 2px 0 #000;
        animation: textPop 0.5s ease-out forwards;
        transform-origin: left center;
        font-family: system-ui, -apple-system, sans-serif;
        position: relative;
        left: unset;
        top: unset;
        transform: none;
        z-index: 3;
        width: max-content;
        max-width: none;
        margin-left: 0;
        margin-right: 0;
        text-align: center;
        white-space: nowrap;
      }

      .popup-description {
        grid-area: description;
        font-weight: bold;
        color: #FFF;
        text-shadow: 
          2px 2px 0 #000,
          -2px -2px 0 #000,
          2px -2px 0 #000,
          -2px 2px 0 #000;
        animation: textPop 0.5s ease-out 0.2s forwards;
        opacity: 0;
        transform-origin: left center;
        font-family: system-ui, -apple-system, sans-serif;
        position: relative;
        left: unset;
        top: unset;
        transform: none;
        z-index: 3;
        width: max-content;
        max-width: none;
        margin-left: 0;
        margin-right: 0;
        text-align: center;
        white-space: nowrap;
      }

      .popup-player {
        grid-area: player;
        color: #FFD700;
        text-shadow: 
          1px 1px 0 #000,
          -1px -1px 0 #000,
          1px -1px 0 #000,
          -1px 1px 0 #000;
        animation: textPop 0.5s ease-out 0.4s forwards;
        opacity: 0;
        transform-origin: left center;
        font-family: system-ui, -apple-system, sans-serif;
        position: absolute;
        left: 50%;
        top: 80%;
        transform: translateX(-50%);
        z-index: 3;
        width: max-content;
        max-width: none;
        margin-left: 0;
        margin-right: 0;
        text-align: center;
        white-space: nowrap;
      }

      .popup-emoji {
        grid-area: emoji;
        animation: textPop 0.5s ease-out 0.3s forwards;
        opacity: 0;
        transform-origin: center;
        display: flex;
        align-items: center;
        justify-content: center;
        filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.5));
        position: absolute;
        z-index: 1;
        right: -40px;
        top: -40px;
        transform: scale(1.5);
      }

      .observer-popup.size-small {
        min-width: 140px;
        min-height: 60px;
        padding: 0.7rem 1rem;
      }

      .observer-popup.size-medium {
        min-width: 180px;
        min-height: 80px;
        padding: 0.9rem 1.2rem;
      }

      .observer-popup.size-large {
        min-width: 270px;
        min-height: 120px;
        padding: 1.35rem 1.8rem;
      }

      .size-small .popup-action {
        font-size: 2.4rem;
      }

      .size-medium .popup-action {
        font-size: 3rem;
      }

      .size-large .popup-action {
        font-size: 4.5rem;
      }

      .size-small .popup-description {
        font-size: 2rem;
      }

      .size-medium .popup-description {
        font-size: 2.6rem;
      }

      .size-large .popup-description {
        font-size: 3.9rem;
      }

      .size-small .popup-player {
        font-size: 1.8rem;
      }

      .size-medium .popup-player {
        font-size: 2.4rem;
      }

      .size-large .popup-player {
        font-size: 3.6rem;
      }

      .size-small .popup-emoji {
        font-size: 5rem;
        transform: scale(1.2);
      }

      .size-medium .popup-emoji {
        font-size: 6rem;
        transform: scale(1.3);
      }

      .size-large .popup-emoji {
        font-size: 9rem;
        transform: scale(1.5);
      }

      .observer-popup.showing {
        animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards,
                   windRush 0.5s linear infinite;
      }

      .observer-popup.hiding {
        animation: bounceOut 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.popupElement);
  }

  show(action, description, emoji, player = null, playerColor = null, size = 'medium', duration = 2000) {
    // Create popup content object
    const popupContent = {
      action,
      description,
      emoji,
      player,
      playerColor,
      size,
      duration
    };

    // Check if this is the same popup
    if (this.currentPopup && 
        this.currentPopup.action === action && 
        this.currentPopup.description === description && 
        this.currentPopup.player === player) {
      return;
    }

    // Clear any existing timeouts
    this.clearTimeouts();

    // If we're in the middle of hiding, reset the element
    if (this.popupElement.classList.contains('hiding')) {
      this.popupElement.classList.remove('hiding');
      this.popupElement.style.display = 'none';
    }

    // Store current popup
    this.currentPopup = popupContent;

    // Remove any existing size classes
    this.popupElement.classList.remove('size-small', 'size-medium', 'size-large');
    // Add the new size class
    this.popupElement.classList.add(`size-${size}`);

    // Set the background color based on player color or default to gray
    const bgColor = playerColor || '#666666';
    const darkerBgColor = this.adjustColor(bgColor, -20); // Make a darker version of the color
    this.popupElement.style.background = `linear-gradient(45deg, ${bgColor} 25%, ${darkerBgColor} 25%, ${darkerBgColor} 50%, ${bgColor} 50%, ${bgColor} 75%, ${darkerBgColor} 75%, ${darkerBgColor})`;

    // Create the content structure
    let descriptionText = description;
    let descriptionColor = null;
    if (typeof description === 'object' && description !== null) {
      descriptionText = description.text;
      descriptionColor = description.color;
    }
    this.popupElement.innerHTML = `
      <div class="popup-content">
        <div class="popup-action">${action}</div>
        <div class="popup-description"${descriptionColor ? ` style=\"color: ${descriptionColor};\"` : ''}>${descriptionText}</div>
        ${player ? `<div class="popup-player">${player}</div>` : ''}
        <div class="popup-emoji">${emoji}</div>
      </div>
    `;

    // Show the popup with animation
    this.popupElement.style.display = 'block';
    this.popupElement.classList.add('showing');

    // Set hide timeout
    this.hideTimeout = setTimeout(() => {
      this.hide();
    }, duration);
  }

  hide() {
    // Clear any existing timeouts
    this.clearTimeouts();

    this.popupElement.classList.remove('showing');
    this.popupElement.classList.add('hiding');
    
    // Remove the element after animation completes
    this.hideAnimationTimeout = setTimeout(() => {
      this.popupElement.style.display = 'none';
      this.currentPopup = null;
    }, 600);
  }

  clearTimeouts() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    if (this.hideAnimationTimeout) {
      clearTimeout(this.hideAnimationTimeout);
      this.hideAnimationTimeout = null;
    }
  }

  // Helper function to adjust color brightness
  adjustColor(color, amount) {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
  }
} 