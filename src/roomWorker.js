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

// Handle messages from the main thread
parentPort.on('message', async (data) => {
    const { type, roomId, startUrl, endUrl } = data;
    
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
    }
}); 