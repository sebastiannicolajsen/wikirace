var express = require("express");
var app = express();
var expressWs = require("express-ws")(app);
var path = require("path");
const db = require("./db");
const { handleGameFlowMessage } = require("./gameFlow/gameFlowHandler");
const {
  handleConnection,
  handleWebSocketClose,
} = require("./connectionHandler");
const { router: roomRouter, rooms } = require("./roomManager");
const { getWikiContent } = require("./wikiProxy");
const { generateRoomQRCode } = require("./qrCodeManager");
const { getGameState } = require("./gameStateManager");
const { router: tournamentRouter } = require("./tournamentManager");

// Get port from environment variable or use 3000 for local development
const port = process.env.PORT || 3000;
const isProduction = process.env.PRODUCTION === "true";
const maxRooms = parseInt(process.env.MAX_ROOMS) || 10;

// Get base URL from environment variable or use localhost for development
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

// Initialize database and start server
db.init()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Maximum rooms allowed: ${maxRooms}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });

// Configure static file serving with proper MIME types
app.use(express.static(path.join(__dirname, "../public"), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));
app.use(express.json());

// API Routes
const apiRouter = express.Router();

// Environment configuration
apiRouter.get("/config", (req, res) => {
  res.json({
    isProduction: isProduction,
    port: port,
    maxRooms: maxRooms,
    currentRooms: rooms.size
  });
});

// Get random Wikipedia links
apiRouter.get("/random-url", async (req, res) => {
  try {
    const result = await db.getRandomPair();
    if (!result || !result.url) {
      throw new Error("Failed to get valid random URL");
    }
    // Ensure we include the ID in the response
    const response = {
      url: result.url,
      id: result.id || result._id, // Handle both id and _id (MongoDB)
      title: result.title || result.url.split('/').pop().replace(/_/g, ' ')
    };
    res.json(response);
  } catch (error) {
    console.error("Error getting random URL:", error);
    res.status(500).json({ error: "Failed to get random URL" });
  }
});

// Store a new Wikipedia URL
apiRouter.post("/url", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    // Sanitize the URL
    const sanitizedUrl = new URL(url);
    
    // Check if it's a Wikipedia URL
    if (!sanitizedUrl.hostname.includes('wikipedia.org')) {
      return res.status(400).json({ error: "Invalid Wikipedia URL" });
    }

    // Check if it's English Wikipedia
    if (sanitizedUrl.hostname !== 'en.wikipedia.org' && sanitizedUrl.hostname !== 'en.m.wikipedia.org') {
      return res.status(400).json({ error: "Only English Wikipedia URLs are supported" });
    }

    // Convert mobile URL to desktop URL if needed
    let cleanUrl = `${sanitizedUrl.origin}${sanitizedUrl.pathname}`;
    if (sanitizedUrl.hostname === 'en.m.wikipedia.org') {
      cleanUrl = cleanUrl.replace('en.m.wikipedia.org', 'en.wikipedia.org');
    }

    // Check for non-article content
    const path = cleanUrl.toLowerCase();
    if (path.includes('/file:') || 
        path.includes('/special:') || 
        path.includes('/help:') || 
        path.includes('/template:') || 
        path.includes('/category:') || 
        path.includes('/portal:') || 
        path.includes('/wikipedia:') ||
        path.includes('/user:') ||
        path.includes('/talk:') ||
        path.includes('/project:') ||
        path.includes('/module:') ||
        path.includes('/mediawiki:') ||
        path.includes('/draft:') ||
        path.includes('/book:') ||
        path.includes('/wiktionary:') ||
        path.includes('/wikibooks:') ||
        path.includes('/wikiquote:') ||
        path.includes('/wikisource:') ||
        path.includes('/wikinews:') ||
        path.includes('/wikiversity:') ||
        path.includes('/wikivoyage:') ||
        path.includes('/wikidata:') ||
        path.includes('/commons:') ||
        path.includes('/meta:') ||
        path.includes('/incubator:') ||
        path.includes('/outreach:') ||
        path.includes('/species:') ||
        path.includes('/media:') ||
        path.includes('/s:') ||
        path.includes('/q:') ||
        path.includes('/n:') ||
        path.includes('/v:') ||
        path.includes('/voy:') ||
        path.includes('/d:') ||
        path.includes('/c:') ||
        path.includes('/m:') ||
        path.includes('/i:') ||
        path.includes('/o:') ||
        path.includes('/species:') ||
        path.includes('/m:') ||
        path.includes('/s:') ||
        path.includes('/q:') ||
        path.includes('/n:') ||
        path.includes('/v:') ||
        path.includes('/voy:') ||
        path.includes('/d:') ||
        path.includes('/c:') ||
        path.includes('/m:') ||
        path.includes('/i:') ||
        path.includes('/o:') ||
        path.includes('/species:')) {
      return res.status(400).json({ error: "Invalid Wikipedia article URL. Media files and special pages are not allowed." });
    }

    // Store the sanitized URL
    const result = await db.storeUrl(cleanUrl);
    res.json(result);
  } catch (error) {
    console.error("Error storing URL:", error);
    res.status(500).json({ error: "Failed to store URL" });
  }
});

// Get URL by ID
apiRouter.get("/url/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.getUrlById(id);
    if (!result) {
      return res.status(404).json({ error: "URL not found" });
    }
    res.json(result);
  } catch (error) {
    console.error("Error getting URL:", error);
    res.status(500).json({ error: "Failed to get URL" });
  }
});

// Wikipedia content proxy
apiRouter.get("/wiki-content", async (req, res) => {
  const url = req.query.url;
  console.log('Received wiki-content request for URL:', url);

  // Convert mobile URL to desktop URL if needed
  let cleanUrl = url;
  if (url && url.includes('en.m.wikipedia.org')) {
    cleanUrl = url.replace('en.m.wikipedia.org', 'en.wikipedia.org');
  }

  if (!cleanUrl || !cleanUrl.startsWith("https://en.wikipedia.org/")) {
    console.error('Invalid Wikipedia URL:', url);
    return res.status(400).json({ error: "Invalid Wikipedia URL" });
  }

  try {
    console.log('Fetching content from Wikipedia...');
    const content = await getWikiContent(cleanUrl);
    res.send(content);
  } catch (error) {
    console.error("Error fetching Wikipedia content:", error);
    res.status(500).json({ error: "Failed to fetch Wikipedia content" });
  }
});

// QR Code generation endpoint
apiRouter.get("/qr/:roomId", async (req, res) => {
  const roomId = req.params.roomId;
  const backgroundColor = req.query.bg || '#ffffff';
  
  try {
    const qrDataUrl = await generateRoomQRCode(roomId, baseUrl, backgroundColor);
    res.json({ qrCode: qrDataUrl });
  } catch (error) {
    console.error("Error generating QR code:", error);
    if (error.message === 'Room not found') {
      res.status(404).json({ error: "Room not found" });
    } else {
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  }
});

// Mount API routes
app.use("/api", apiRouter);

// Mount room routes
app.use("/api", roomRouter);

// Mount tournament routes
app.use("/api/tournament", tournamentRouter);

// WebSocket connection handler
apiRouter.ws("/ws/:roomId", (ws, req) => {
  const roomId = req.params.roomId;

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      // Handle connection-related messages
      if (data.type === "join" || data.type === "leave" || data.type === "pong") {
        const result = handleConnection(ws, roomId, data);
        if (!result) {
          ws.close(1000, "Connection attempt failed");
        }
      } else if (data.type === "status") {
        // Handle status request - send current game state only to requesting player
        const room = rooms.get(roomId);
        if (room) {
          const gameState = getGameState(room);
          ws.send(JSON.stringify({
            type: 'game_state',
            state: gameState
          }));
        }
      } else {
        // Handle game-related messages
        handleGameFlowMessage(roomId, data.type, data);
      }
    } catch (error) {
      console.error(`[Room ${roomId}] Error handling message:`, error);
      ws.close(1000, "Invalid message format");
    }
  });

  ws.on("close", (_, reason) => {
    handleWebSocketClose(roomId, ws, reason === "leave" ? true : false);
  });
});

// Handle specific page routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Handle observer page route
app.get("/observer/:roomId", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/observer.html"));
});

app.get("/create", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/create.html"));
});

app.get("/join", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/room/:roomId", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/room.html"));
});

app.get("/game/:roomId", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/game/game.html"));
});

app.get("/tournament", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/tournament.html"));
});

app.get("/examples", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/pages/examples.html"));
});

// Handle all other routes by serving the index page
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});
