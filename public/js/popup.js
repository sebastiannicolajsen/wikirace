class PopupManager {
    constructor() {
        this.popups = new Map();
        this.activePopups = new Set();
        this.nextId = 1;

        // Bind methods to maintain correct this context
        this.showInfo = this.showInfo.bind(this);
        this.showDecision = this.showDecision.bind(this);
        this.createPopup = this.createPopup.bind(this);
        this.closePopup = this.closePopup.bind(this);
        this.closeAllPopups = this.closeAllPopups.bind(this);
    }

    showInfo(message, type = 'info', duration = 3000) {
        console.log('Showing popup:', { message, type, duration });
        const popup = this.createPopup('info', message, type);
        this.activePopups.add(popup);

        // Only set timeout for non-error popups
        if (type !== 'error' && duration > 0) {
            setTimeout(() => this.closePopup(popup), duration);
        }

        return popup;
    }

    showDecision(message, options) {
        return new Promise((resolve) => {
            const popup = this.createPopup('decision', message, options);
            this.activePopups.add(popup);

            // Add event listeners for options
            options.forEach(option => {
                const button = popup.querySelector(`[data-action="${option.action}"]`);
                if (button) {
                    button.addEventListener('click', () => {
                        this.closePopup(popup);
                        resolve(option.action);
                    });
                }
            });
        });
    }

    createPopup(type, message, icon = 'info', preventOutsideClick = false) {
        const id = this.nextId++;
        const popup = document.createElement('div');
        popup.className = 'popup';
        popup.id = `popup-${id}`;
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 1001;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            display: inline-flex;
            flex-direction: column;
            width: fit-content;
            height: fit-content;
            max-width: 80%;
            max-height: 80vh;
            overflow-y: auto;
        `;

        // Add popup to activePopups set immediately
        this.activePopups.add(popup);

        const messageContainer = document.createElement('div');
        messageContainer.className = 'popup-message-container';
        messageContainer.style.cssText = `
            padding: 1.5rem;
            margin: 0;
            background: none;
            position: relative;
            z-index: 1002;
            display: flex;
            justify-content: center;
            align-items: center;
            width: fit-content;
            height: fit-content;
        `;

        const messageElement = document.createElement('div');
        messageElement.className = 'popup-message';
        messageElement.textContent = message;
        messageContainer.appendChild(messageElement);

        const closeButton = document.createElement('button');
        closeButton.className = 'popup-close';
        closeButton.innerHTML = '&times;';
        closeButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            line-height: 1;
            color: #666;
            z-index: 1003;
        `;
        closeButton.onclick = () => this.closePopup(popup);

        popup.appendChild(closeButton);
        popup.appendChild(messageContainer);

        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;

        // Add click handler to overlay
        overlay.addEventListener('click', (e) => {
            // If preventOutsideClick is true, only allow clicks on buttons
            if (preventOutsideClick) {
                // Check if the click target is a button or its child
                const isButton = e.target.closest('button');
                if (!isButton) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            } else {
                // For regular popups, close when clicking the overlay
                if (e.target === overlay) {
                    this.closePopup(popup);
                }
            }
        });

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        this.popups.set(id, { popup, overlay });
        return popup;
    }

    closePopup(popup) {
        if (!popup || !popup.id) {
            console.warn('Attempted to close invalid popup:', popup);
            return;
        }

        const id = parseInt(popup.id.split('-')[1]);
        const popupData = this.popups.get(id);
        
        if (!popupData) {
            // If popup data not found but popup still exists in DOM, remove it
            const overlay = popup.closest('.popup-overlay');
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            this.activePopups.delete(popup);
            return;
        }

        const { overlay } = popupData;
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        this.popups.delete(id);
        this.activePopups.delete(popup);
        
        // Dispatch event for popup close
        const event = new CustomEvent('popup-closed');
        document.dispatchEvent(event);
    }

    closeAllPopups() {
        this.activePopups.forEach(popup => this.closePopup(popup));
        this.activePopups.clear();
    }
}

// Create a singleton instance
const popupManager = new PopupManager();

export default popupManager; 