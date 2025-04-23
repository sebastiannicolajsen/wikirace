// WebSocket connection configuration
let ws = null;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000; // 2 seconds

// Environment configuration
let isProduction = false;
let serverPort = null;

// Fetch environment configuration
async function fetchConfig() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        isProduction = config.isProduction;
        serverPort = config.port || serverPort;
        console.log('Environment config:', { isProduction, serverPort });
    } catch (error) {
        console.error('Error fetching config:', error);
    }
}

// Connect to WebSocket
async function connectToRoom(roomId, playerName, role, messageHandler) {
    await fetchConfig(); // Ensure we have the latest config
    console.log('Connecting to room:', roomId, 'as player:', playerName, 'with role:', role);
    
    // Determine WebSocket protocol and port based on environment
    const protocol = isProduction ? 'wss:' : 'ws:';
    const port = isProduction ? '' : `:${serverPort}`;
    const wsUrl = `${protocol}//${window.location.host}/game/${roomId.toUpperCase()}`;
    console.log('Connecting to WebSocket URL:', wsUrl);
    
    ws = new WebSocket(wsUrl);
    window.WebSocketManager.ws = ws; // Set the WebSocket instance in the manager

    ws.onopen = () => {
        console.log('WebSocket connection established');
        window.WebSocketManager.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        // Send join message immediately
        const joinMessage = { 
            type: 'join',
            playerName: playerName,
            role: role || 'player' // Default to player if role not specified
        };
        console.log('Sending join message:', joinMessage);
        ws.send(JSON.stringify(joinMessage));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        messageHandler(data);
    };

    ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        
        // Only attempt to reconnect if we haven't exceeded max attempts
        if (window.WebSocketManager.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            window.WebSocketManager.reconnectAttempts++;
            console.log(`Attempting to reconnect (${window.WebSocketManager.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
            
            // Show reconnecting message to user
            const waitingScreen = document.getElementById('waitingScreen');
            if (waitingScreen) {
                waitingScreen.innerHTML = `
                    <div class="text-center">
                        <h2 class="text-2xl font-bold mb-4">Connection Lost</h2>
                        <p class="text-gray-600 mb-4">Attempting to reconnect (${window.WebSocketManager.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...</p>
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                    </div>
                `;
                waitingScreen.style.display = 'flex';
            }
            
            // Attempt to reconnect after delay
            setTimeout(() => {
                connectToRoom(roomId, playerName, role, messageHandler);
            }, RECONNECT_DELAY);
        } else {
            console.log('Max reconnection attempts reached');
            // Show error message to user
            const waitingScreen = document.getElementById('waitingScreen');
            if (waitingScreen) {
                waitingScreen.innerHTML = `
                    <div class="text-center">
                        <h2 class="text-2xl font-bold mb-4 text-red-600">Connection Lost</h2>
                        <p class="text-gray-600 mb-4">Unable to reconnect to the game server.</p>
                        <button onclick="window.location.href='/'" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                            Return to Home
                        </button>
                    </div>
                `;
                waitingScreen.style.display = 'flex';
            }
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Send message through WebSocket
function sendMessage(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('Sending message:', message);
        ws.send(JSON.stringify(message));
    } else {
        console.error('WebSocket is not open');
    }
}

// Export the functions
window.WebSocketManager = {
    connectToRoom,
    sendMessage,
    ws: null, // Expose the WebSocket instance
    reconnectAttempts: 0 // Track reconnection attempts
}; 