/**
 * Helper functions for handling Wikipedia URLs and titles
 */

/**
 * Converts a Wikipedia URL to a title
 * @param {string} input - Either a Wikipedia URL or a title
 * @returns {string} The Wikipedia page title
 */
function urlToTitle(input) {
    // If it's already a title (no URL format), return as is
    if (!input.includes('wikipedia.org')) {
        return input;
    }

    try {
        // Extract the title from the URL
        const url = new URL(input);
        const pathParts = url.pathname.split('/');
        
        // Get the last part of the path (the title)
        let title = pathParts[pathParts.length - 1];
        
        // Decode URL-encoded characters
        title = decodeURIComponent(title);
        
        // Replace underscores with spaces
        title = title.replace(/_/g, ' ');
        
        return title;
    } catch (error) {
        console.error('Error converting URL to title:', error);
        return input; // Return original input if conversion fails
    }
}

/**
 * Converts a Wikipedia title to a URL
 * @param {string} input - Either a Wikipedia title or URL
 * @returns {string} The Wikipedia page URL
 */
function titleToUrl(input) {
    // If it's already a URL, return as is
    if (input.includes('wikipedia.org')) {
        return input;
    }

    try {
        // Replace spaces with underscores
        let title = input.replace(/ /g, '_');
        
        // Encode special characters
        title = encodeURIComponent(title);
        
        // Construct the Wikipedia URL
        return `https://en.wikipedia.org/wiki/${title}`;
    } catch (error) {
        console.error('Error converting title to URL:', error);
        return input; // Return original input if conversion fails
    }
}

/**
 * Normalizes a Wikipedia URL or title to a standard format
 * @param {string} input - Either a Wikipedia URL or title
 * @returns {string} The normalized Wikipedia page title
 */
function normalizeWikiInput(input) {
    return urlToTitle(input);
}

/**
 * Validates if a string is a valid Wikipedia URL
 * @param {string} input - The URL to validate
 * @returns {boolean} True if it's a valid Wikipedia URL
 */
function isValidWikiUrl(input) {
    try {
        const url = new URL(input);
        if (!url.hostname.includes('wikipedia.org') || !url.pathname.startsWith('/wiki/')) {
            return false;
        }

        // Check for non-article content
        const path = url.pathname.toLowerCase();
        const invalidPrefixes = [
            '/file:', '/special:', '/help:', '/template:', '/category:', '/portal:', '/wikipedia:',
            '/user:', '/talk:', '/project:', '/module:', '/mediawiki:', '/draft:', '/book:',
            '/wiktionary:', '/wikibooks:', '/wikiquote:', '/wikisource:', '/wikinews:',
            '/wikiversity:', '/wikivoyage:', '/wikidata:', '/commons:', '/meta:', '/incubator:',
            '/outreach:', '/species:', '/media:', '/s:', '/q:', '/n:', '/v:', '/voy:', '/d:',
            '/c:', '/m:', '/i:', '/o:'
        ];

        return !invalidPrefixes.some(prefix => path.includes(prefix));
    } catch {
        return false;
    }
}

/**
 * Validates if a string is a valid Wikipedia title
 * @param {string} input - The title to validate
 * @returns {boolean} True if it's a valid Wikipedia title
 */
function isValidWikiTitle(input) {
    // Basic validation: not empty and doesn't contain invalid characters
    return input && 
           input.length > 0 && 
           !input.includes('://') && 
           !input.includes('wikipedia.org');
}

export {
    urlToTitle,
    titleToUrl,
    normalizeWikiInput,
    isValidWikiUrl,
    isValidWikiTitle
}; 