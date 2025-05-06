/**
 * Helper functions for Wikipedia URL handling
 */

/**
 * Converts a Wikipedia URL to its title
 * @param {string} input - The Wikipedia URL or title
 * @returns {string} The Wikipedia title
 */
function urlToTitle(input) {
    if (!input) return '';
    
    // If it's already a title (no URL), return it
    if (!input.includes('wikipedia.org')) {
        return input;
    }
    
    // Extract the title from the URL
    const url = new URL(input);
    const path = url.pathname;
    
    // Remove /wiki/ prefix and decode the URL
    const title = decodeURIComponent(path.replace('/wiki/', ''));
    
    // Replace underscores with spaces
    return title.replace(/_/g, ' ');
}

module.exports = {
    urlToTitle
}; 