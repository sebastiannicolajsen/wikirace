class WaitingTimer {
    constructor() {
        this.timerElement = null;
        this.progressBar = null;
        this.timerText = null;
        this.isVisible = false;
        this.initialized = false;
        this.container = null; // Store reference to the parent container
    }

    initialize(container) {
        if (this.initialized) return;
        if (!container) {
            console.error("WaitingTimer.initialize: Parent container not provided!");
            return;
        }
        this.container = container; // Store the container reference

        // Create the main timer container
        this.timerElement = document.createElement('div');
        this.timerElement.className = 'waiting-timer';
        this.timerElement.style.cssText = `
            width: 100%;
            height: 40px;
            background-color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.3s ease-in-out;
            opacity: 0;
            pointer-events: none;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            position: relative;
        `;

        // Create the progress bar
        this.progressBar = document.createElement('div');
        this.progressBar.className = 'waiting-timer-progress';
        this.progressBar.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            background-color: #4a6fa5;
            transition: width 0.1s linear;
            width: 100%;
            opacity: 0.15;
        `;

        // Create the timer text
        this.timerText = document.createElement('div');
        this.timerText.className = 'waiting-timer-text';
        this.timerText.style.cssText = `
            position: relative;
            color: #4a6fa5;
            font-size: 1.2em;
            font-weight: bold;
            z-index: 1;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        `;

        // Add elements to the container
        this.timerElement.appendChild(this.progressBar);
        this.timerElement.appendChild(this.timerText);
        
        // Add to the provided container
        this.container.appendChild(this.timerElement);
        this.initialized = true;
        console.log('Timer initialized and added to container');
    }

    show(container) {
        if (!this.initialized || (container && this.container !== container)) {
            this.initialize(container || this.container);
        }
        if (!this.initialized || !this.timerElement || !this.container) {
             console.error("WaitingTimer.show: Cannot show timer, not initialized or no container.");
             return;
        }

        this.container.style.height = '40px';

        this.isVisible = true;
        this.timerElement.style.opacity = '1';
        this.timerElement.style.pointerEvents = 'auto';
        console.log('Timer shown');
    }

    hide() {
        if (this.timerElement && this.container) {
            this.container.style.height = '0';
            this.isVisible = false;
            this.timerElement.style.opacity = '0';
            this.timerElement.style.pointerEvents = 'none';
            console.log('Timer hidden');
        }
    }

    update(startTime, duration) {
        if (!this.isVisible || !this.timerElement) return;

        const now = Date.now();
        const elapsed = now - startTime;
        const remaining = Math.max(0, duration - elapsed);
        const progress = (remaining / duration) * 100;

        // Update progress bar
        this.progressBar.style.width = `${progress}%`;

        // Update timer text - show only seconds
        const seconds = Math.ceil(remaining / 1000);
        this.timerText.textContent = `${seconds}s`;

        // Update color intensity based on remaining time
        const intensity = Math.min(1, (remaining / duration) * 2); // Fade as time runs out
        this.progressBar.style.opacity = `${0.1 + (intensity * 0.1)}`; // Range from 0.1 to 0.2
    }

    reset() {
        if (this.progressBar) {
            this.progressBar.style.width = '100%';
            this.progressBar.style.opacity = '0.2'; // Reset to full intensity
        }
        if (this.timerText) {
            this.timerText.textContent = '';
        }
    }
}

export default new WaitingTimer(); 