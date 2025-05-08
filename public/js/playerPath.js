function injectPlayerPathAnimationCSS() {
  if (document.getElementById('playerpath-popup-anim')) return;
  const style = document.createElement('style');
  style.id = 'playerpath-popup-anim';
  style.textContent = `
    @keyframes playerpath-fadein {
      0% { opacity: 0; transform: translateY(calc(var(--playerpath-bounce-offset, 0px) * 0.5)) scale(0.8); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    .playerpath-popup-animate {
      animation: playerpath-fadein 0.35s cubic-bezier(.34,1.56,.64,1) both;
      z-index: 2;
    }
    @keyframes playerpath-rope-fadein {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    .playerpath-rope-animate {
      animation: playerpath-rope-fadein 0.25s ease both;
    }
  `;
  document.head.appendChild(style);
}

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

class PlayerPath {
  constructor(container, roomId) {
    this.container = container;
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.style.position = 'absolute';
    this.svg.style.left = '0';
    this.svg.style.top = '0';
    this.svg.style.zIndex = '0';
    this.svg.style.pointerEvents = 'none'; // Allow clicks to pass through to elements below
    this.svg.style.overflow = 'visible'; // Allow content to overflow
    this.svg.setAttribute('data-room-id', roomId || 'default'); // Store room ID on SVG element
    this.container.appendChild(this.svg);
    this.previousLength = 0;
    this.roomId = roomId || 'default'; // Store room ID for localStorage key
    // Initialize cutoff from localStorage or default to 0
    this.cutOff = parseInt(localStorage.getItem(`playerPathCutoff_${this.roomId}`) || '0');
    this.isReducing = false;
    this.justReduced = false;
    this.reductionAnimationFrame = null;
    this.transitionPlate = null;
    injectPlayerPathAnimationCSS();
  }

  reducePath() {
    if (this.isReducing) return;
    this.isReducing = true;
    this.justReduced = false;
    
    // Clean up any existing transition plate
    if (this.transitionPlate) {
      this.transitionPlate.remove();
      this.transitionPlate = null;
    }
    
    // Create transition plate from the last URL
    const lastUrl = this.paths[this.paths.length - 1];
    if (!lastUrl) return;

    const plateWidth = 120 * 1.4;
    const plateHeight = 32;
    const centerX = this.centerX;
    const startY = this.startY;

    // Calculate the current visible count
    const visibleCount = this.paths.filter(url => url.effect !== 'cancelled').length - this.cutOff;
    
    // Create transition plate group
    this.transitionPlate = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    // Position it at the top of the current visible stack
    const initialY = startY - (visibleCount - 1) * (plateHeight + this.plateSpacing);
    this.transitionPlate.setAttribute('transform', `translate(${centerX},${initialY})`);
    this.transitionPlate.setAttribute('data-is-transition', 'true');
    
    // Clone the last plate's appearance
    const plate = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    plate.setAttribute('x', -plateWidth/2);
    plate.setAttribute('y', -plateHeight/2);
    plate.setAttribute('width', plateWidth);
    plate.setAttribute('height', plateHeight);
    plate.setAttribute('rx', '12');
    plate.setAttribute('fill', '#e2b97f');
    plate.setAttribute('stroke', '#222');
    plate.setAttribute('stroke-width', '2');
    plate.setAttribute('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))');
    this.transitionPlate.appendChild(plate);

    // Clone the title and format it before adding to SVG
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', '0');
    title.setAttribute('y', '0');
    title.setAttribute('font-size', '16');
    title.setAttribute('font-family', 'Arial');
    title.setAttribute('font-weight', 'bold');
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('alignment-baseline', 'middle');
    title.setAttribute('dominant-baseline', 'middle');
    title.setAttribute('fill', 'white');
    let urlTitle = lastUrl.title || (lastUrl.url ? decodeURIComponent(lastUrl.url.split('/').pop()).replace(/_/g, ' ') : '');
    title.textContent = urlTitle;

    // Create a temporary SVG to measure text
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    tempSvg.style.position = 'absolute';
    tempSvg.style.visibility = 'hidden';
    tempSvg.appendChild(title);
    document.body.appendChild(tempSvg);

    // Measure and scale text if needed
    const len = title.getComputedTextLength();
    if (len > plateWidth - 24) {
      const scale = (plateWidth - 24) / len;
      title.setAttribute('transform', `scale(${scale},1)`);
    }

    // Clean up temporary SVG
    document.body.removeChild(tempSvg);

    // Add formatted title to transition plate
    this.transitionPlate.appendChild(title);

    // Add the rope to the transition plate group
    const rope = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    rope.setAttribute('stroke', '#b88c4a');
    rope.setAttribute('stroke-width', '6');
    rope.setAttribute('fill', 'none');
    rope.setAttribute('filter', 'url(#ropeShadow)');
    // Make the rope extend beyond the bottom of the screen
    const ropeY1 = plateHeight / 2;
    const ropeY2 = this.container.clientHeight + 100; // Extend well beyond the container
    rope.setAttribute('d', `M0,${ropeY1} Q 10,${(ropeY1 + ropeY2) / 2} 0,${ropeY2}`);
    this.transitionPlate.appendChild(rope);

    // Add transition plate to SVG
    this.svg.appendChild(this.transitionPlate);
    
    // Store current positions of all elements
    const elements = Array.from(this.svg.children).filter(el => el !== this.transitionPlate);
    const startPositions = elements.map(el => ({
      element: el,
      y: parseFloat(el.getAttribute('transform')?.match(/translate\([^,]+,\s*([^)]+)\)/)?.[1] || '0')
    }));

    // Calculate target positions
    const targetPositions = startPositions.map((pos, index) => {
      const newY = pos.y + (this.plateHeight + this.plateSpacing) * 3;
      return { element: pos.element, y: newY };
    });

    // Animation start time
    const startTime = performance.now();
    const duration = 800; // Animation duration in ms

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      // Update positions of existing elements
      startPositions.forEach((start, index) => {
        const target = targetPositions[index];
        const currentY = start.y + (target.y - start.y) * easeProgress;
        
        // Update transform while preserving x position
        const transform = start.element.getAttribute('transform');
        const x = transform?.match(/translate\(([^,]+)/)?.[1] || '0';
        start.element.setAttribute('transform', `translate(${x},${currentY})`);
      });

      // Animate transition plate
      if (this.transitionPlate) {
        const currentY = initialY + (this.startY - initialY) * easeProgress;
        this.transitionPlate.setAttribute('transform', `translate(${centerX},${currentY})`);
      }

      if (progress < 1) {
        this.reductionAnimationFrame = requestAnimationFrame(animate);
      } else {
        // Animation complete, update cutOff and redraw
        // Count only non-cancelled URLs for the cutoff
        const nonCancelledCount = this.paths.filter(url => url.effect !== 'cancelled').length;
        this.cutOff = Math.min(this.cutOff + 3, nonCancelledCount - 1); // Ensure we always keep at least one URL visible
        // Store the new cutoff in localStorage with room ID
        localStorage.setItem(`playerPathCutoff_${this.roomId}`, this.cutOff.toString());
        this.isReducing = false;
        this.justReduced = true;
        this.reductionAnimationFrame = null;
        // Don't remove the transition plate, it becomes our new base
        this.transitionPlate = null;
        // Force a redraw to clean up hidden elements
        this.update(this.currentPath);
      }
    };

    // Store current path for redraw
    this.currentPath = Array.from(this.paths || []);
    this.reductionAnimationFrame = requestAnimationFrame(animate);
  }

  update(path) {
    // Store the current path for potential redraw after reduction
    this.paths = path;
    
    // Only animate if path is longer than before
    const shouldAnimate = path.length > this.previousLength;
    this.previousLength = path.length;
    
    // Clear previous elements except the transition plate if it exists
    const elementsToRemove = [];
    let currentChild = this.svg.firstChild;
    while (currentChild) {
      if (currentChild.getAttribute('data-is-transition') !== 'true') {
        elementsToRemove.push(currentChild);
      }
      currentChild = currentChild.nextSibling;
    }
    elementsToRemove.forEach(el => el.parentNode.removeChild(el));

    if (!path || !Array.isArray(path) || path.length === 0) return;

    // Add start URL if it's not already in the path
    if (path.length === 0 || path[0].effect !== 'start') {
      path.unshift({
        url: path[0]?.url || '',
        title: path[0]?.title || '',
        effect: 'start'
      });
    }

    const plateWidth = 120 * 1.4; // 168
    const plateHeight = 32;
    const numPlatesToFit = 5;
    const plateSpacing = (this.container.clientHeight / numPlatesToFit) - plateHeight;
    const ropeColor = '#b88c4a';
    const containerWidth = this.container.clientWidth;
    const containerHeight = this.container.clientHeight;
    const centerX = containerWidth / 2;
    const startY = containerHeight - 60; // Start from bottom with some padding

    // Store these values for position calculation
    this.plateHeight = plateHeight;
    this.plateSpacing = plateSpacing;
    this.startY = startY;
    this.centerX = centerX;

    // Rope shadow filter
    if (!this.svg.querySelector('filter#ropeShadow')) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.setAttribute('id', 'ropeShadow');
      const feDropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
      feDropShadow.setAttribute('dx', '0');
      feDropShadow.setAttribute('dy', '2');
      feDropShadow.setAttribute('stdDeviation', '2');
      feDropShadow.setAttribute('flood-color', '#000');
      feDropShadow.setAttribute('flood-opacity', '0.18');
      filter.appendChild(feDropShadow);
      defs.appendChild(filter);
      this.svg.appendChild(defs);
    }

    // Calculate visible indices (excluding cancelled effects)
    const visibleIndices = [];
    let nonCancelledCount = 0;
    
    // Process all URLs based on cutoff
    for (let i = 0; i < path.length; i++) {
      if (path[i].effect !== "cancelled") {
        if (nonCancelledCount >= this.cutOff) {
          visibleIndices.push(i);
        }
        nonCancelledCount++;
      }
    }

    // Always ensure the last non-cancelled URL is included
    let lastNonCancelledIndex = -1;
    for (let i = path.length - 1; i >= 0; i--) {
      if (path[i].effect !== "cancelled") {
        lastNonCancelledIndex = i;
        break;
      }
    }

    // If we found a last non-cancelled URL and it's not already included, add it
    if (lastNonCancelledIndex !== -1 && !visibleIndices.includes(lastNonCancelledIndex)) {
      visibleIndices.push(lastNonCancelledIndex);
    }

    // Sort indices in reverse order (most recent at top, start URL at bottom)
    visibleIndices.sort((a, b) => b - a);

    console.log('Path:', path);
    console.log('Visible indices:', visibleIndices);
    console.log('Last non-cancelled index:', lastNonCancelledIndex);
    console.log('Cutoff:', this.cutOff);
    console.log('Non-cancelled count:', nonCancelledCount);

    // Draw ropes between visible plates
    // We'll delay drawing the last rope if animating
    let ropeElements = [];
    for (let i = 0; i < visibleIndices.length - 1; i++) { // Stop at second-to-last plate
      const y1 = startY - (visibleIndices.length - 1 - i) * (plateHeight + plateSpacing) + plateHeight / 2;
      const y2 = startY - (visibleIndices.length - 1 - (i + 1)) * (plateHeight + plateSpacing) + plateHeight / 2;
      const rope = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      rope.setAttribute('d', `M${centerX},${y1} Q ${centerX + 10},${(y1 + y2) / 2} ${centerX},${y2}`);
      rope.setAttribute('stroke', ropeColor);
      rope.setAttribute('stroke-width', '6');
      rope.setAttribute('fill', 'none');
      rope.setAttribute('filter', 'url(#ropeShadow)');
      
      // Only animate the rope for the newly added URL (the one at the top)
      if (shouldAnimate && i === 0) {
        rope.classList.add('playerpath-rope-animate');
        rope.style.opacity = '0'; // Hide initially
        ropeElements.push(rope); // Save for later
      } else {
        this.svg.appendChild(rope);
      }
    }

    // Draw plates (oldest at the bottom)
    let visiblePlateCount = 0;
    let lastPlateGroup = null;
    let lastEmojiGroup = null;
    let lastPlateY = null;
    for (let i = 0; i < visibleIndices.length; i++) {
      const urlObj = path[visibleIndices[i]];
      // Skip cancelled effects
      if (urlObj.effect === "cancelled") continue;

      // Calculate y position (in reverse order)
      const y = startY - (visibleIndices.length - 1 - i) * (plateHeight + plateSpacing);

      // Plate group
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${centerX},${y})`);

      // Create a separate group for effects that will be behind the plate
      const effectGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      effectGroup.setAttribute('transform', `translate(${centerX},${y})`);

      // Determine effect for this plate
      let effectToShow = null;
      if (i === visibleIndices.length - 1 && urlObj.effect === 'start') { // Only show start emoji for the actual first URL
        effectToShow = getEffectEmoji('start');
      } else if (urlObj.effect && urlObj.effect !== 'none' && urlObj.effect !== 'cancelled') {
        effectToShow = getEffectEmoji(urlObj.effect);
      }

      // Effect emoji (if any)
      if (effectToShow) {
        // Place to the top-right corner, overlapping the plate
        const overlap = 8; // Amount to overlap the plate
        const boxWidth = 48;
        const boxHeight = 48;
        const boxX = plateWidth/2 - overlap - 8;
        const boxY = -plateHeight/2 - boxHeight/2 + 4;
        const boxCenterX = boxX + boxWidth/2;
        const boxCenterY = boxY + boxHeight/2;
        // Create a group for the box and emoji, rotated 40deg
        const emojiGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        emojiGroup.setAttribute('transform', `rotate(40,${boxCenterX},${boxCenterY})`);
        // Box
        const effectBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        effectBg.setAttribute('x', boxX);
        effectBg.setAttribute('y', boxY);
        effectBg.setAttribute('width', boxWidth);
        effectBg.setAttribute('height', boxHeight);
        effectBg.setAttribute('rx', '18');
        effectBg.setAttribute('fill', '#fffbe7');
        effectBg.setAttribute('stroke', '#222');
        effectBg.setAttribute('stroke-width', '2');
        effectBg.setAttribute('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))');
        emojiGroup.appendChild(effectBg);
        // Emoji
        const effectText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        effectText.setAttribute('x', boxCenterX);
        effectText.setAttribute('y', boxCenterY + 5);
        effectText.setAttribute('font-size', '34');
        effectText.setAttribute('text-anchor', 'middle');
        effectText.setAttribute('alignment-baseline', 'middle');
        effectText.setAttribute('dominant-baseline', 'middle');
        effectText.setAttribute('stroke', 'black');
        effectText.setAttribute('stroke-width', '1.5');
        effectText.setAttribute('paint-order', 'stroke');
        effectText.setAttribute('fill', 'white');
        effectText.textContent = effectToShow;
        emojiGroup.appendChild(effectText);
        effectGroup.appendChild(emojiGroup);
      }

      // Plate background
      const plate = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      plate.setAttribute('x', -plateWidth/2);
      plate.setAttribute('y', -plateHeight/2);
      plate.setAttribute('width', plateWidth);
      plate.setAttribute('height', plateHeight);
      plate.setAttribute('rx', '12');
      plate.setAttribute('fill', '#e2b97f'); // Wooden brown
      plate.setAttribute('stroke', '#222');
      plate.setAttribute('stroke-width', '2');
      plate.setAttribute('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))');
      g.appendChild(plate);

      // Plate title (scale font to fit)
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      title.setAttribute('x', '0');
      title.setAttribute('y', '0');
      title.setAttribute('font-size', '16');
      title.setAttribute('font-family', 'Arial');
      title.setAttribute('font-weight', 'bold');
      title.setAttribute('text-anchor', 'middle');
      title.setAttribute('alignment-baseline', 'middle');
      title.setAttribute('dominant-baseline', 'middle');
      title.setAttribute('fill', 'white'); // White text
      // Extract title from urlObj.url
      let urlTitle = urlObj.title || (urlObj.url ? decodeURIComponent(urlObj.url.split('/').pop()).replace(/_/g, ' ') : '');
      title.textContent = urlTitle;
      g.appendChild(title);

      // Scale font if needed
      setTimeout(() => {
        const len = title.getComputedTextLength();
        if (len > plateWidth - 24) {
          const scale = (plateWidth - 24) / len;
          title.setAttribute('transform', `scale(${scale},1)`);
        }
      }, 0);

      // First append the effect group (behind)
      if (effectToShow) {
        this.svg.appendChild(effectGroup);
      }

      // Then append the plate group (in front)
      this.svg.appendChild(g);
      lastPlateY = y;
      visiblePlateCount++;

      // If this is the last plate and we're animating, add the rope after it
      if (shouldAnimate && i === 0 && ropeElements.length > 0) {
        const rope = ropeElements[0];
        rope.style.opacity = '';
        this.svg.insertBefore(rope, g);
      }
    }

    // Reset justReduced flag after update
    this.justReduced = false;
  }

  getLatestPlatePosition() {
    if (!this.paths || this.paths.length === 0) return null;
    
    // If we're in the middle of a reduction, use the transition plate position
    if (this.isReducing && this.transitionPlate) {
      const transform = this.transitionPlate.getAttribute('transform');
      const y = parseFloat(transform?.match(/translate\([^,]+,\s*([^)]+)\)/)?.[1] || '0');
      const characterOffset = -90; // Offset to position character above the plate
      return {
        x: this.centerX,
        y: y + characterOffset
      };
    }
    
    // Calculate position of the most recent plate
    let y;
    if (this.justReduced) {
      y = this.startY; // Use bottom position if we just reduced
    } else {
      // Count non-cancelled URLs up to the last one
      const nonCancelledCount = this.paths.filter(url => url.effect !== 'cancelled').length;
      y = this.startY - (nonCancelledCount - 1 - this.cutOff) * (this.plateHeight + this.plateSpacing);
    }
    
    // Position the character above the plate by adding an offset
    const characterOffset = -110; // Offset to position character above the plate
    return {
      x: this.centerX,
      y: y + characterOffset
    };
  }

  clearStorage() {
    localStorage.removeItem(`playerPathCutoff_${this.roomId}`);
  }
}

export default PlayerPath; 