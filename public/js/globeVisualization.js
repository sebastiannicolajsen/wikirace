import { urlToTitle } from "/js/wikiHelper.js";
const THREE = window.THREE || globalThis.THREE;

class GlobeVisualization {
    constructor(container) {
        console.log('GlobeVisualization constructor called');
        this.container = container;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = null;
        this.globe = null;
        this.paths = new Map(); // Map to store player paths
        this.labels = new Map(); // Map to store path labels
        
        this.init();
    }

    init() {
        console.log('GlobeVisualization init called');
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0xf8f9fa);
        this.container.appendChild(this.renderer.domElement);
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.display = 'block';

        // Setup camera
        this.camera.position.z = 5;

        // Setup controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.rotateSpeed = 0.5;

        // Create globe
        this.createGlobe();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        window.addEventListener('orientationchange', () => this.onWindowResize());

        // Start animation loop
        this.animate();

        // Add a red border for debugging
        this.container.style.border = '3px solid red';
    }

    createGlobe() {
        // Generate a simple SVG puzzle grid as a data URL
        const svg = `
        <svg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 256 256'>
            <rect width='256' height='256' fill='white'/>
            <g stroke='#bbb' stroke-width='3' fill='none'>
                <path d='M0 64h256M0 128h256M0 192h256M64 0v256M128 0v256M192 0v256'/>
                <!-- Puzzle bumps (simple arcs for demo) -->
                <path d='M64 64q16-24 32 0' />
                <path d='M128 128q16-24 32 0' />
                <path d='M192 192q16-24 32 0' />
                <path d='M64 128q-16 24-32 0' />
                <path d='M128 192q-16 24-32 0' />
                <path d='M192 64q-16 24-32 0' />
            </g>
        </svg>`;
        const svgBase64 = btoa(svg);
        const texture = new THREE.TextureLoader().load('data:image/svg+xml;base64,' + svgBase64);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2); // Repeat the pattern

        // Create sphere geometry
        const geometry = new THREE.SphereGeometry(2, 64, 64);
        const material = new THREE.MeshPhongMaterial({
            color: 0xfafafa,
            map: texture,
            transparent: false,
            opacity: 1.0,
            shininess: 30
        });
        this.globe = new THREE.Mesh(geometry, material);
        this.scene.add(this.globe);

        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        // Add directional light attached to the camera
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        // Place the light behind and to the right of the camera
        this.directionalLight.position.set(3, 1, -5);
        this.camera.add(this.directionalLight);
        this.scene.add(this.camera); // Add camera (with light) to the scene
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    // Convert lat/long to 3D coordinates on the sphere
    latLongToVector3(lat, lon, radius) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        const x = -(radius * Math.sin(phi) * Math.cos(theta));
        const z = (radius * Math.sin(phi) * Math.sin(theta));
        const y = (radius * Math.cos(phi));
        return new THREE.Vector3(x, y, z);
    }

    // Add a path for a player
    addPlayerPath(playerName, path, color, playerIndex = 0, totalPlayers = 1) {
        if (this.paths.has(playerName)) {
            this.removePlayerPath(playerName);
        }

        const curvePoints = [];
        const nodeMeshes = [];
        const labels = [];
        // Assign a unique latitude offset for each player
        const baseLat = (playerIndex - (totalPlayers - 1) / 2) * 10; // e.g., -10, 0, 10 for 3 players
        const step = 360 / Math.max(path.length, 2); // Spread nodes evenly around the globe
        for (let i = 0; i < path.length; i++) {
            const lat = baseLat;
            const lon = i * step;
            const nodePos = this.latLongToVector3(lat, lon, 2.13);
            curvePoints.push(nodePos);
        }
        // Draw the curved path
        const pathGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
        const pathMaterial = new THREE.LineBasicMaterial({ color: color, depthTest: false });
        const pathLine = new THREE.Line(pathGeometry, pathMaterial);
        this.scene.add(pathLine);
        this.paths.set(playerName, pathLine);

        // Add node spheres and labels
        for (let i = 0; i < path.length; i++) {
            const nodePos = curvePoints[i];
            const nodeGeometry = new THREE.SphereGeometry(0.045, 16, 16);
            const nodeMaterial = new THREE.MeshBasicMaterial({ color: color });
            const nodeMesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
            nodeMesh.position.copy(nodePos);
            this.scene.add(nodeMesh);
            nodeMeshes.push(nodeMesh);

            // Add label above each node
            const label = document.createElement('div');
            label.className = 'path-label';
            label.innerHTML = urlToTitle(path[i].url);
            this.container.appendChild(label);
            // Offset label position slightly above the node
            const labelPos = nodePos.clone().add(nodePos.clone().normalize().multiplyScalar(0.12));
            this.labels.set(`${playerName}-label-${i}`, { element: label, position: labelPos });
        }
    }

    removePlayerPath(playerName) {
        const path = this.paths.get(playerName);
        if (path) {
            this.scene.remove(path);
            this.paths.delete(playerName);
        }

        // Remove labels
        for (const [key, label] of this.labels.entries()) {
            if (key.startsWith(playerName)) {
                this.container.removeChild(label.element);
                this.labels.delete(key);
            }
        }
    }

    updateLabels() {
        for (const [key, label] of this.labels.entries()) {
            const position = label.position.clone();
            position.project(this.camera);
            
            const x = (position.x * 0.5 + 0.5) * this.container.clientWidth;
            const y = (-(position.y * 0.5) + 0.5) * this.container.clientHeight;
            
            label.element.style.transform = `translate(-50%, -50%) translate(${x}px,${y}px)`;
            label.element.style.display = position.z < 1 ? 'block' : 'none';
        }
    }
}

// Export the class
export default GlobeVisualization; 