/**
 * Room Manager - Handles room creation and management
 *
 * Room State Structure:
 * {
 *   // Basic room info
 *   id: string,                    // 4-character unique room ID
 *   name: string,                  // Room name
 *   startUrl: string,              // Starting Wikipedia URL
 *   endUrl: string,                // Target Wikipedia URL
 *   creator: string,               // Name of the room creator
 *   status: string,                // Current game state (lobby, running, waiting, paused, handout, finished)
 *   createdAt: string,            // ISO timestamp of room creation
 * 
 *   // Player data
 *   players: Map<string, {        // Map of player name to player data
 *     type: 'player',
 *     path: Array<{url: string, effect: string}>, // Player's path history
 *     additions: {                // Player's available additions
 *       bomb: number,
 *       swap: number,
 *       return: number
 *     },
 *     ws: WebSocket              // Player's WebSocket connection
 *   }>,
 *   observers: Map<string, {      // Map of observer name to observer data
 *     type: 'observer',
 *     ws: WebSocket              // Observer's WebSocket connection
 *   }>,
 * 
 *   // Game state
 *   winner: string | null,        // Name of the winner
 *   hasWinner: boolean,          // Whether there is a winner
 *   hasAdditions: boolean,       // Whether additions are enabled
 *   nextAddition: string | null, // Next addition to be distributed
 * 
 *   // Timers and timing
 *   countdownTime: number,        // Duration of countdown in seconds (5-35s)
 *   timerExpired: number | null,  // Remaining time in milliseconds
 *   waitingTimer: number | null,  // Timer ID for waiting state
 *   additionTimer: number | null, // Timer ID for addition phase
 *   additionEndTime: number | null, // When the addition phase ends
 * 
 *   // Player tracking
 *   missedLinks: Map<string, number>,     // Map of player name to count of missed links
 *   receivedAdditions: Map<string, number>, // Map of player name to count of received additions
 *   waitingForPlayers: boolean,           // Whether waiting for player responses
 *   continueResponses: Set<string>,       // Set of players who have responded to continue
 *   submittedPlayers: Set<string>,        // Set of players who have submitted their links
 * 
 *   // Addition phase state
 *   eligiblePlayers: string[],           // List of players who can use additions
 *   currentPlayerIndex: number,          // Current player index for round_robin mode
 *   readyPlayers: Set<string>,          // Set of players ready to continue
 * 
 *   // Room configuration
 *   config: {
 *     continuation: 'automatic' | 'creator' | 'democratic',
 *     chooser: 'random' | 'player',
 *     additions: {
 *       bomb: number,
 *       swap: number,
 *       return: number
 *     },
 *     additions_creatorGive: boolean,
 *     additions_obtainWithExposure: number,
 *     additions_obtainWithTimer: number,
 *     additions_application: 'once' | 'unlimited',
 *     additions_callType: 'free_for_all' | 'round_robin',
 *     additions_timer: number,           // 5-60 seconds
 *     additions_multiplePerRound: boolean
 *   }
 * }
 */

const { v4: uuidv4 } = require("uuid");
const { getGameState, broadcastGameState } = require("./gameStateManager");
const express = require("express");
const router = express.Router();
const { getWikiContent } = require("./wikiProxy");
const { JSDOM } = require('jsdom');
const { fetchShortestPathsAsync } = require('./shortestPathsManager');
const { roomCleanupTimers, setRoomCleanupTimer, clearRoomCleanupTimer } = require('./roomCleanup');

// Store all active rooms
const rooms = new Map();

// Get the maximum number of rooms allowed
const maxRooms = parseInt(process.env.MAX_ROOMS) || 10;

// Helper function to validate Wikipedia URLs
function isValidWikipediaUrl(url) {
  if (!url) {
    return false;
  }

  // Convert mobile URL to desktop URL for validation
  let cleanUrl = url;
  if (url.includes('en.m.wikipedia.org')) {
    cleanUrl = url.replace('en.m.wikipedia.org', 'en.wikipedia.org');
  }

  // Check if it's a valid Wikipedia URL
  if (!cleanUrl.startsWith("https://en.wikipedia.org/wiki/")) {
    return false;
  }

  // Check for non-article content
  const path = cleanUrl.toLowerCase();
  const invalidPrefixes = [
    '/file:', '/special:', '/help:', '/template:', '/category:', '/portal:', '/wikipedia:',
    '/user:', '/talk:', '/project:', '/module:', '/mediawiki:', '/draft:', '/book:',
    '/wiktionary:', '/wikibooks:', '/wikiquote:', '/wikisource:', '/wikinews:',
    '/wikiversity:', '/wikivoyage:', '/wikidata:', '/commons:', '/meta:', '/incubator:',
    '/outreach:', '/species:', '/media:', '/s:', '/q:', '/n:', '/v:', '/voy:', '/d:',
    '/c:', '/m:', '/i:', '/o:'
  ];

  return !invalidPrefixes.some(prefix => path.includes(prefix));
}

// Helper function to set a cleanup timer for a room
function setupRoomCleanupTimer(roomId) {
    setRoomCleanupTimer(roomId, () => {
        const room = rooms.get(roomId);
        if (!room) {
            console.log(`[Room ${roomId}] Room no longer exists, cleaning up timer`);
            return;
        }
        if (isRoomEmpty(room)) {
            console.log(`[Room ${roomId}] Room is empty, deleting`);
            deleteRoom(roomId);
        } else {
            console.log(`[Room ${roomId}] Room is not empty, resetting timer (playerNames=${Array.from(room.players.keys()).join(', ')})`);
            setupRoomCleanupTimer(roomId); // Reset the timer
        }
    });
}

// Helper function to extract first paragraph from HTML
async function getFirstParagraph(url) {
    try {
        const html = await getWikiContent(url);
        const dom = new JSDOM(html);
        
        // Try different selectors for the main content
        const content = dom.window.document.querySelector('#mw-content-text') || 
                       dom.window.document.querySelector('.mw-parser-output') ||
                       dom.window.document.querySelector('#content');
                       
        if (!content) {
            return "None Found";
        }
        
        // Find the first non-empty paragraph that's not a reference or navigation
        const paragraphs = content.querySelectorAll('p');
        
        for (const p of paragraphs) {
            // Skip paragraphs with unwanted classes
            const unwantedClasses = [
                'mw-empty-elt',
                'mw-editsection',
                'mw-references-wrap',
                'mw-references',
                'mw-ext-cite-error',
                'mw-parser-output',
                'mw-redirect',
                'mw-disambig',
                'mw-search-results',
                'mw-search-createlink'
            ];
            
            const hasUnwantedClass = unwantedClasses.some(cls => p.classList.contains(cls));
            if (hasUnwantedClass) continue;
            
            // Get the text content and clean it
            let text = p.textContent.trim();
            
            // Skip if empty
            if (!text) continue;
            
            // Skip if it looks like CSS or contains unwanted patterns
            if (text.includes('{') || 
                text.includes('}') || 
                text.includes(';') ||
                text.includes('IPA:') ||
                text.includes('mw-') ||
                text.includes('font-size') ||
                text.includes('label') ||
                text.includes('class=') ||
                text.includes('style=')) {
                continue;
            }
            
            // Skip paragraphs that are just references or navigation
            if (text.startsWith('[') || 
                text.startsWith('Jump to') ||
                text.startsWith('This article') ||
                text.startsWith('For other uses') ||
                text.startsWith('This page') ||
                text.startsWith('This is a') ||
                text.startsWith('This list') ||
                text.startsWith('This section') ||
                text.startsWith('This template') ||
                text.startsWith('This category') ||
                text.startsWith('This portal') ||
                text.startsWith('This help') ||
                text.startsWith('This file') ||
                text.startsWith('This user') ||
                text.startsWith('This project') ||
                text.startsWith('This talk') ||
                text.startsWith('This discussion')) {
                continue;
            }
            
            // Remove any remaining HTML-like content
            text = text.replace(/<[^>]*>/g, '');
            
            // Remove any remaining CSS-like content
            text = text.replace(/\{[^}]*\}/g, '');
            
            // Clean up any remaining artifacts
            text = text.replace(/\s+/g, ' ').trim();
            
            // Only return if we have meaningful content
            if (text.length > 10) {
                return text;
            }
        }
        
        return "None Found";
    } catch (error) {
        console.error(`[getFirstParagraph] Error fetching Wikipedia preview for URL ${url}:`, error);
        return "None Found";
    }
}

// Helper function to fetch previews asynchronously
async function fetchPreviewsAsync(startUrl, endUrl, roomId) {
  try {
    const [startPreview, endPreview] = await Promise.all([
      getFirstParagraph(startUrl),
      getFirstParagraph(endUrl)
    ]);
    
    const room = rooms.get(roomId);
    if (room) {
      room.startPreview = startPreview;
      room.endPreview = endPreview;
      broadcastGameState(room);
    }
  } catch (error) {
    console.error(`[Room ${roomId}] Error fetching previews:`, error);
  }
}

async function createRoom(
  name,
  startUrl,
  endUrl,
  creatorName,
  countdownTime = 30,
  config = {}
) {
  // Check if we've reached the room limit
  if (rooms.size >= maxRooms) {
    throw new Error("Maximum room limit reached");
  }

  // Validate required parameters
  if (!name || typeof name !== "string") {
    throw new Error("Room name is required");
  }
  if (!startUrl || !isValidWikipediaUrl(startUrl)) {
    throw new Error("Valid start URL is required");
  }
  if (!endUrl || !isValidWikipediaUrl(endUrl)) {
    throw new Error("Valid end URL is required");
  }
  if (!creatorName || typeof creatorName !== "string") {
    throw new Error("Creator name is required");
  }

  // Validate countdown time
  const parsedCountdown = parseInt(countdownTime);
  if (isNaN(parsedCountdown) || parsedCountdown < 5 || parsedCountdown > 35) {
    throw new Error("Countdown time must be between 5 and 35 seconds");
  }

  // Validate configuration
  if (config && typeof config !== "object") {
    throw new Error("Invalid configuration");
  }

  // Validate continuation
  const validContinuations = ["automatic", "creator", "democratic"];
  if (
    config.continuation &&
    !validContinuations.includes(config.continuation)
  ) {
    throw new Error("Invalid continuation value");
  }

  // Validate chooser
  const validChoosers = ["random", "player"];
  if (config.chooser && !validChoosers.includes(config.chooser)) {
    throw new Error("Invalid chooser value");
  }

  // Validate additions
  const validAdditions = ["bomb", "swap", "return"];
  if (config.additions) {
    if (typeof config.additions !== "object") {
      throw new Error("Invalid additions configuration");
    }
    Object.entries(config.additions).forEach(([type, amount]) => {
      if (!validAdditions.includes(type)) {
        throw new Error("Invalid addition type");
      }
      if (typeof amount !== "number" || amount < 0) {
        throw new Error("Invalid addition amount");
      }
    });
  }

  // Validate addition configuration
  if (typeof config.additions_creatorGive !== "boolean") {
    throw new Error("Invalid creator give setting");
  }
  if (
    typeof config.additions_obtainWithExposure !== "number" ||
    config.additions_obtainWithExposure < 0
  ) {
    throw new Error("Invalid exposure setting");
  }
  if (
    typeof config.additions_obtainWithTimer !== "number" ||
    config.additions_obtainWithTimer < 0
  ) {
    throw new Error("Invalid timer setting");
  }
  if (
    config.additions_application &&
    !["once", "unlimited"].includes(config.additions_application)
  ) {
    throw new Error("Invalid application setting");
  }
  if (
    config.additions_callType &&
    !["free_for_all", "round_robin"].includes(config.additions_callType)
  ) {
    throw new Error("Invalid call type setting");
  }

  // Validate additions_multiplePerRound
  if (typeof config.additions_multiplePerRound !== "boolean") {
    throw new Error("Invalid multiple per round setting");
  }

  // Generate a unique room ID with retry mechanism
  let id;
  let attempts = 0;
  const maxAttempts = 10;
  
  do {
    id = uuidv4().substring(0, 4).toUpperCase();
    attempts++;
    
    if (attempts > maxAttempts) {
      throw new Error("Failed to create room");
    }
  } while (rooms.has(id));

  console.log(`[Room ${id}] Creating new room: name="${name}", creator="${creatorName}"`);

  // Default configuration
  const defaultConfig = {
    continuation: "automatic",
    chooser: "random",
    additions: {},
    additions_creatorGive: true,
    additions_obtainWithExposure: 0,
    additions_obtainWithTimer: 0,
    additions_application: "once",
    additions_callType: "free_for_all",
    additions_timer: 30,
    additions_multiplePerRound: false
  };

  // Merge provided config with defaults
  const mergedConfig = {
    ...defaultConfig,
    ...config,
  };

  // Only include addition types that were explicitly selected
  if (config.additions) {
    mergedConfig.additions = {};
    Object.entries(config.additions).forEach(([type, amount]) => {
      if (amount !== undefined) {
        mergedConfig.additions[type] = amount;
      }
    });
  }

  // Validate additions_timer
  if (typeof mergedConfig.additions_timer !== 'number' || mergedConfig.additions_timer < 5 || mergedConfig.additions_timer > 60) {
    throw new Error('additions_timer must be a number between 5 and 60 seconds');
  }

  const object = {
    id,
    name,
    startUrl,
    endUrl,
    startPreview: '',  // Initialize as empty string
    endPreview: '',    // Initialize as empty string
    creator: creatorName,
    status: "lobby",
    createdAt: new Date().toISOString(),
    players: new Map(),
    observers: new Map(),
    winner: null,
    hasWinner: false,
    hasAdditions: false,
    nextAddition: null,
    countdownTime: parsedCountdown,
    timerExpired: null,
    waitingTimer: null,
    additionTimer: null,
    additionEndTime: null,
    missedLinks: new Map(),
    receivedAdditions: new Map(),
    waitingForPlayers: false,
    continueResponses: new Set(),
    submittedPlayers: new Set(),
    eligiblePlayers: [],
    currentPlayerIndex: 0,
    readyPlayers: new Set(),
    config: mergedConfig,
    shortestpaths: null,
  };

  rooms.set(id, object);
  console.log(`[Room ${id}] Room created and added to rooms map. Current rooms:`, Array.from(rooms.keys()));
  
  // Set initial cleanup timer
  setupRoomCleanupTimer(id);
  console.log(`[Room ${id}] Initial cleanup timer set`);

  // Fetch previews asynchronously
  fetchPreviewsAsync(startUrl, endUrl, id);

  // Fetch shortest paths asynchronously
  fetchShortestPathsAsync(startUrl, endUrl, (result) => {
    const room = rooms.get(id);
    if (room) {
      room.shortestpaths = result;
      broadcastGameState(room);
    }
  });

  return id;
}

// Helper function to check if a room is empty
function isRoomEmpty(room) {
  return room.players.size === 0 && room.observers.size === 0;
}

// Create a new room
router.post("/create", async function (req, res) {
  const {
    name,
    startUrl,
    endUrl,
    playerName,
    countdownTime,
    role,
    config = {},
  } = req.body;

  if (!name || !playerName) {
    return res
      .status(400)
      .json({ error: "Room name and player name are required" });
  }

  try {
    const roomId = await createRoom(
      name,
      startUrl,
      endUrl,
      playerName,
      countdownTime,
      config
    );
    const room = rooms.get(roomId);

    // Add creator to the room based on their role
    if (role === "observer") {
      room.observers.set(playerName, { type: "observer", path: [], ws: null });
    } else {
      room.players.set(playerName, { type: "player", path: [], ws: null });
    }

    // Send back both the room ID and game state
    res.json({
      id: roomId,
      ...getGameState(room)
    });
  } catch (error) {
    // Format error messages based on their type
    let errorMessage = error.message;
    
    if (errorMessage.includes("Maximum room limit")) {
      errorMessage = "Maximum room limit reached. Please try again later or run your own instance.";
    } else if (errorMessage.includes("Failed to fetch")) {
      errorMessage = "Failed to fetch Wikipedia article previews. Please try again.";
    } else if (errorMessage.includes("Invalid")) {
      errorMessage = "Invalid room settings. Please check your configuration.";
    } else if (errorMessage.includes("Failed to create")) {
      errorMessage = "Failed to create room. Please try again.";
    }

    res.status(400).json({ error: errorMessage });
  }
});

// Get a room by ID
function getRoom(roomId) {
  return rooms.get(roomId);
}

// Delete a room
function deleteRoom(roomId) {
    const room = rooms.get(roomId);
    if (room) {
        console.log(`[Room ${roomId}] Deleting room: name="${room.name}", creator="${room.creator}"`);
        rooms.delete(roomId);
        if (roomCleanupTimers.has(roomId)) {
            clearTimeout(roomCleanupTimers.get(roomId));
            roomCleanupTimers.delete(roomId);
        }
    }
}

module.exports = {
  rooms,
  roomCleanupTimers,
  createRoom,
  getRoom,
  deleteRoom,
  isRoomEmpty,
  setRoomCleanupTimer,
  clearRoomCleanupTimer,
  router
};
