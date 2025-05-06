const axios = require('axios');
const { urlToTitle } = require('./wikiHelper');

// Debug flag
const DEBUG = false;

// Cache for storing path calculations
const pathCache = new Map();
const MAX_CACHE_SIZE = 500;

/**
 * Adds a result to the cache, maintaining the size limit
 * @param {string} startUrl - The starting Wikipedia URL
 * @param {string} endUrl - The target Wikipedia URL
 * @param {Object} result - The path calculation result
 */
function addToCache(startUrl, endUrl, result) {
    const key = `${startUrl}|${endUrl}`;
    const reverseKey = `${endUrl}|${startUrl}`;

    // If cache is full, remove the oldest entry
    if (pathCache.size >= MAX_CACHE_SIZE) {
        const firstKey = pathCache.keys().next().value;
        pathCache.delete(firstKey);
    }

    // Store both directions since paths are bidirectional
    pathCache.set(key, result);
    pathCache.set(reverseKey, result);
}

/**
 * Gets a result from the cache
 * @param {string} startUrl - The starting Wikipedia URL
 * @param {string} endUrl - The target Wikipedia URL
 * @returns {Object|null} - The cached result or null if not found
 */
function getFromCache(startUrl, endUrl) {
    const key = `${startUrl}|${endUrl}`;
    return pathCache.get(key) || null;
}

/**
 * Fetches shortest paths between two Wikipedia articles and returns a promise
 * @param {string} startUrl - The starting Wikipedia URL
 * @param {string} endUrl - The target Wikipedia URL
 * @returns {Promise<Object|null>} - A promise that resolves to the shortest paths data or null
 */
async function fetchShortestPaths(startUrl, endUrl) {
    if (DEBUG) console.log('[fetchShortestPaths] Starting request for:', { startUrl, endUrl });
    
    if (!process.env.PATH_API) {
        if (DEBUG) console.log('[fetchShortestPaths] No PATH_API configured');
        return null;
    }

    // Check cache first
    const cachedResult = getFromCache(startUrl, endUrl);
    if (cachedResult) {
        if (DEBUG) console.log('[fetchShortestPaths] Found cached result');
        return cachedResult;
    }

    const sourceTitle = urlToTitle(startUrl);
    const targetTitle = urlToTitle(endUrl);

    if (DEBUG) console.log('[fetchShortestPaths] Converted URLs to titles:', { sourceTitle, targetTitle });

    if (!sourceTitle || !targetTitle) {
        if (DEBUG) console.log('[fetchShortestPaths] Invalid titles');
        return null;
    }

    try {
        if (DEBUG) console.log('[fetchShortestPaths] Making API request to:', process.env.PATH_API);
        const response = await axios.post(process.env.PATH_API, {
            source: sourceTitle,
            target: targetTitle
        });

        if (DEBUG) console.log('[fetchShortestPaths] Received response:', response.status);

        if (response.data && response.data.paths && response.data.paths.length > 0) {
            const result = {
                length: response.data.paths[0].length - 1,
                paths: response.data.paths.length,
                example: response.data.paths[0].map(pageId => response.data.pages[pageId].title)
            };
            // Add to cache
            addToCache(startUrl, endUrl, result);
            if (DEBUG) console.log('[fetchShortestPaths] Successfully processed response');
            return result;
        }
        if (DEBUG) console.log('[fetchShortestPaths] Invalid response data');
        return null;
    } catch (error) {
        return "not-found";
    }
}

/**
 * Fetches shortest paths between two Wikipedia articles without awaiting the result
 * @param {string} startUrl - The starting Wikipedia URL
 * @param {string} endUrl - The target Wikipedia URL
 * @param {Function} callback - Callback function to handle the result
 */
function fetchShortestPathsAsync(startUrl, endUrl, callback) {
    if (DEBUG) console.log('[fetchShortestPathsAsync] Starting request for:', { startUrl, endUrl });
    
    if (!process.env.PATH_API) {
        if (DEBUG) console.log('[fetchShortestPathsAsync] No PATH_API configured');
        callback(null);
        return;
    }

    // Check cache first
    const cachedResult = getFromCache(startUrl, endUrl);
    if (cachedResult) {
        if (DEBUG) console.log('[fetchShortestPathsAsync] Found cached result');
        callback(cachedResult);
        return;
    }

    const sourceTitle = urlToTitle(startUrl);
    const targetTitle = urlToTitle(endUrl);

    if (DEBUG) console.log('[fetchShortestPathsAsync] Converted URLs to titles:', { sourceTitle, targetTitle });

    if (!sourceTitle || !targetTitle) {
        if (DEBUG) console.log('[fetchShortestPathsAsync] Invalid titles');
        callback(null);
        return;
    }

    if (DEBUG) console.log('[fetchShortestPathsAsync] Making API request to:', process.env.PATH_API);
    axios.post(process.env.PATH_API, {
        source: sourceTitle,
        target: targetTitle
    })
    .then(response => {
        if (DEBUG) console.log('[fetchShortestPathsAsync] Received response:', response.status);
        
        if (response.data && response.data.paths && response.data.paths.length > 0) {
            const result = {
                length: response.data.paths[0].length - 1,
                paths: response.data.paths.length,
                example: response.data.paths[0].map(pageId => response.data.pages[pageId].title)
            };
            // Add to cache
            addToCache(startUrl, endUrl, result);
            if (DEBUG) console.log('[fetchShortestPathsAsync] Successfully processed response');
            callback(result);
        } else {
            if (DEBUG) console.log('[fetchShortestPathsAsync] Invalid response data');
            callback(null);
        }
    })
    .catch(error => {
        if (DEBUG) console.log('[fetchShortestPathsAsync] Error details:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
        });
        callback("not-found");
    });
}

module.exports = {
    fetchShortestPaths,
    fetchShortestPathsAsync
}; 