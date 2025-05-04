import waitingTimer from './waitingTimer.js';

class TimerManager {
    constructor() {
        this.timers = new Map();
        this.waitingTimerUpdateInterval = null;
    }

    startTimer(id, duration, onTick, onComplete) {
        // Clear any existing timer
        this.stopTimer(id);

        const startTime = Date.now();
        const endTime = startTime + duration;

        const timer = {
            id,
            startTime,
            endTime,
            duration,
            onTick,
            onComplete,
            interval: null
        };

        // Start the interval
        timer.interval = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, endTime - now);

            if (onTick) {
                onTick(remaining);
            }

            if (remaining === 0) {
                this.stopTimer(id);
                if (onComplete) {
                    onComplete();
                }
            }
        }, 100); // Update every 100ms for smooth countdown

        this.timers.set(id, timer);
        return timer;
    }

    stopTimer(id) {
        const timer = this.timers.get(id);
        if (timer) {
            clearInterval(timer.interval);
            this.timers.delete(id);
        }
    }

    getRemainingTime(id) {
        const timer = this.timers.get(id);
        if (timer) {
            return Math.max(0, timer.endTime - Date.now());
        }
        return 0;
    }

    formatTime(ms) {
        const seconds = Math.ceil(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    createTimerDisplay(id, container) {
        // Create a wrapper div that will be fixed to the viewport
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            pointer-events: none;
            z-index: 999;
        `;

        const display = document.createElement('div');
        display.className = 'timer';
        display.id = `timer-${id}`;
        display.style.cssText = `
            position: absolute;
            top: 80px; /* Position below header */
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(255, 255, 255, 0.9);
            padding: 8px 16px;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            font-size: 1.2rem;
            font-weight: bold;
            pointer-events: none;
        `;

        wrapper.appendChild(display);
        document.body.appendChild(wrapper);

        return {
            update: (remaining) => {
                display.textContent = this.formatTime(remaining);
            },
            remove: () => {
                wrapper.remove();
            }
        };
    }

    startGameTimer(duration, container) {
        const display = this.createTimerDisplay('game', container);
        
        return this.startTimer('game', duration,
            (remaining) => display.update(remaining),
            () => {
                display.remove();
                // Dispatch a custom event when the timer completes
                const event = new CustomEvent('game-timer-complete');
                window.dispatchEvent(event);
            }
        );
    }

    startAdditionTimer(duration, container) {
        const display = this.createTimerDisplay('addition', container);
        
        return this.startTimer('addition', duration,
            (remaining) => display.update(remaining),
            () => {
                display.remove();
                // Dispatch a custom event when the timer completes
                const event = new CustomEvent('addition-timer-complete');
                window.dispatchEvent(event);
            }
        );
    }

    startWaitingTimer(startTime, duration) {
        // Clear any existing waiting timer update interval
        if (this.waitingTimerUpdateInterval) {
            clearInterval(this.waitingTimerUpdateInterval);
        }

        // Reset and show the waiting timer
        waitingTimer.reset();
        
        // Function to try to initialize the timer
        const tryInitializeTimer = () => {
            const containerElement = document.getElementById('timerContainer');
            if (!containerElement) {
                // If container not found, try again in 100ms
                setTimeout(tryInitializeTimer, 100);
                return;
            }
            
            // Container found, show the timer
            waitingTimer.show(containerElement);

            // Start the update interval
            this.waitingTimerUpdateInterval = setInterval(() => {
                const remaining = waitingTimer.update(startTime, duration);
                // Only hide if time has actually run out
                if (remaining <= 0) {
                    this.stopWaitingTimer();
                }
            }, 100); // Update every 100ms for smooth animation
        };

        // Start trying to initialize
        tryInitializeTimer();
    }

    stopWaitingTimer() {
        if (this.waitingTimerUpdateInterval) {
            clearInterval(this.waitingTimerUpdateInterval);
            this.waitingTimerUpdateInterval = null;
        }
        // Hide will use the container reference stored during show/initialize
        waitingTimer.hide();
    }
}

// Create a singleton instance
const timerManager = new TimerManager();

export default timerManager; 