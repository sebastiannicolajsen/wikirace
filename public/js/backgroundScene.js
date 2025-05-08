class BackgroundScene {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.shapes = [];
        this.isTransitioning = false;
        this.init();
    }

    init() {
        // Set canvas size to match window size
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Create initial shapes
        this.createShapes();

        // Start animation
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        // Recreate shapes on resize to maintain good distribution
        this.shapes = [];
        this.createShapes();
    }

    createShapes() {
        const numShapes = 50; // More shapes
        const colors = ['#8B4513', '#A0522D', '#CD853F', '#DEB887', '#D2691E', '#B8860B'];
        const outlineColors = ['#5D2E0C', '#6B3A1D', '#8B5A2B', '#B8860B', '#8B4513', '#A0522D'];

        // Create random positions across the entire screen
        const spawnPoints = [];
        for (let i = 0; i < numShapes; i++) {
            spawnPoints.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height
            });
        }

        for (let i = 0; i < numShapes; i++) {
            const spawnPoint = spawnPoints[i];
            const x = spawnPoint.x;
            const y = spawnPoint.y;

            // More size variation
            const sizeCategory = Math.random();
            let size;
            if (sizeCategory < 0.3) { // 30% tiny shapes
                size = Math.random() * 8 + 3;
            } else if (sizeCategory < 0.6) { // 30% small shapes
                size = Math.random() * 15 + 8;
            } else if (sizeCategory < 0.85) { // 25% medium shapes
                size = Math.random() * 40 + 20;
            } else { // 15% large shapes
                size = Math.random() * 80 + 50;
            }

            const boundarySize = Math.min(this.canvas.width, this.canvas.height) * 0.1; // Smaller boundary for more random movement
            const centerX = x;
            const centerY = y;

            // More shape types
            const shapeType = Math.random();
            let type;
            if (shapeType < 0.2) type = 'circle';
            else if (shapeType < 0.4) type = 'square';
            else if (shapeType < 0.6) type = 'triangle';
            else if (shapeType < 0.75) type = 'star';
            else if (shapeType < 0.9) type = 'hexagon';
            else type = 'diamond';

            const shape = {
                type: type,
                x: x,
                y: y,
                size: size,
                centerX: centerX,
                centerY: centerY,
                boundarySize: boundarySize,
                speedX: (Math.random() - 0.5) * 0.008,
                speedY: (Math.random() - 0.5) * 0.008,
                rotationSpeed: (Math.random() - 0.5) * 0.0002,
                angle: Math.random() * Math.PI * 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                outlineColor: outlineColors[Math.floor(Math.random() * outlineColors.length)],
                opacity: Math.random() * 0.2 + 0.03,
                wobbleSpeed: Math.random() * 0.0002 + 0.0001,
                wobbleAmount: Math.random() * 0.2 + 0.05,
                lastDirectionChange: 0,
                directionChangeInterval: Math.random() * 8000 + 5000,
                gravity: 0,
                isFalling: false
            };
            this.shapes.push(shape);
        }
    }

    drawShape(shape) {
        this.ctx.save();
        this.ctx.globalAlpha = shape.opacity;
        
        this.ctx.strokeStyle = shape.outlineColor;
        this.ctx.lineWidth = Math.max(1, shape.size / 20);
        
        this.ctx.fillStyle = shape.color;

        switch (shape.type) {
            case 'circle':
                this.ctx.beginPath();
                this.ctx.arc(shape.x, shape.y, shape.size / 2, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
                break;
            case 'square':
                this.ctx.save();
                this.ctx.translate(shape.x, shape.y);
                this.ctx.rotate(shape.angle);
                this.ctx.fillRect(-shape.size / 2, -shape.size / 2, shape.size, shape.size);
                this.ctx.strokeRect(-shape.size / 2, -shape.size / 2, shape.size, shape.size);
                this.ctx.restore();
                break;
            case 'triangle':
                this.ctx.save();
                this.ctx.translate(shape.x, shape.y);
                this.ctx.rotate(shape.angle);
                this.ctx.beginPath();
                this.ctx.moveTo(0, -shape.size / 2);
                this.ctx.lineTo(shape.size / 2, shape.size / 2);
                this.ctx.lineTo(-shape.size / 2, shape.size / 2);
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
                this.ctx.restore();
                break;
            case 'star':
                this.ctx.save();
                this.ctx.translate(shape.x, shape.y);
                this.ctx.rotate(shape.angle);
                this.ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                    const x = Math.cos(angle) * shape.size / 2;
                    const y = Math.sin(angle) * shape.size / 2;
                    if (i === 0) this.ctx.moveTo(x, y);
                    else this.ctx.lineTo(x, y);
                }
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
                this.ctx.restore();
                break;
            case 'hexagon':
                this.ctx.save();
                this.ctx.translate(shape.x, shape.y);
                this.ctx.rotate(shape.angle);
                this.ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (i * 2 * Math.PI) / 6;
                    const x = Math.cos(angle) * shape.size / 2;
                    const y = Math.sin(angle) * shape.size / 2;
                    if (i === 0) this.ctx.moveTo(x, y);
                    else this.ctx.lineTo(x, y);
                }
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
                this.ctx.restore();
                break;
            case 'diamond':
                this.ctx.save();
                this.ctx.translate(shape.x, shape.y);
                this.ctx.rotate(shape.angle);
                this.ctx.beginPath();
                this.ctx.moveTo(0, -shape.size / 2);
                this.ctx.lineTo(shape.size / 2, 0);
                this.ctx.lineTo(0, shape.size / 2);
                this.ctx.lineTo(-shape.size / 2, 0);
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
                this.ctx.restore();
                break;
        }
        this.ctx.restore();
    }

    updateShapes() {
        const now = Date.now();
        this.shapes.forEach(shape => {
            if (shape.isFalling) {
                // Falling movement
                shape.speedY += shape.gravity;
                shape.y += shape.speedY;
                shape.x += shape.speedX;
                shape.angle += shape.rotationSpeed;

                if (shape.isFallingOut) {
                    // Keep falling until out of screen
                    if (shape.y > this.canvas.height + shape.size) {
                        shape.isFalling = false;
                    }
                } else {
                    // Check if shape has reached its target position
                    if (shape.y >= shape.centerY) {
                        shape.y = shape.centerY;
                        shape.x = shape.centerX;
                        shape.speedY = 0;
                        shape.speedX = (Math.random() - 0.5) * 0.008;
                        shape.rotationSpeed = (Math.random() - 0.5) * 0.0002;
                        shape.gravity = 0;
                        shape.isFalling = false;
                    }
                }
            } else if (!this.isTransitioning) {
                // Normal movement within boundaries
                shape.x += shape.speedX;
                shape.y += shape.speedY;
                shape.angle += shape.rotationSpeed;

                shape.x += Math.sin(now * shape.wobbleSpeed) * shape.wobbleAmount;
                shape.y += Math.cos(now * shape.wobbleSpeed) * shape.wobbleAmount;

                const dx = shape.x - shape.centerX;
                const dy = shape.y - shape.centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > shape.boundarySize) {
                    const angle = Math.atan2(dy, dx);
                    shape.x = shape.centerX + Math.cos(angle) * shape.boundarySize;
                    shape.y = shape.centerY + Math.sin(angle) * shape.boundarySize;
                    shape.speedX = -shape.speedX;
                    shape.speedY = -shape.speedY;
                }

                if (now - shape.lastDirectionChange > shape.directionChangeInterval) {
                    shape.speedX = (Math.random() - 0.5) * 0.008;
                    shape.speedY = (Math.random() - 0.5) * 0.008;
                    shape.lastDirectionChange = now;
                    shape.directionChangeInterval = Math.random() * 8000 + 5000;
                }
            }
        });
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#F5DEB3');
        gradient.addColorStop(1, '#DEB887');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.updateShapes();
        this.shapes.forEach(shape => this.drawShape(shape));

        requestAnimationFrame(() => this.animate());
    }

    // Add new transition method
    startTransition() {
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        // Make all shapes fall out from their current positions
        this.shapes.forEach(shape => {
            shape.speedY = 0;
            shape.speedX = (Math.random() - 0.5) * 0.5;
            shape.rotationSpeed = (Math.random() - 0.5) * 0.02;
            shape.gravity = 0.5;
            shape.isFalling = true;
            shape.isFallingOut = true; // Mark as falling out
        });

        // Wait for shapes to fall out before creating new ones
        const checkFallenOut = () => {
            const allFallenOut = this.shapes.every(shape => shape.y > this.canvas.height + shape.size);
            if (allFallenOut) {
                // Now create new shapes
                this.shapes = [];
                
                // Create new shapes with random positions
                const numShapes = 50;
                const colors = ['#8B4513', '#A0522D', '#CD853F', '#DEB887', '#D2691E', '#B8860B'];
                const outlineColors = ['#5D2E0C', '#6B3A1D', '#8B5A2B', '#B8860B', '#8B4513', '#A0522D'];

                for (let i = 0; i < numShapes; i++) {
                    // Random position across the screen
                    const x = Math.random() * this.canvas.width;
                    const y = Math.random() * this.canvas.height;

                    // Size variation
                    const sizeCategory = Math.random();
                    let size;
                    if (sizeCategory < 0.3) size = Math.random() * 8 + 3;
                    else if (sizeCategory < 0.6) size = Math.random() * 15 + 8;
                    else if (sizeCategory < 0.85) size = Math.random() * 40 + 20;
                    else size = Math.random() * 80 + 50;

                    // Shape type
                    const shapeType = Math.random();
                    let type;
                    if (shapeType < 0.2) type = 'circle';
                    else if (shapeType < 0.4) type = 'square';
                    else if (shapeType < 0.6) type = 'triangle';
                    else if (shapeType < 0.75) type = 'star';
                    else if (shapeType < 0.9) type = 'hexagon';
                    else type = 'diamond';

                    const shape = {
                        type: type,
                        x: x,
                        y: -size - Math.random() * 200, // Start well above the canvas
                        size: size,
                        centerX: x, // Target position
                        centerY: y, // Target position
                        boundarySize: Math.min(this.canvas.width, this.canvas.height) * 0.1,
                        speedX: 0,
                        speedY: 0,
                        rotationSpeed: (Math.random() - 0.5) * 0.0002,
                        angle: Math.random() * Math.PI * 2,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        outlineColor: outlineColors[Math.floor(Math.random() * outlineColors.length)],
                        opacity: Math.random() * 0.2 + 0.03,
                        wobbleSpeed: Math.random() * 0.0002 + 0.0001,
                        wobbleAmount: Math.random() * 0.2 + 0.05,
                        lastDirectionChange: Date.now(),
                        directionChangeInterval: Math.random() * 8000 + 5000,
                        gravity: 0.3,
                        isFalling: true,
                        isFallingOut: false
                    };
                    this.shapes.push(shape);
                }

                // Check if all shapes have settled
                const checkSettled = () => {
                    if (this.shapes.every(s => !s.isFalling)) {
                        this.isTransitioning = false;
                    } else {
                        requestAnimationFrame(checkSettled);
                    }
                };
                
                requestAnimationFrame(checkSettled);
            } else {
                requestAnimationFrame(checkFallenOut);
            }
        };

        requestAnimationFrame(checkFallenOut);
    }
}

// Export the class
window.BackgroundScene = BackgroundScene; 