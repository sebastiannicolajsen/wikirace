// List of Wikipedia resource patterns to filter out
const FILTERED_PATTERNS = [
    'File:', 'Special:', 'Wikipedia:', 'Help:', 'Portal:', 'Template:', 
    'Category:', 'Talk:', 'User:', 'User_talk:', 'Wikipedia_talk:', 
    'Template_talk:', 'Help_talk:', 'Category_talk:', 'Portal_talk:',
    'Module:', 'Module_talk:', 'Draft:', 'Draft_talk:', 'TimedText:'
];

/**
 * Filters out Wikipedia resource URLs and ensures no duplicates
 * @param {string[]} urls - Array of Wikipedia URLs to filter
 * @param {number} count - Number of unique URLs requested
 * @returns {string[]} - Filtered array of unique Wikipedia article URLs
 */
export function filterWikiUrls(urls, count) {
    // Convert URLs to lowercase for case-insensitive comparison
    const uniqueUrls = new Set();
    
    // Filter and add valid URLs
    for (const url of urls) {
        // Skip if URL contains any filtered patterns
        if (FILTERED_PATTERNS.some(pattern => 
            url.toLowerCase().includes(`/wiki/${pattern.toLowerCase()}`))) {
            continue;
        }
        
        // Add to set if it's a valid article URL
        if (url.startsWith('https://en.wikipedia.org/wiki/')) {
            uniqueUrls.add(url);
        }
    }
    
    // Convert set back to array
    const filteredUrls = Array.from(uniqueUrls);
    
    // If we have fewer unique URLs than requested, return all of them
    if (filteredUrls.length <= count) {
        return filteredUrls;
    }
    
    // Otherwise, return the requested number of URLs
    return filteredUrls.slice(0, count);
} 