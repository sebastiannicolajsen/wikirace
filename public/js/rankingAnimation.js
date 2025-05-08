class RankingAnimation {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '1000';
    document.body.appendChild(this.canvas);
    
    this.labels = [];
    this.animationFrame = null;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(document.body);
    this.resize();

    // Load confetti script
    if (!window.confetti) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
      script.onload = () => {
        this.confettiLoaded = true;
      };
      document.head.appendChild(script);
    } else {
      this.confettiLoaded = true;
    }
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  createLabel(x, y, rank, playerName) {
    const width = 180;
    const height = 90;
    const label = {
      x: x,
      y: y + 30, // Position lower
      targetX: x,
      targetY: y + 30, // Position lower
      width,
      height,
      rank,
      playerName,
      opacity: 0,
      targetOpacity: 1,
      scale: 0.8,
      targetScale: 1,
      bounceOffset: 20,
      delay: rank * 1000,
      startTime: Date.now(),
      color: this.getRankColor(rank),
      shineOffset: 0,
      shineWidth: 60,
      wiggleOffset: 0,
      wiggleDirection: 1,
      wiggleSpeed: 0.05 + Math.random() * 0.05
    };
    this.labels.push(label);
  }

  getRankColor(rank) {
    switch(rank) {
      case 1: return '#FFD700'; // Gold
      case 2: return '#C0C0C0'; // Silver
      case 3: return '#CD7F32'; // Bronze
      default: return '#FFFFFF'; // White
    }
  }

  createMetallicGradient(ctx, x, y, width, height, color, shineOffset) {
    // Create base gradient
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    
    // Add metallic effect
    gradient.addColorStop(0, this.adjustColor(color, 30)); // Lighter top
    gradient.addColorStop(0.5, color); // Base color
    gradient.addColorStop(1, this.adjustColor(color, -30)); // Darker bottom
    
    return gradient;
  }

  createTextGradient(ctx, x, y, width, height) {
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    
    // Add metallic text effect with fixed colors
    gradient.addColorStop(0, '#FFFFFF'); // Light top
    gradient.addColorStop(0.5, '#CCCCCC'); // Middle
    gradient.addColorStop(1, '#999999'); // Dark bottom
    
    return gradient;
  }

  createShineGradient(ctx, x, y, width, height, shineOffset) {
    const shineGradient = ctx.createLinearGradient(
      x + shineOffset - 30, y,
      x + shineOffset + 30, y
    );
    
    shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    shineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
    shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    return shineGradient;
  }

  adjustColor(color, amount) {
    // Convert hex to RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    
    // Adjust each component
    const newR = Math.max(0, Math.min(255, r + amount));
    const newG = Math.max(0, Math.min(255, g + amount));
    const newB = Math.max(0, Math.min(255, b + amount));
    
    // Convert back to hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }

  drawLabel(label) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(label.x, label.y + label.bounceOffset + label.wiggleOffset);
    ctx.scale(label.scale, label.scale);
    ctx.globalAlpha = label.opacity;

    // Draw background with metallic gradient
    const baseGradient = this.createMetallicGradient(
      ctx,
      -label.width/2,
      -label.height/2,
      label.width,
      label.height,
      label.color,
      label.shineOffset
    );
    
    ctx.fillStyle = baseGradient;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-label.width/2, -label.height/2, label.width, label.height, 18);
    ctx.fill();
    ctx.stroke();

    // Draw shine effect
    const shineGradient = this.createShineGradient(
      ctx,
      -label.width/2,
      -label.height/2,
      label.width,
      label.height,
      label.shineOffset
    );
    
    ctx.fillStyle = shineGradient;
    ctx.fill();

    // Draw rank text with metallic effect
    ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Create metallic text gradient
    const textGradient = this.createTextGradient(
      ctx,
      -label.width/2,
      -label.height/2,
      label.width,
      label.height
    );
    
    // Draw text shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    
    // Draw the text
    ctx.fillStyle = textGradient;
    ctx.fillText(`#${label.rank}`, 0, 0);

    ctx.restore();
  }

  triggerConfetti(x, y, color) {
    if (!this.confettiLoaded) return;

    const duration = 1 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Convert hex color to RGB
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      // Confetti from the label position
      window.confetti({
        ...defaults,
        particleCount,
        origin: { x: x / window.innerWidth, y: y / window.innerHeight },
        colors: [`rgb(${r}, ${g}, ${b})`, '#FFFFFF'],
        shapes: ['circle', 'square'],
        gravity: 1.5,
        scalar: 1.2,
        drift: 0
      });
    }, 250);
  }

  animate() {
    const now = Date.now();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    let allFinished = true;
    for (const label of this.labels) {
      const elapsed = now - label.startTime;
      if (elapsed < label.delay) {
        allFinished = false;
        continue;
      }

      // Trigger confetti when the label first appears
      if (elapsed - label.delay < 50 && !label.confettiTriggered) {
        this.triggerConfetti(label.x, label.y, label.color);
        label.confettiTriggered = true;
      }

      const progress = Math.min((elapsed - label.delay) / 350, 1);
      
      // Cubic bezier easing for smooth animation
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      // Update bounce offset with easing
      label.bounceOffset = label.bounceOffset * (1 - easeProgress);
      
      // Update scale with easing
      label.scale = label.scale + (label.targetScale - label.scale) * 0.1;
      
      // Update opacity with easing
      label.opacity = label.opacity + (label.targetOpacity - label.opacity) * 0.1;
      
      // Update shine position
      label.shineOffset = (label.shineOffset + 3) % (label.width + 60);
      
      // Update wiggle
      label.wiggleOffset += label.wiggleSpeed * label.wiggleDirection;
      if (Math.abs(label.wiggleOffset) > 2) {
        label.wiggleDirection *= -1;
      }
      
      this.drawLabel(label);

      if (Math.abs(label.bounceOffset) > 0.1 || Math.abs(label.opacity - label.targetOpacity) > 0.01) {
        allFinished = false;
      }
    }

    // Always continue animation for shine and wiggle effects
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  showRankings(rankings, playerPositions) {
    this.labels = [];
    this.resize();
    
    // Create labels for each ranking
    rankings.forEach((player, index) => {
      const position = playerPositions[player.name];
      console.log('Creating label for', player.name, 'at position', position);
      if (position) {
        this.createLabel(
          position.x,
          position.y,
          index + 1,
          player.name
        );
      }
    });

    this.animate();
  }
}

// Export the class
export default RankingAnimation; 