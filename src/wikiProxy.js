const axios = require('axios');

// Cache implementation
const CACHE_SIZE = 100;
const responseCache = new Map();

function addToCache(url, data) {
    if (responseCache.size >= CACHE_SIZE) {
        // Remove the oldest entry when cache is full
        const firstKey = responseCache.keys().next().value;
        responseCache.delete(firstKey);
    }
    responseCache.set(url, data);
}

async function getWikiContent(url) {
    if (!url || !url.startsWith('https://en.wikipedia.org/')) {
        throw new Error("Invalid Wikipedia URL");
    }

    // Check if URL is in cache
    if (responseCache.has(url)) {
        return responseCache.get(url);
    }

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'WikiRace Game/1.0',
                'Accept': 'text/html'
            }
        });

        if (!response.data) {
            throw new Error("No content received from Wikipedia");
        }

        // Add response to cache
        addToCache(url, response.data);
        return response.data;
        
    } catch (error) {
        if (error.response) {
            console.error(`[getWikiContent] Response headers:`, error.response.headers);
        }
        throw new Error("Failed to fetch Wikipedia content");
    }
}

module.exports = {
    getWikiContent
}; 