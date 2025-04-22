var express = require("express");
var app = express();
var expressWs = require("express-ws")(app);
var uuid4 = require("uuid4");
var path = require("path");
const axios = require('axios');
const db = require('./db');

const rooms = {};
const roomCleanupTimers = new Map();

// Get port from environment variable or use 3000 for local development
const port = process.env.PORT || 3000;
const isProduction = process.env.PRODUCTION === 'true';

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// Add environment configuration endpoint
app.get('/api/config', (req, res) => {
    res.json({
        isProduction: isProduction,
        port: port
    });
});

const newRoom = (name, startUrl, endUrl, creatorName, countdownTime = 30) => {
    const id = uuid4().substring(0, 4).toUpperCase();
    const object = {
        id, 
        name,
        startUrl,
        endUrl,
        creator: creatorName,
        players: new Map(),
        observers: new Map(),
        createdAt: new Date().toISOString(),
        state: 'waiting',
        currentPlayer: null,
        currentUrl: startUrl,
        playerStates: new Map(),
        playerPaths: new Map(),
        randomSelections: new Map(),
        playersNeedingRandomSelection: new Set(),
        turnTimer: null,
        turnEndTime: null,
        waitingForPlayers: new Set(),
        currentPageLinks: [],
        countdownTime: parseInt(countdownTime) || 30,
        timerExpired: false
    };
    rooms[id] = object;
    return id;
};

// Helper function to validate Wikipedia URLs
function isValidWikipediaUrl(url) {
  return url.startsWith('https://en.wikipedia.org/wiki/') && 
         !url.includes('Special:') && 
         !url.includes('File:') && 
         !url.includes('Help:') &&
         !url.includes('Template:') &&
         !url.includes('Category:') &&
         !url.includes('Portal:') &&
         !url.includes('Wikipedia:');
}

// Helper function to check if game is over
function checkGameOver(room, playerName, newUrl) {
  if (newUrl === room.endUrl) {
    room.state = 'finished';
    return true;
  }
  return false;
}

// Helper function to start next turn
function startNextTurn(room) {
  const players = Array.from(room.players.keys());
  const currentIndex = players.indexOf(room.currentPlayer);
  const nextIndex = (currentIndex + 1) % players.length;
  room.currentPlayer = players[nextIndex];
  room.turnEndTime = Date.now() + 30000; // 30 seconds from now

  // Notify all players about the turn change
  broadcastToRoom(room, {
    type: 'turn_started',
    currentPlayer: room.currentPlayer,
    endTime: room.turnEndTime
  });

  // Set timer to automatically end turn
  room.turnTimer = setTimeout(() => {
    if (room.state === 'playing') {
      startNextTurn(room);
    }
  }, 30000);
}

// Get random Wikipedia links
app.get("/api/random-pair", async (req, res) => {
    console.log('Received request for random pair');
    try {
        const pair = await db.getRandomPair();
        console.log('Retrieved random pair:', pair);
        
        if (!pair || !pair.start || !pair.end) {
            console.error('Invalid pair retrieved from database:', pair);
            throw new Error('Failed to get valid random pair');
        }
        
        res.json(pair);
    } catch (error) {
        console.error('Error getting random pair:', error);
        res.status(500).json({ error: 'Failed to get random pair' });
    }
});

// Add proxy endpoint for Wikipedia content
app.get("/api/wiki-content", async (req, res) => {
    const url = req.query.url;
    
    if (!url || !url.startsWith('https://en.wikipedia.org/')) {
        console.error('Invalid Wikipedia URL:', url);
        return res.status(400).json({ error: "Invalid Wikipedia URL" });
    }

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'WikiRace Game/1.0',
                'Accept': 'text/html'
            }
        });

        let html = response.data;
        
        // Fix image URLs to use Wikipedia domain
        html = html.replace(/src="\/\//g, 'src="https://');
        html = html.replace(/src="\//g, 'src="https://en.wikipedia.org/');
        html = html.replace(/srcset="\/\//g, 'srcset="https://');
        html = html.replace(/srcset="\//g, 'srcset="https://en.wikipedia.org/');
        
        // Create a simplified version with our own styling
        const simplifiedContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <base href="https://en.wikipedia.org/">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        line-height: 1.6;
                        color: #202122;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    h1 {
                        font-size: 2em;
                        margin-bottom: 0.5em;
                        padding-bottom: 0.17em;
                        border-bottom: 1px solid #a2a9b1;
                    }
                    h2 {
                        font-size: 1.5em;
                        margin: 1em 0 0.5em;
                        padding-bottom: 0.17em;
                        border-bottom: 1px solid #a2a9b1;
                    }
                    p {
                        margin: 0.5em 0;
                    }
                    a {
                        color: #0645ad;
                        text-decoration: none;
                    }
                    a:hover {
                        text-decoration: underline;
                    }
                    ul, ol {
                        margin: 0.5em 0;
                        padding-left: 2em;
                    }
                    li {
                        margin: 0.3em 0;
                    }
                    img {
                        max-width: 100%;
                        height: auto;
                    }
                    table {
                        border-collapse: collapse;
                        margin: 1em 0;
                    }
                    th, td {
                        border: 1px solid #a2a9b1;
                        padding: 0.5em;
                    }
                    th {
                        background-color: #f8f9fa;
                    }
                </style>
            </head>
            <body>
                ${html}
            </body>
            </html>
        `;
        
        // Send the simplified content
        res.send(simplifiedContent);
        
    } catch (error) {
        console.error('Error fetching Wikipedia content:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
        }
        res.status(500).json({ error: "Failed to fetch Wikipedia content" });
    }
});

// Create a new room
app.post("/create", function (req, res) {
    const { name, startUrl, endUrl, playerName, countdownTime, role } = req.body;

    if (!name || !playerName) {
        return res.status(400).json({ error: "Room name and player name are required" });
    }

    // Validate URLs if provided
    if (startUrl && !isValidWikipediaUrl(startUrl)) {
        return res.status(400).json({ error: "Invalid start URL" });
    }
    if (endUrl && !isValidWikipediaUrl(endUrl)) {
        return res.status(400).json({ error: "Invalid end URL" });
    }

    // Validate countdown time
    const countdownSeconds = parseInt(countdownTime) || 30;
    if (countdownSeconds < 5 || countdownSeconds > 35) {
        return res.status(400).json({ error: "Countdown time must be between 5 and 35 seconds" });
    }

    const roomId = newRoom(name, startUrl, endUrl, playerName, countdownSeconds);
    const room = rooms[roomId];
    
    // Add creator to the room based on their role
    if (role === 'observer') {
        room.observers.set(playerName, null); // WebSocket will be set when they connect
    } else {
        room.players.set(playerName, null); // WebSocket will be set when they connect
    }
    
    res.json({ 
        id: roomId,
        playerName,
        role,
        room: {
            ...room,
            players: Array.from(room.players.keys()),
            observers: Array.from(room.observers.keys())
        }
    });
});

// WebSocket connection for game room
app.ws("/game/:roomId", function (ws, req) {
    const roomId = req.params.roomId.toUpperCase();
    console.log('Looking up room:', roomId);
    console.log('Available rooms:', Object.keys(rooms));
    const room = rooms[roomId];
    let playerName = null;
    let isObserver = false;

    if (!room) {
        console.log(`Room ${roomId} not found`);
        ws.close(1000, "Room not found");
        return;
    }

    // Handle initial connection
    ws.once("message", function (msg) {
        try {
            const data = JSON.parse(msg);
            console.log('Received join message:', data);
            
            // Validate join message format
            if (!data || typeof data !== 'object') {
                console.log('Invalid message format:', data);
                ws.close(1000, "Invalid message format");
                return;
            }

            // Check for playerName in either format
            playerName = data.playerName || (data.type === 'join' ? data.playerName : null);
            isObserver = data.role === 'observer';

            if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') {
                console.log('Invalid player name:', playerName);
                ws.send(JSON.stringify({ 
                    type: 'error', 
                    message: 'Valid player name is required' 
                }));
                ws.close(1000, "Valid player name is required");
                return;
            }

            // Check if player is already in the room
            if (room.players.has(playerName) || room.observers.has(playerName)) {
                const existingWs = room.players.get(playerName) || room.observers.get(playerName);
                console.log(`Player ${playerName} exists in room ${roomId}, existing WebSocket state:`, existingWs ? existingWs.readyState : 'null');
                
                // If the player exists but has no WebSocket or the WebSocket is not open, allow reconnection
                if (!existingWs || existingWs.readyState !== 1) {
                    if (isObserver) {
                        room.observers.set(playerName, ws);
                    } else {
                        room.players.set(playerName, ws);
                    }
                    console.log(`Player ${playerName} reconnected to room ${roomId} as ${isObserver ? 'observer' : 'player'}`);
                    
                    // If game is in progress, send current game state
                    if (room.state === 'playing') {
                        console.log(`Game is in progress, sending current state to reconnected ${isObserver ? 'observer' : 'player'} ${playerName}`);
                        const gameState = {
                            type: 'game_started',
                            room: {
                                id: room.id,
                                name: room.name,
                                startUrl: room.startUrl,
                                endUrl: room.endUrl,
                                players: Array.from(room.players.keys()),
                                observers: Array.from(room.observers.keys()),
                                state: room.state,
                                creator: room.creator,
                                currentUrl: room.currentUrl,
                                playerStates: Object.fromEntries(room.playerStates),
                                playerPaths: Object.fromEntries(room.playerPaths),
                                countdownTime: room.countdownTime
                            },
                            currentUrl: room.currentUrl,
                            endTime: room.turnEndTime,
                            isObserver: isObserver
                        };
                        console.log('Sending current game state to reconnected user:', gameState);
                        ws.send(JSON.stringify(gameState));
                    }
                } else {
                    console.log(`Player name ${playerName} already taken in room ${roomId} (WebSocket is still open)`);
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: 'Player name already taken' 
                    }));
                    ws.close(1000, "Player name already taken");
                    return;
                }
            } else {
                // New player joining
                if (isObserver) {
                    room.observers.set(playerName, ws);
                } else {
                    room.players.set(playerName, ws);
                }
                console.log(`New ${isObserver ? 'observer' : 'player'} ${playerName} joined room ${roomId}`);
            }
            
            // Clear any existing cleanup timer when someone connects
            if (roomCleanupTimers.has(roomId)) {
                console.log(`Clearing cleanup timer for room ${roomId} as player connected`);
                clearTimeout(roomCleanupTimers.get(roomId));
                roomCleanupTimers.delete(roomId);
            }
            
            // Send room info to the new player
            const roomInfo = {
                type: 'room_info',
                room: {
                    id: room.id,
                    name: room.name,
                    startUrl: room.startUrl,
                    endUrl: room.endUrl,
                    players: Array.from(room.players.keys()),
                    observers: Array.from(room.observers.keys()),
                    state: room.state,
                    creator: room.creator,
                    currentUrl: room.currentUrl,
                    playerStates: Object.fromEntries(room.playerStates),
                    playerPaths: Object.fromEntries(room.playerPaths),
                    randomSelections: Object.fromEntries(room.randomSelections),
                    countdownTime: room.countdownTime
                },
                playerName: playerName,
                isObserver: isObserver
            };
            console.log('Sending room info:', roomInfo);
            ws.send(JSON.stringify(roomInfo));
            
            // If game is already in progress, send game state immediately
            if (room.state === 'playing') {
                const gameState = {
                    type: 'game_started',
                    room: {
                        id: room.id,
                        name: room.name,
                        startUrl: room.startUrl,
                        endUrl: room.endUrl,
                        players: Array.from(room.players.keys()),
                        observers: Array.from(room.observers.keys()),
                        state: room.state,
                        creator: room.creator,
                        currentUrl: room.currentUrl,
                        playerStates: Object.fromEntries(room.playerStates),
                        playerPaths: Object.fromEntries(room.playerPaths),
                        countdownTime: room.countdownTime
                    },
                    currentUrl: room.currentUrl,
                    endTime: room.turnEndTime,
                    isObserver: isObserver
                };
                console.log('Sending game state to user:', gameState);
                ws.send(JSON.stringify(gameState));
            }
            
            // Broadcast player joined to all players
            const joinMessage = {
                type: 'player_joined',
                playerName: playerName,
                players: Array.from(room.players.keys()),
                observers: Array.from(room.observers.keys()),
                room: {  // Add room info to ensure clients have latest state
                    id: room.id,
                    name: room.name,
                    startUrl: room.startUrl,
                    endUrl: room.endUrl,
                    players: Array.from(room.players.keys()),
                    observers: Array.from(room.observers.keys()),
                    state: room.state,
                    creator: room.creator,
                    currentUrl: room.currentUrl,
                    playerStates: Object.fromEntries(room.playerStates),
                    playerPaths: Object.fromEntries(room.playerPaths),
                    countdownTime: room.countdownTime
                }
            };
            console.log('Broadcasting player joined:', joinMessage);
            broadcastToRoom(room, joinMessage, ws);

            // Set up message handler for subsequent messages
            ws.on("message", function (msg) {
                try {
                    const data = JSON.parse(msg);
                    console.log('Received message:', data);
                    
                    if (!data || typeof data !== 'object') {
                        return;
                    }

                    switch (data.type) {
                        case 'start_game':
                            if (playerName === room.creator) {
                                console.log(`Starting game in room ${roomId}`);
                                room.state = 'playing';
                                room.currentUrl = room.startUrl;
                                room.waitingForPlayers = new Set();
                                
                                // Initialize all player states to start URL (excluding observers)
                                for (const [playerName, playerWs] of room.players) {
                                    room.playerStates.set(playerName, room.startUrl);
                                    room.playerPaths.set(playerName, [room.startUrl]); // Initialize path with start URL
                                }
                                
                                // Don't set turn end time here - it will be set when first player selects a link
                                room.turnEndTime = null;
                                
                                // Broadcast game start to all players
                                const gameStartMessage = {
                                    type: 'game_started',
                                    roomId: room.id,
                                    name: room.name,
                                    startUrl: room.startUrl,
                                    endUrl: room.endUrl,
                                    players: Array.from(room.players.keys()),
                                    observers: Array.from(room.observers.keys()),
                                    state: room.state,
                                    creator: room.creator,
                                    currentUrl: room.startUrl,
                                    playerStates: Object.fromEntries(room.playerStates),
                                    playerPaths: Object.fromEntries(room.playerPaths),
                                    randomSelections: Object.fromEntries(room.randomSelections),
                                    countdownTime: room.countdownTime
                                };
                                
                                console.log('Broadcasting game start message:', gameStartMessage);
                                broadcastToRoom(room, gameStartMessage);
                            } else {
                                console.log(`Player ${playerName} tried to start game but is not the creator`);
                                ws.send(JSON.stringify({
                                    type: 'error',
                                    message: 'Only the room creator can start the game'
                                }));
                            }
                            break;

                        case 'page_change':
                            if (room.state === 'playing' && !isObserver) {
                                const newUrl = data.url;
                                if (isValidWikipediaUrl(newUrl)) {
                                    console.log(`Player ${playerName} selected page: ${newUrl}`);
                                    // Add player to waiting list
                                    room.waitingForPlayers.add(playerName);
                                    room.playerStates.set(playerName, newUrl);
                                    
                                    // Update player's path
                                    if (!room.playerPaths.has(playerName)) {
                                        room.playerPaths.set(playerName, []);
                                    }
                                    room.playerPaths.get(playerName).push(newUrl);
                                    
                                    // Check if this was a random selection
                                    if (room.playersNeedingRandomSelection.has(playerName)) {
                                        console.log(`Marking ${playerName}'s selection as random:`, newUrl);
                                        room.randomSelections.set(playerName, newUrl);
                                        room.playersNeedingRandomSelection.delete(playerName);
                                    }
                                    
                                    // If this is the first player to select, start the countdown
                                    if (room.waitingForPlayers.size === 1) {
                                        room.turnEndTime = Date.now() + (room.countdownTime * 1000);
                                        // Start turn timer
                                        if (room.turnTimer) {
                                            clearTimeout(room.turnTimer);
                                        }
                                        room.turnTimer = setTimeout(() => {
                                            if (room.state === 'playing') {
                                                room.timerExpired = true;
                                                // Add players who didn't select to playersNeedingRandomSelection
                                                room.players.forEach((ws, player) => {
                                                    if (!room.waitingForPlayers.has(player)) {
                                                        room.playersNeedingRandomSelection.add(player);
                                                    }
                                                });
                                                console.log('Players needing random selection:', Array.from(room.playersNeedingRandomSelection));
                                                // Send a message to all players that timer expired
                                                const randomSelectionsObj = Object.fromEntries(room.randomSelections);
                                                console.log('Sending random selections:', randomSelectionsObj);
                                                broadcastToRoom(room, {
                                                    type: 'timer_expired',
                                                    waitingPlayers: Array.from(room.players.keys()).filter(p => !room.waitingForPlayers.has(p)),
                                                    timerExpired: true,
                                                    randomSelections: randomSelectionsObj
                                                });
                                            }
                                        }, room.countdownTime * 1000);
                                    }
                                    
                                    // Check if all players have selected (excluding observers)
                                    const allSelected = room.waitingForPlayers.size === room.players.size;
                                    console.log('All players selected:', allSelected, 'Waiting players:', Array.from(room.waitingForPlayers), 'Total players:', room.players.size);
                                    
                                    if (allSelected) {
                                        // Clear the timer since everyone has selected
                                        if (room.turnTimer) {
                                            clearTimeout(room.turnTimer);
                                            room.turnTimer = null;
                                        }
                                        room.turnEndTime = null;
                                        room.timerExpired = false;
                                        
                                        // First send update that all have selected
                                        const updateMessage = {
                                            type: 'page_update',
                                            room: {
                                                id: room.id,
                                                name: room.name,
                                                startUrl: room.startUrl,
                                                endUrl: room.endUrl,
                                                players: Array.from(room.players.keys()),
                                                observers: Array.from(room.observers.keys()),
                                                state: room.state,
                                                creator: room.creator,
                                                currentUrl: room.currentUrl,
                                                playerStates: Object.fromEntries(room.playerStates),
                                                playerPaths: Object.fromEntries(room.playerPaths),
                                                randomSelections: Object.fromEntries(room.randomSelections)
                                            },
                                            allPlayersSelected: true,
                                            waitingPlayers: [],
                                            endTime: null,
                                            countdownTime: room.countdownTime
                                        };
                                        console.log('Sending page update with random selections:', updateMessage.room.randomSelections);
                                        broadcastToRoom(room, updateMessage);
                                        
                                        // Then process turn end
                                        processTurnEnd(room);
                                    } else {
                                        // Not all players have selected yet, send regular update
                                        const updateMessage = {
                                            type: 'page_update',
                                            room: {
                                                id: room.id,
                                                name: room.name,
                                                startUrl: room.startUrl,
                                                endUrl: room.endUrl,
                                                players: Array.from(room.players.keys()),
                                                observers: Array.from(room.observers.keys()),
                                                state: room.state,
                                                creator: room.creator,
                                                currentUrl: room.currentUrl,
                                                playerStates: Object.fromEntries(room.playerStates),
                                                playerPaths: Object.fromEntries(room.playerPaths),
                                                randomSelections: Object.fromEntries(room.randomSelections)
                                            },
                                            allPlayersSelected: false,
                                            waitingPlayers: Array.from(room.waitingForPlayers),
                                            endTime: room.turnEndTime,
                                            countdownTime: room.countdownTime
                                        };
                                        console.log('Sending page update with random selections:', updateMessage.room.randomSelections);
                                        broadcastToRoom(room, updateMessage);
                                    }
                                }
                            }
                            break;
                    }
                } catch (error) {
                    console.error("Error processing message:", error);
                }
            });

            // Handle WebSocket close
            ws.on("close", function() {
                console.log(`WebSocket closed for ${isObserver ? 'observer' : 'player'} ${playerName} in room ${roomId}`);
                if (playerName) {
                    // Only remove the player if the game hasn't started
                    if (room.state === 'waiting') {
                        console.log(`Game hasn't started, removing ${isObserver ? 'observer' : 'player'} ${playerName} from room ${roomId}`);
                        if (isObserver) {
                            room.observers.delete(playerName);
                        } else {
                            room.players.delete(playerName);
                            room.playerStates.delete(playerName);
                            room.playerPaths.delete(playerName);
                            room.waitingForPlayers.delete(playerName);
                        }
                        
                        // If the creator leaves, shut down the game
                        if (playerName === room.creator) {
                            console.log(`Creator ${playerName} left room ${roomId}, shutting down game`);
                            broadcastToRoom(room, {
                                type: "room_closed",
                                message: "The creator has left the room. The game has been closed."
                            });
                            
                            // Close all other player connections
                            room.players.forEach((playerWs, name) => {
                                if (name !== playerName) {
                                    playerWs.close(1000, "Room closed by creator");
                                }
                            });
                            room.observers.forEach((observerWs, name) => {
                                if (name !== playerName) {
                                    observerWs.close(1000, "Room closed by creator");
                                }
                            });
                            
                            // Clean up the room
                            if (room.turnTimer) {
                                clearTimeout(room.turnTimer);
                            }
                            delete rooms[roomId];
                            // Clear any existing cleanup timer
                            if (roomCleanupTimers.has(roomId)) {
                                clearTimeout(roomCleanupTimers.get(roomId));
                                roomCleanupTimers.delete(roomId);
                            }
                        } else {
                            // Schedule room cleanup if it's empty
                            if (isRoomEmpty(room)) {
                                scheduleRoomCleanup(roomId);
                            }
                        }
                    } else {
                        // Game has started, just mark the WebSocket as null to allow reconnection
                        console.log(`Game has started, marking WebSocket as null for ${isObserver ? 'observer' : 'player'} ${playerName} to allow reconnection`);
                        if (isObserver) {
                            room.observers.set(playerName, null);
                        } else {
                            room.players.set(playerName, null);
                        }
                        
                        // Broadcast player disconnected message
                        broadcastToRoom(room, {
                            type: "player_disconnected",
                            playerName: playerName,
                            players: Array.from(room.players.keys()),
                            observers: Array.from(room.observers.keys())
                        });

                        // Check if room is empty after disconnection
                        if (isRoomEmpty(room)) {
                            console.log(`Room ${roomId} is empty after disconnection, scheduling cleanup...`);
                            scheduleRoomCleanup(roomId);
                        }
                    }
                }
            });
        } catch (error) {
            console.error("Error processing join message:", error);
            ws.close(1000, "Invalid join message");
        }
    });
});

function processTurnEnd(room) {
    // Clear the turn timer
    if (room.turnTimer) {
        clearTimeout(room.turnTimer);
    }

    // For players who haven't selected a page, randomly select one
    room.players.forEach((ws, player) => {
        if (!room.waitingForPlayers.has(player)) {
            const randomLink = room.currentPageLinks[Math.floor(Math.random() * room.currentPageLinks.length)];
            room.playerStates.set(player, randomLink);
            room.randomSelections.set(player, randomLink);
            room.waitingForPlayers.add(player); // Mark them as "selected" even though it was random
            
            // Update player's path
            if (!room.playerPaths.has(player)) {
                room.playerPaths.set(player, []);
            }
            room.playerPaths.get(player).push(randomLink);
        }
    });

    // Check for winners
    const winners = [];
    room.playerStates.forEach((url, player) => {
        if (url === room.endUrl) {
            winners.push(player);
        }
    });

    if (winners.length > 0) {
        // Game over, we have winners
        room.state = 'finished';
        const randomSelectionsObj = Object.fromEntries(room.randomSelections);
        broadcastToRoom(room, {
            type: "game_over",
            winners: winners,
            playerStates: Object.fromEntries(room.playerStates),
            playerPaths: Object.fromEntries(room.playerPaths),
            randomSelections: randomSelectionsObj
        });
    } else {
        // Move to next page
        const players = Array.from(room.players.keys());
        const currentPlayer = room.currentPlayer;
        const currentPlayerIndex = players.indexOf(currentPlayer);
        const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
        const nextPlayer = players[nextPlayerIndex];
        
        // Get the next player's selected URL
        const newUrl = room.playerStates.get(nextPlayer);
        console.log('Moving to next page:', {
            currentPlayer,
            nextPlayer,
            newUrl,
            playerStates: Object.fromEntries(room.playerStates)
        });
        
        if (!newUrl) {
            console.error('No URL found for next player:', nextPlayer);
            return;
        }
        
        room.currentUrl = newUrl;
        room.currentPlayer = nextPlayer;
        room.waitingForPlayers.clear();
        room.turnEndTime = null; // Clear the turn end time since we're moving forward

        // Broadcast new page to all players
        const randomSelectionsObj = Object.fromEntries(room.randomSelections);
        broadcastToRoom(room, {
            type: "page_update",
            room: {
                id: room.id,
                name: room.name,
                startUrl: room.startUrl,
                endUrl: room.endUrl,
                players: Array.from(room.players.keys()),
                observers: Array.from(room.observers.keys()),
                state: room.state,
                creator: room.creator,
                currentUrl: room.currentUrl,
                playerStates: Object.fromEntries(room.playerStates),
                playerPaths: Object.fromEntries(room.playerPaths),
                randomSelections: randomSelectionsObj
            },
            allPlayersSelected: true,
            endTime: null,
            waitingPlayers: []
        });
    }
}

// Helper function to broadcast messages to all players in a room
function broadcastToRoom(room, message, excludeWs = null) {
    // Broadcast to players
    room.players.forEach((client, playerName) => {
        // Skip excluded WebSocket and check if client exists and is open
        if (client !== excludeWs && client && client.readyState === 1) {
            try {
                client.send(JSON.stringify(message));
            } catch (error) {
                console.error(`Error sending message to player ${playerName}:`, error);
            }
        }
    });

    // Broadcast to observers
    room.observers.forEach((client, observerName) => {
        // Skip excluded WebSocket and check if client exists and is open
        if (client !== excludeWs && client && client.readyState === 1) {
            try {
                client.send(JSON.stringify(message));
            } catch (error) {
                console.error(`Error sending message to observer ${observerName}:`, error);
            }
        }
    });
}

// Helper function to check if a room is empty
function isRoomEmpty(room) {
    // Check if there are any active players (WebSocket is not null)
    const hasActivePlayers = Array.from(room.players.values()).some(ws => ws !== null);
    // Check if there are any active observers (WebSocket is not null)
    const hasActiveObservers = Array.from(room.observers.values()).some(ws => ws !== null);
    
    return !hasActivePlayers && !hasActiveObservers;
}

// Helper function to schedule room cleanup
function scheduleRoomCleanup(roomId) {
    // Clear any existing cleanup timer
    if (roomCleanupTimers.has(roomId)) {
        clearTimeout(roomCleanupTimers.get(roomId));
    }
    
    // Set new cleanup timer
    const timer = setTimeout(() => {
        const room = rooms[roomId];
        if (room && isRoomEmpty(room)) {
            console.log(`Room ${roomId} is empty, cleaning up...`);
            delete rooms[roomId];
            roomCleanupTimers.delete(roomId);
        }
    }, 10000); // 10 seconds
    
    roomCleanupTimers.set(roomId, timer);
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
