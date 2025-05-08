class PlayerCharacter {
  static COLORS = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Mint
    '#FFEEAD', // Yellow
    '#D4A5A5', // Pink
    '#9B59B6', // Purple
    '#3498DB', // Light Blue
    '#E67E22', // Orange
    '#2ECC71', // Green
  ];

  static SHAPES = [
    // Asymmetric triangle
    'M 50,10 L 85,85 L 15,75 Z',
    // Asymmetric square
    'M 20,20 L 85,25 L 75,85 L 15,80 Z',
    // Asymmetric star
    'M 50,10 L 70,45 L 90,40 L 75,65 L 85,90 L 50,80 L 15,90 L 25,65 L 10,40 L 30,45 Z',
    // Asymmetric cloud
    'M 50,20 C 70,15 85,35 75,55 C 90,70 70,80 50,75 C 30,80 10,70 25,55 C 15,35 30,15 50,20 Z M 40,30 C 35,25 30,30 35,35 C 30,40 35,45 40,40',
    // Asymmetric hexagon
    'M 50,10 L 85,35 L 80,75 L 50,90 L 20,70 L 25,30 Z',
    // Asymmetric diamond
    'M 50,10 L 85,45 L 50,90 L 15,55 Z'
  ];

  static EYES = [
    // Round eyes
    { left: 'M 35,35 C 35,30 40,30 40,35 C 40,40 35,40 35,35 Z', right: 'M 60,35 C 60,30 65,30 65,35 C 65,40 60,40 60,35 Z' },
    // Square eyes
    { left: 'M 35,35 L 40,35 L 40,40 L 35,40 Z', right: 'M 60,35 L 65,35 L 65,40 L 60,40 Z' },
    // Triangle eyes
    { left: 'M 35,35 L 40,30 L 40,40 Z', right: 'M 60,35 L 65,30 L 65,40 Z' },
    // Star eyes
    { left: 'M 37.5,35 L 38,33 L 38.5,35 L 40,35 L 38.5,36 L 40,37 L 38.5,37 L 38,39 L 37.5,37 L 36,37 L 37.5,36 Z', 
      right: 'M 62.5,35 L 63,33 L 63.5,35 L 65,35 L 63.5,36 L 65,37 L 63.5,37 L 63,39 L 62.5,37 L 61,37 L 62.5,36 Z' },
  ];

  static EYEBROWS = [
    // Angry
    { left: 'M 35,25 C 35,30 40,30 40,25', right: 'M 60,25 C 60,30 65,30 65,25' },
    // Happy
    { left: 'M 35,30 C 35,25 40,25 40,30', right: 'M 60,30 C 60,25 65,25 65,30' },
    // Curved
    { left: 'M 35,25 C 37.5,30 40,25 40,30', right: 'M 60,25 C 62.5,30 65,25 65,30' },
    // Zigzag
    { left: 'M 35,25 L 37.5,30 L 40,25', right: 'M 60,25 L 62.5,30 L 65,25' }
  ];

  static MOUTHS = [
    // Big smile
    'M 30,50 C 40,60 60,60 70,50',
    // Small smile
    'M 40,50 C 45,55 55,55 60,50',
    // Frown
    'M 40,50 C 45,45 55,45 60,50',
    // Open mouth
    'M 40,50 C 45,55 55,55 60,50 M 45,55 L 55,55',
    // Wide open
    'M 35,50 C 40,60 60,60 65,50 M 40,60 L 60,60',
    // Neutral
    'M 40,50 L 60,50',
    // Surprised
    'M 45,50 C 45,60 55,60 55,50',
    // Grin
    'M 35,50 C 40,45 60,45 65,50 M 40,45 L 60,45',
    // Pout
    'M 40,50 C 45,55 55,55 60,50 M 45,55 C 45,60 55,60 55,55',
    // Smirk
    'M 40,50 C 45,45 55,55 60,50',
    // Tongue out
    'M 40,50 C 45,55 55,55 60,50 M 45,55 C 45,65 55,65 55,55',
    // Big grin
    'M 35,50 C 40,40 60,40 65,50 M 40,40 L 60,40',
    // Small pout
    'M 40,50 C 45,52 55,52 60,50 M 45,52 C 45,54 55,54 55,52',
    // Wide smirk
    'M 35,50 C 40,45 60,55 65,50',
    // Open smile
    'M 35,50 C 40,60 60,60 65,50 M 40,60 C 40,65 60,65 60,60'
  ];

  static getColorForPlayer(playerName, allPlayerNames) {
    const sortedNames = [...allPlayerNames].sort();
    const playerIndex = sortedNames.indexOf(playerName);
    return this.COLORS[playerIndex % this.COLORS.length];
  }

  static getShapeForPlayer(playerName, allPlayerNames) {
    const sortedNames = [...allPlayerNames].sort();
    const playerIndex = sortedNames.indexOf(playerName);
    return this.SHAPES[playerIndex % this.SHAPES.length];
  }

  static getEyesForPlayer(playerName, allPlayerNames) {
    const sortedNames = [...allPlayerNames].sort();
    const playerIndex = sortedNames.indexOf(playerName);
    return this.EYES[playerIndex % this.EYES.length];
  }

  static getEyebrowsForPlayer(playerName, allPlayerNames) {
    const sortedNames = [...allPlayerNames].sort();
    const playerIndex = sortedNames.indexOf(playerName);
    return this.EYEBROWS[playerIndex % this.EYEBROWS.length];
  }

  static getMouthForPlayer(playerName, allPlayerNames) {
    const sortedNames = [...allPlayerNames].sort();
    const playerIndex = sortedNames.indexOf(playerName);
    return this.MOUTHS[playerIndex % this.MOUTHS.length];
  }

  constructor(playerName, allPlayerNames) {
    this.name = playerName;
    this.color = PlayerCharacter.getColorForPlayer(playerName, allPlayerNames) || PlayerCharacter.COLORS[0];
    this.shape = PlayerCharacter.getShapeForPlayer(playerName, allPlayerNames) || PlayerCharacter.SHAPES[0];
    this.eyes = PlayerCharacter.getEyesForPlayer(playerName, allPlayerNames) || PlayerCharacter.EYES[0];
    this.eyebrows = PlayerCharacter.getEyebrowsForPlayer(playerName, allPlayerNames) || PlayerCharacter.EYEBROWS[0];
    this.mouth = PlayerCharacter.getMouthForPlayer(playerName, allPlayerNames) || PlayerCharacter.MOUTHS[0];
    this.isLookingLeft = false;
    this.verticalOffset = 0;
    this.horizontalOffset = 0;
    this.animationFrame = null;
    this.animationTime = Math.random() * 1000;
    this.lastMouthChange = Math.random() * 2; // Random start time
    this.currentMouthIndex = 0;
    this.mouthChangeInterval = 1.5 + Math.random() * 2; // Random interval between 1.5 and 3.5 seconds
    this.mouthChangeProbability = 0.3 + Math.random() * 0.4; // Random probability between 0.3 and 0.7
    this.targetPosition = null;
    this.currentPosition = null;
  }

  createNameTag() {
    // Create SVG group for the name tag
    const nameTag = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Create a temporary SVG text element to measure text width
    const tempSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    tempText.setAttribute('x', '0');
    tempText.setAttribute('y', '14');
    tempText.setAttribute('font-family', 'Arial');
    tempText.setAttribute('font-weight', 'bold');
    tempText.setAttribute('font-size', '16');
    tempText.textContent = this.name;
    tempSVG.appendChild(tempText);
    document.body.appendChild(tempSVG); // Attach temporarily to measure
    const textLength = tempText.getComputedTextLength();
    document.body.removeChild(tempSVG);

    // Box sizing
    const padding = 18;
    const minWidth = 60;
    const maxWidth = 120;
    const boxScale = 1.2;
    let boxWidth = Math.max(minWidth, Math.min(textLength + padding, maxWidth));

    // Arc path for name plate, shadow, and text
    const arcWidth = boxWidth;
    const arcHeight = 18; // make the label taller
    const arcCurve = 8; // gentle downward bow
    const arcY = -20; // vertical offset below character
    const textYOffset = 9; // offset text downward to center in plate
    // Top arc for plate
    const topArc = `M ${-arcWidth/2},${arcY} Q 0,${arcY + arcCurve} ${arcWidth/2},${arcY}`;
    // Top arc for text (slightly lower)
    const textTopArc = `M ${-arcWidth/2},${arcY + textYOffset} Q 0,${arcY + arcCurve + textYOffset} ${arcWidth/2},${arcY + textYOffset}`;
    // Bottom arc (parallel, arcHeight below)
    const bottomArc = `Q 0,${arcY + arcCurve + arcHeight} ${-arcWidth/2},${arcY + arcHeight}`;
    // Full band path: top arc left to right, then bottom arc right to left, close
    const bandPath = `${topArc} L ${arcWidth/2},${arcY + arcHeight} ${bottomArc} Z`;

    // Place the name tag group just below the character
    nameTag.setAttribute('transform', `translate(0, 55) scale(${boxScale})`);
    nameTag.dataset.scale = boxScale;

    // Shadow (blurred band below the plate)
    const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shadow.setAttribute('d', bandPath);
    shadow.setAttribute('fill', 'rgba(0,0,0,0.18)');
    shadow.setAttribute('filter', 'blur(4px)');
    shadow.setAttribute('transform', 'translate(0, 8)');
    nameTag.appendChild(shadow);

    // Name plate (band)
    const plate = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    plate.setAttribute('d', bandPath);
    plate.setAttribute('stroke', 'black');
    plate.setAttribute('stroke-width', '2');
    plate.setAttribute('fill', this.color);
    plate.setAttribute('filter', '');
    nameTag.appendChild(plate);

    // Arc path for text (use textTopArc)
    const textArcId = `fisheyeTextArc-${Math.random().toString(36).substr(2, 9)}`;
    const textArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    textArc.setAttribute('id', textArcId);
    textArc.setAttribute('d', textTopArc);
    textArc.setAttribute('fill', 'none');
    nameTag.appendChild(textArc);

    // Measure arc length for fitting text (use textTopArc)
    const tempArcSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const tempArcPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempArcPath.setAttribute('d', textTopArc);
    tempArcSVG.appendChild(tempArcPath);
    document.body.appendChild(tempArcSVG);
    const arcLength = tempArcPath.getTotalLength();
    document.body.removeChild(tempArcSVG);

    // Curved text using textPath
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('fill', 'white');
    text.setAttribute('font-family', 'Arial');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('font-size', '16');
    text.setAttribute('text-anchor', 'middle');
    const textPath = document.createElementNS('http://www.w3.org/2000/svg', 'textPath');
    textPath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${textArcId}`);
    textPath.setAttribute('startOffset', '50%');
    textPath.setAttribute('dominant-baseline', 'middle');
    textPath.textContent = this.name;
    // Scale text to fit arc if needed
    const arcPadding = 12;
    const tempTextArcSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const tempTextArc = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    tempTextArc.setAttribute('font-family', 'Arial');
    tempTextArc.setAttribute('font-weight', 'bold');
    tempTextArc.setAttribute('font-size', '16');
    tempTextArc.textContent = this.name;
    tempTextArcSVG.appendChild(tempTextArc);
    document.body.appendChild(tempTextArcSVG);
    const textLen = tempTextArc.getComputedTextLength();
    document.body.removeChild(tempTextArcSVG);
    if (textLen > arcLength - arcPadding) {
      textPath.setAttribute('textLength', (arcLength - arcPadding).toString());
      textPath.setAttribute('lengthAdjust', 'spacingAndGlyphs');
    }
    text.appendChild(textPath);
    nameTag.appendChild(text);

    return nameTag;
  }

  createSVG() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '-50 -60 100 120'); // Taller viewBox for shadow and name tag
    svg.setAttribute('width', '140px'); // Fixed width, slightly wider than URL labels (120px * 1.4)
    svg.setAttribute('height', '168px'); // Fixed height to maintain aspect ratio
    svg.style.margin = '0 auto';
    svg.style.overflow = 'visible';
    svg.style.maxWidth = 'none'; // Prevent any max-width constraints
    svg.style.maxHeight = 'none'; // Prevent any max-height constraints
    svg.style.width = '140px'; // Force exact width
    svg.style.height = '168px'; // Force exact height

    // Character group centered at (0,0), but shift shape to center
    const characterGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    characterGroup.setAttribute('transform', 'translate(-50, -50)');
    characterGroup.style.transformOrigin = '50% 50%';
    characterGroup.style.transformBox = 'fill-box';
    this.characterGroup = characterGroup; // Store reference for animation

    // Blob
    const blob = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    blob.setAttribute('d', this.shape);
    blob.setAttribute('fill', this.color);
    blob.setAttribute('stroke', 'black');
    blob.setAttribute('stroke-width', '2');
    characterGroup.appendChild(blob);

    // Eyebrows
    const leftEyebrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    leftEyebrow.setAttribute('d', this.eyebrows.left);
    leftEyebrow.setAttribute('stroke', 'black');
    leftEyebrow.setAttribute('stroke-width', '2');
    leftEyebrow.setAttribute('fill', 'none');
    characterGroup.appendChild(leftEyebrow);

    const rightEyebrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    rightEyebrow.setAttribute('d', this.eyebrows.right);
    rightEyebrow.setAttribute('stroke', 'black');
    rightEyebrow.setAttribute('stroke-width', '2');
    rightEyebrow.setAttribute('fill', 'none');
    characterGroup.appendChild(rightEyebrow);

    // Eyes
    const leftEye = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    leftEye.setAttribute('d', this.eyes.left);
    leftEye.setAttribute('fill', 'black');
    characterGroup.appendChild(leftEye);

    const rightEye = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    rightEye.setAttribute('d', this.eyes.right);
    rightEye.setAttribute('fill', 'black');
    characterGroup.appendChild(rightEye);

    // Mouth
    const mouth = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    mouth.setAttribute('d', this.mouth);
    mouth.setAttribute('stroke', 'black');
    mouth.setAttribute('stroke-width', '2');
    mouth.setAttribute('fill', 'none');
    characterGroup.appendChild(mouth);

    // Add character group to SVG
    svg.appendChild(characterGroup);

    // Shadow centered below character
    const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    shadow.setAttribute('cx', '0');
    shadow.setAttribute('cy', '35');
    shadow.setAttribute('rx', '30');
    shadow.setAttribute('ry', '10');
    shadow.setAttribute('fill', 'rgba(0, 0, 0, 0.2)');
    shadow.setAttribute('filter', 'blur(4px)');
    svg.insertBefore(shadow, characterGroup);

    // Add name tag
    const nameTag = this.createNameTag();
    svg.appendChild(nameTag);

    return svg;
  }

  startAnimation() {
    if (this.animationFrame) return;

    const animate = () => {
      // Update animation time
      this.animationTime += 0.016;

      // Only use vertical wobble, remove horizontal movement
      const verticalWobble = Math.sin(this.animationTime * 2) * 4;
      const rotationWobble = Math.sin(this.animationTime * 2.5) * 5;

      // Subtle name tag wobble (vertical and horizontal)
      const nameTagWobble = Math.sin(this.animationTime * 1.2) * 1.5;
      const nameTagWobbleX = Math.sin(this.animationTime * 1.7) * 4;

      this.verticalOffset = verticalWobble;

      // Random direction change (reduced frequency)
      if (Math.random() < 0.005) {
        this.isLookingLeft = !this.isLookingLeft;
      }

      // Change mouth expression organically
      if (this.animationTime - this.lastMouthChange > this.mouthChangeInterval) {
        // Only change mouth if random check passes
        if (Math.random() < this.mouthChangeProbability) {
          // Sometimes keep the same expression
          if (Math.random() < 0.3) {
            this.currentMouthIndex = this.currentMouthIndex;
          } else {
            // Otherwise pick a new expression, sometimes adjacent to current one
            if (Math.random() < 0.6) {
              // Move to adjacent expression
              this.currentMouthIndex = (this.currentMouthIndex + (Math.random() < 0.5 ? 1 : -1) + PlayerCharacter.MOUTHS.length) % PlayerCharacter.MOUTHS.length;
            } else {
              // Random jump to any expression
              this.currentMouthIndex = Math.floor(Math.random() * PlayerCharacter.MOUTHS.length);
            }
          }
          
          const mouth = this.characterGroup?.querySelector('path:last-of-type');
          if (mouth) {
            mouth.setAttribute('d', PlayerCharacter.MOUTHS[this.currentMouthIndex]);
          }
        }
        this.lastMouthChange = this.animationTime;
        // Randomize next interval
        this.mouthChangeInterval = 1.5 + Math.random() * 2;
      }

      // Apply all transformations
      if (this.characterGroup) {
        this.characterGroup.style.transform = `translate(-50px, -50px) translateY(${this.verticalOffset}px) rotate(${rotationWobble}deg) scaleX(${this.isLookingLeft ? -1 : 1})`;
      }

      // Name tag and emoji animation (unchanged)
      const svg = this.element;
      if (svg) {
        const nameTag = svg.querySelector('g:last-of-type');
        if (nameTag) {
          const scale = nameTag.dataset.scale || '1.2';
          nameTag.style.transform = `translate(${nameTagWobbleX}px, 55px) scale(${scale}) translateY(${nameTagWobble}px)`;
        }
      }

      this.animationFrame = requestAnimationFrame(animate);
    };

    animate();
  }

  stopAnimation() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  updatePosition(targetPosition) {
    if (!targetPosition) return;
    
    // If this is the first position update, set it immediately without animation
    if (!this.currentPosition) {
      this.currentPosition = { ...targetPosition };
      this._applyPosition();
      return;
    }

    // Otherwise, animate to the new position
    this.targetPosition = targetPosition;
    if (!this._positionAnimationFrame) {
      this._animatePosition();
    }
  }

  _animatePosition() {
    if (!this.targetPosition || !this.currentPosition) return;

    const dx = this.targetPosition.x - this.currentPosition.x;
    const dy = this.targetPosition.y - this.currentPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If we're close enough, snap to target
    if (distance < 0.5) {
      this.currentPosition = { ...this.targetPosition };
      this._applyPosition();
      this._positionAnimationFrame = null;
      return;
    }

    // Smooth animation using easeOutQuad
    const speed = 0.15;
    this.currentPosition.x += dx * speed;
    this.currentPosition.y += dy * speed;

    this._applyPosition();
    this._positionAnimationFrame = requestAnimationFrame(() => this._animatePosition());
  }

  _applyPosition() {
    if (!this.element || !this.currentPosition) return;
    
    // Apply the position to the SVG element
    this.element.style.position = 'absolute';
    this.element.style.left = `${this.currentPosition.x}px`;
    this.element.style.top = `${this.currentPosition.y}px`;
    this.element.style.transform = 'translate(-50%, -50%)';
    this.element.style.width = '140px'; // Force exact width
    this.element.style.height = '168px'; // Force exact height
  }

  render(container) {
    if (this.element && this.element.parentNode) {
      this.stopAnimation();
      this.element.parentNode.removeChild(this.element);
    }
    this.element = this.createSVG();
    container.style.position = 'relative'; // Only set position context
    container.appendChild(this.element);
    this.startAnimation();
  }

  setEmoji(emoji) {
    if (!this.element) return;
    if (this._emojiChar === emoji && this._emojiElement && !this._emojiRemoving) return; // Already set, do nothing
    if (this._emojiRemoving) {
      // If a removal is in progress, queue the new emoji
      this._queuedEmoji = emoji;
      return;
    }
    // If a different emoji is set, animate removal first
    if (this._emojiElement) {
      this._emojiRemoving = true;
      this.hideEmoji();
      setTimeout(() => {
        this._emojiRemoving = false;
        this._emojiElement = null;
        if (this._queuedEmoji !== undefined) {
          const nextEmoji = this._queuedEmoji;
          this._queuedEmoji = undefined;
          this.setEmoji(nextEmoji);
        } else {
          this._setEmojiInternal(emoji);
        }
      }, 220);
    } else {
      this._setEmojiInternal(emoji);
    }
  }

  _setEmojiInternal(emoji) {
    this._emojiChar = emoji;
    this.hideEmoji(true);
    const svg = this.element;
    // Create group for emoji and background
    const emojiGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    emojiGroup.setAttribute('class', 'player-emoji-group');
    // Initial position: lower, smaller, behind
    emojiGroup.setAttribute('transform', 'translate(32,10)');
    // Background box
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '-22');
    bg.setAttribute('y', '-22');
    bg.setAttribute('width', '44');
    bg.setAttribute('height', '44');
    bg.setAttribute('rx', '14');
    bg.setAttribute('fill', '#fffbe7');
    bg.setAttribute('stroke', '#222');
    bg.setAttribute('stroke-width', '3');
    bg.setAttribute('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))');
    emojiGroup.appendChild(bg);
    // Emoji text
    const emojiText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    emojiText.setAttribute('class', 'player-emoji');
    emojiText.setAttribute('x', '0');
    emojiText.setAttribute('y', '5');
    emojiText.setAttribute('font-size', '32');
    emojiText.setAttribute('text-anchor', 'middle');
    emojiText.setAttribute('alignment-baseline', 'middle');
    emojiText.setAttribute('dominant-baseline', 'middle');
    emojiText.setAttribute('stroke', 'black');
    emojiText.setAttribute('stroke-width', '2');
    emojiText.setAttribute('paint-order', 'stroke');
    emojiText.setAttribute('fill', 'white');
    emojiText.textContent = emoji;
    emojiGroup.appendChild(emojiText);
    // Initial bounce-in from behind
    emojiGroup.style.opacity = '0';
    emojiGroup.style.transform += ' scale(0.5) rotate(15deg)';
    emojiGroup.style.transition = 'opacity 0.22s, transform 0.22s cubic-bezier(.34,1.56,.64,1)';
    // Insert before character group (behind)
    const charGroup = svg.querySelector('g:first-of-type');
    svg.insertBefore(emojiGroup, charGroup);
    this._emojiElement = emojiGroup;
    // Animate pop-in bounce
    setTimeout(() => {
      if (this._emojiElement) {
        this._emojiElement.style.opacity = '1';
        this._emojiElement.style.transform = 'translate(32px,-28px) scale(1.15) rotate(15deg)';
        setTimeout(() => {
          if (this._emojiElement) {
            this._emojiElement.style.transform = 'translate(32px,-28px) scale(1) rotate(15deg)';
            // Start floating animation only after entrance is complete
            this._emojiFloatTime = 0;
            if (!this._emojiFloatFrame) this._animateEmojiFloat();
          }
        }, 160);
      }
    }, 10);
  }

  hideEmoji(immediate = false) {
    if (!this._emojiElement) return;
    const emojiGroup = this._emojiElement;
    // Stop floating animation before exit
    cancelAnimationFrame(this._emojiFloatFrame);
    this._emojiFloatFrame = null;
    if (immediate) {
      emojiGroup.remove();
      this._emojiElement = null;
      this._emojiRemoving = false;
      return;
    }
    // Animate pop-out bounce: fade out, move down, shrink
    emojiGroup.style.transition = 'opacity 0.18s, transform 0.18s cubic-bezier(.34,1.56,.64,1)';
    emojiGroup.style.opacity = '0';
    emojiGroup.style.transform = 'translate(32px,10px) scale(0.5) rotate(15deg)';
    setTimeout(() => {
      if (emojiGroup.parentNode) emojiGroup.remove();
      this._emojiElement = null;
      this._emojiRemoving = false;
    }, 180);
  }

  _animateEmojiFloat() {
    if (!this._emojiElement) return;
    this._emojiFloatTime += 0.016;
    const floatY = Math.sin(this._emojiFloatTime * 2) * 4; // up/down
    // Only animate the group, not the initial pop-in
    this._emojiElement.style.transform = `translate(32px,${-28 + floatY}px) scale(1) rotate(15deg)`;
    this._emojiFloatFrame = requestAnimationFrame(() => this._animateEmojiFloat());
  }
}

export default PlayerCharacter; 