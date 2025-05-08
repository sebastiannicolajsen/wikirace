export default class ObserverTimer {
  constructor() {
    this.timerElement = null;
    this.countdownInterval = null;
    this.remainingTime = 0;
    this.isVisible = false;
    this.createTimerElement();
  }

  createTimerElement() {
    this.timerElement = document.createElement("div");
    this.timerElement.className = "observer-timer";

    // Add keyframes for animations
    const style = document.createElement("style");
    style.textContent = `
      @keyframes dropIn {
        from {
          transform: translate(-50%, -100%) scale(0.8);
          opacity: 0;
        }
        to {
          transform: translate(-50%, 0) scale(1);
          opacity: 1;
        }
      }

      @keyframes dropOut {
        from {
          transform: translate(-50%, 0) scale(1);
          opacity: 1;
        }
        to {
          transform: translate(-50%, -100%) scale(0.8);
          opacity: 0;
        }
      }

      @keyframes fisheye {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.15);
        }
      }

      @keyframes wiggle {
        0%, 100% {
          transform: translate(-50%, 0) rotate(0deg);
        }
        25% {
          transform: translate(-50%, 0) rotate(-2deg);
        }
        75% {
          transform: translate(-50%, 0) rotate(2deg);
        }
      }

      .observer-timer {
        position: fixed;
        top: 2rem;
        left: 50%;
        background: #8B4513;
        padding: 2rem 4rem;
        border-radius: 30px;
        box-shadow: 
          0 6px 0 #5D2E0C,
          0 12px 24px rgba(0,0,0,0.2),
          inset 0 3px 0 rgba(255,255,255,0.2);
        font-size: 48px;
        font-weight: bold;
        color: #FFD700;
        text-shadow: 3px 3px 0 #5D2E0C;
        z-index: 10;
        display: none;
        font-family: 'Comic Sans MS', cursive, sans-serif;
        border: 6px solid #5D2E0C;
        min-width: 200px;
        text-align: center;
      }

      .observer-timer.showing {
        animation: dropIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards !important;
      }

      .observer-timer.showing.animated {
        animation: dropIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards,
                   fisheye 2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite,
                   wiggle 2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite !important;
      }

      .observer-timer.hiding {
        animation: dropOut 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.timerElement);
  }

  show(seconds) {
    if (this.isVisible) return;
    this.remainingTime = seconds;
    
    // First set the initial state
    this.timerElement.style.transform = "translate(-50%, -100%) scale(0.8)";
    this.timerElement.style.display = "block";
    
    // Force a reflow
    this.timerElement.offsetHeight;
    
    // Remove hiding class and add showing class
    this.timerElement.classList.remove("hiding");
    this.timerElement.classList.add("showing");
    this.isVisible = true;
    this.startCountdown();

    // Add the continuous animations after the drop-in is complete
    setTimeout(() => {
      this.timerElement.classList.add("animated");
      // Force a reflow to ensure the new animation starts
      this.timerElement.offsetHeight;
    }, 400);
  }

  hide() {
    if (!this.isVisible) return;
    this.stopCountdown();
    this.timerElement.classList.remove("showing", "animated");
    this.timerElement.classList.add("hiding");
    setTimeout(() => {
      this.timerElement.style.display = "none";
      this.isVisible = false;
    }, 400);
  }

  startCountdown() {
    this.updateDisplay();
    this.countdownInterval = setInterval(() => {
      this.remainingTime--;
      if (this.remainingTime <= 0) {
        this.hide();
      } else {
        this.updateDisplay();
      }
    }, 1000);
  }

  stopCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  updateDisplay() {
    const minutes = Math.floor(this.remainingTime / 60);
    const seconds = this.remainingTime % 60;
    this.timerElement.textContent = `${minutes}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }
}
