const { parentPort } = require('worker_threads');
const { getWikiContent } = require("./wikiProxy");
const { JSDOM } = require("jsdom");
const { fetchShortestPathsAsync } = require("./shortestPathsManager");
const { setRoomCleanupTimer } = require("./roomCleanup");

// Helper function to extract first paragraph from HTML
async function getFirstParagraph(url) {
    try {
        const html = await getWikiContent(url);
        const dom = new JSDOM(html);
        
        const content =
            dom.window.document.querySelector("#mw-content-text") ||
            dom.window.document.querySelector(".mw-parser-output") ||
            dom.window.document.querySelector("#content");
                       
        if (!content) {
            return "None Found";
        }
        
        const paragraphs = content.querySelectorAll("p");
        
        for (const p of paragraphs) {
            const unwantedClasses = [
                "mw-empty-elt",
                "mw-editsection",
                "mw-references-wrap",
                "mw-references",
                "mw-ext-cite-error",
                "mw-parser-output",
                "mw-redirect",
                "mw-disambig",
                "mw-search-results",
                "mw-search-createlink",
            ];
            
            const hasUnwantedClass = unwantedClasses.some((cls) =>
                p.classList.contains(cls)
            );
            if (hasUnwantedClass) continue;
            
            let text = p.textContent.trim();
            
            if (!text) continue;
            
            if (
                text.includes("{") ||
                text.includes("}") ||
                text.includes(";") ||
                text.includes("IPA:") ||
                text.includes("mw-") ||
                text.includes("font-size") ||
                text.includes("label") ||
                text.includes("class=") ||
                text.includes("style=")
            ) {
                continue;
            }
            
            if (
                text.startsWith("[") ||
                text.startsWith("Jump to") ||
                text.startsWith("This article") ||
                text.startsWith("For other uses") ||
                text.startsWith("This page") ||
                text.startsWith("This is a") ||
                text.startsWith("This list") ||
                text.startsWith("This section") ||
                text.startsWith("This template") ||
                text.startsWith("This category") ||
                text.startsWith("This portal") ||
                text.startsWith("This help") ||
                text.startsWith("This file") ||
                text.startsWith("This user") ||
                text.startsWith("This project") ||
                text.startsWith("This talk") ||
                text.startsWith("This discussion")
            ) {
                continue;
            }
            
            text = text.replace(/<[^>]*>/g, "");
            text = text.replace(/\{[^}]*\}/g, "");
            text = text.replace(/\s+/g, " ").trim();
            
            if (text.length > 10) {
                return text;
            }
        }
        
        return "None Found";
    } catch (error) {
        console.error(
            `[getFirstParagraph] Error fetching Wikipedia preview for URL ${url}:`,
            error
        );
        return "None Found";
    }
}

// Helper function to calculate room ranking
async function calculateRoomRanking(room) {
    // Initialize ranking array
    const ranking = [];
    
    // First, add the winner to the ranking
    const winner = room.players.find(p => p.name === room.winner);
    if (winner) {
        ranking.push(winner);
    }

    // Track players who reached the end URL (excluding winner)
    const playersAtEnd = [];
    // Track players who need shortest path calculation
    const playersNeedingShortestPath = [];

    // Categorize players
    for (const player of room.players) {
        if (player.name === room.winner) continue; // Skip winner as they're already added

        if (player.path && player.path.length > 0) {
            const lastPathEntry = player.path[player.path.length - 1];
            if (lastPathEntry.url === room.endUrl) {
                playersAtEnd.push(player);
            } else {
                playersNeedingShortestPath.push(player);
            }
        }
    }

    // Sort players who reached the end according to submission order
    playersAtEnd.sort((a, b) => {
        const aIndex = room.submissionOrder.indexOf(a.name);
        const bIndex = room.submissionOrder.indexOf(b.name);
        return aIndex - bIndex;
    });

    // Add players who reached the end to ranking
    playersAtEnd.forEach(player => {
        ranking.push(player);
    });

    // If PATH_API is not set, just add remaining players by submission order
    if (!process.env.PATH_API) {
        // Sort remaining players by submission order
        playersNeedingShortestPath.sort((a, b) => {
            const aIndex = room.submissionOrder.indexOf(a.name);
            const bIndex = room.submissionOrder.indexOf(b.name);
            return aIndex - bIndex;
        });

        // Add remaining players to ranking
        playersNeedingShortestPath.forEach(player => {
            ranking.push(player);
        });

        // Add surrendered players at the end
        ranking.push(...room.surrenderedPlayers);

        return ranking;
    }

    // Calculate shortest paths for surrendered players
    if (room.surrenderedPlayers.length > 0) {
        await Promise.all(room.surrenderedPlayers.map(async player => {
            const lastPathEntry = player.path[player.path.length - 1];
            return new Promise((resolve) => {
                fetchShortestPathsAsync(lastPathEntry.url, room.endUrl, (result) => {
                    player.shortestPathToEnd = result;
                    resolve();
                });
            });
        }));
    }

    // If no players need shortest path calculation, return ranking with surrendered players
    if (playersNeedingShortestPath.length === 0) {
        ranking.push(...room.surrenderedPlayers);
        return ranking;
    }

    // Fetch shortest paths for remaining players
    await Promise.all(playersNeedingShortestPath.map(async player => {
        const lastPathEntry = player.path[player.path.length - 1];
        return new Promise((resolve) => {
            fetchShortestPathsAsync(lastPathEntry.url, room.endUrl, (result) => {
                player.shortestPathToEnd = result;
                resolve();
            });
        });
    }));

    // Sort players needing shortest path by path length and submission order
    const sortedPlayers = playersNeedingShortestPath
        .map(player => {
            const response = player.shortestPathToEnd;
            return {
                player,
                pathLength: response === "not-found" || response === "disabled" ? Infinity : response.length,
                submissionIndex: room.submissionOrder.indexOf(player.name)
            };
        })
        .sort((a, b) => {
            if (a.pathLength === b.pathLength) {
                return a.submissionIndex - b.submissionIndex;
            }
            return a.pathLength - b.pathLength;
        });

    // Add sorted players to ranking
    sortedPlayers.forEach(({ player }) => {
        ranking.push(player);
    });

    // Add surrendered players at the end
    ranking.push(...room.surrenderedPlayers);

    return ranking;
}

// Handle messages from the main thread
parentPort.on('message', async (data) => {
    const { type, roomId, startUrl, endUrl, room } = data;
    
    if (type === 'roomSetup') {
        try {
            // Set up cleanup timer
            setRoomCleanupTimer(roomId, () => {
                parentPort.postMessage({ type: 'cleanupCheck', roomId });
            });
            
            // Fetch previews
            const [startPreview, endPreview] = await Promise.all([
                getFirstParagraph(startUrl),
                getFirstParagraph(endUrl)
            ]);
            
            // Send previews back to main thread
            parentPort.postMessage({ 
                type: 'previewsReady', 
                roomId, 
                startPreview, 
                endPreview 
            });
            
            // Fetch shortest paths
            fetchShortestPathsAsync(startUrl, endUrl, (result) => {
                parentPort.postMessage({ 
                    type: 'shortestPathsReady', 
                    roomId, 
                    result 
                });
            });
        } catch (error) {
            parentPort.postMessage({ 
                type: 'error', 
                roomId, 
                error: error.message 
            });
        }
    } else if (type === 'calculateRanking') {
        try {
            const ranking = await calculateRoomRanking(room);
            parentPort.postMessage({
                type: 'rankingReady',
                roomId,
                ranking
            });
        } catch (error) {
            parentPort.postMessage({
                type: 'error',
                roomId,
                error: error.message
            });
        }
    }
}); 