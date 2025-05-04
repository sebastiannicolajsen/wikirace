const QRCode = require('qrcode');
const { getRoom } = require('./roomManager');

// Cache for QR codes
const qrCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_CACHE_SIZE = 5;

/**
 * Cleans up expired QR codes from the cache
 */
function cleanupCache() {
  const now = Date.now();
  for (const [roomId, data] of qrCache.entries()) {
    if (now - data.timestamp > CACHE_EXPIRY) {
      qrCache.delete(roomId);
    }
  }
}

/**
 * Manages the cache size by removing oldest entries if needed
 */
function manageCacheSize() {
  if (qrCache.size >= MAX_CACHE_SIZE) {
    // Find the oldest entry
    let oldestRoomId = null;
    let oldestTimestamp = Infinity;
    
    for (const [roomId, data] of qrCache.entries()) {
      if (data.timestamp < oldestTimestamp) {
        oldestTimestamp = data.timestamp;
        oldestRoomId = roomId;
      }
    }
    
    // Remove the oldest entry
    if (oldestRoomId) {
      qrCache.delete(oldestRoomId);
    }
  }
}

/**
 * Generates a QR code for a room
 * @param {string} roomId - The ID of the room
 * @param {string} baseUrl - The base URL of the application
 * @param {string} backgroundColor - The background color for the QR code
 * @returns {Promise<string>} - The QR code as an SVG string
 * @throws {Error} - If the room doesn't exist or there's an error generating the QR code
 */
async function generateRoomQRCode(roomId, baseUrl, backgroundColor = '#ffffff') {
  try {
    // Clean up expired cache entries
    cleanupCache();

    // Check if we have a valid cached QR code
    const cachedData = qrCache.get(roomId);
    if (cachedData && Date.now() - cachedData.timestamp <= CACHE_EXPIRY) {
      return cachedData.qrCode;
    }

    // Check if room exists
    const room = getRoom(roomId);
    if (!room) {
      console.error(`Room ${roomId} not found`);
      throw new Error('Room not found');
    }

    // Generate room URL
    const roomUrl = `${baseUrl}/?id=${roomId}`;

    // Generate QR code with custom styling
    const qrOptions = {
      errorCorrectionLevel: 'H',
      margin: 1,
      color: {
        dark: '#666666',  // Faded text color
        light: backgroundColor  // Use provided background color
      },
      type: 'svg',
      width: 200,
      height: 200
    };

    // Generate QR code as SVG
    const qrCode = await QRCode.toString(roomUrl, qrOptions);

    // Manage cache size before adding new entry
    manageCacheSize();

    // Cache the QR code
    qrCache.set(roomId, {
      qrCode,
      timestamp: Date.now()
    });

    return qrCode;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  generateRoomQRCode
}; 