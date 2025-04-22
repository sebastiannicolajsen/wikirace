#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const LINKS_FILE = path.join(__dirname, '../../data/wikipedia_links.json');
const START_URL = 'https://en.wikipedia.org/wiki/Special:Random';
const MAX_PAGES = 1000;
const BATCH_SIZE = 10; // Reduced batch size
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds between requests
const MAX_RETRIES = 3;

let links = {};
let processedCount = 0;
let isInterrupted = false;

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\nScraping interrupted. Saving progress...');
    isInterrupted = true;
    saveProgress();
});

async function saveProgress() {
    try {
        // Ensure the data directory exists
        const dataDir = path.dirname(LINKS_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Save the current progress
        fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2));
        console.log(`\nSaved ${Object.keys(links).length} links to ${LINKS_FILE}`);
    } catch (error) {
        console.error('Error saving progress:', error);
    }
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapePage(url, retryCount = 0) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        
        // Get the title
        const title = $('#firstHeading').text().trim();
        
        // Get all links
        const pageLinks = {};
        $('#mw-content-text a').each((_, element) => {
            const href = $(element).attr('href');
            if (href && href.startsWith('/wiki/') && !href.includes(':')) {
                const linkTitle = href.split('/wiki/')[1];
                const fullUrl = `https://en.wikipedia.org${href}`;
                pageLinks[linkTitle] = fullUrl;
            }
        });
        
        return { title, links: pageLinks };
    } catch (error) {
        if (error.response && error.response.status === 429) {
            if (retryCount < MAX_RETRIES) {
                const waitTime = Math.pow(2, retryCount) * 5000; // Exponential backoff
                console.log(`Rate limited. Waiting ${waitTime/1000} seconds before retry...`);
                await delay(waitTime);
                return scrapePage(url, retryCount + 1);
            }
        }
        console.error(`Error scraping ${url}:`, error.message);
        return null;
    }
}

async function scrapeWikipedia() {
    console.log('Starting Wikipedia scraping...');
    console.log('Press Ctrl+C to stop and save progress');
    
    while (processedCount < MAX_PAGES && !isInterrupted) {
        const batch = [];
        for (let i = 0; i < BATCH_SIZE && processedCount < MAX_PAGES && !isInterrupted; i++) {
            batch.push(scrapePage(START_URL));
            processedCount++;
            
            // Add delay between requests
            if (i < BATCH_SIZE - 1) {
                await delay(DELAY_BETWEEN_REQUESTS);
            }
        }
        
        const results = await Promise.all(batch);
        for (const result of results) {
            if (result) {
                links[result.title] = result.links;
            }
        }
        
        // Show progress
        const progress = (processedCount / MAX_PAGES * 100).toFixed(1);
        console.log(`Progress: ${progress}% (${processedCount}/${MAX_PAGES} pages)`);
        console.log(`Links collected: ${Object.keys(links).length}`);
        
        // Save progress every batch
        await saveProgress();
        
        // Add a longer delay between batches
        if (!isInterrupted && processedCount < MAX_PAGES) {
            console.log('Taking a short break between batches...');
            await delay(DELAY_BETWEEN_REQUESTS * 2);
        }
    }
    
    if (!isInterrupted) {
        console.log('\nScraping completed!');
    }
}

scrapeWikipedia(); 