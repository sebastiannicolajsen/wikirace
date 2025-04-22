#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const db = require('../db');

const LINKS_FILE = path.join(__dirname, '../../data/wikipedia_links.json');

async function cleanLinks() {
    try {
        console.log('Reading links file...');
        const linksData = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
        
        console.log('Cleaning links...');
        // Flatten the nested structure into a single array of {title, url} objects
        const cleanedLinks = [];
        
        // Process each source page and its links
        for (const [sourceTitle, links] of Object.entries(linksData)) {
            // Add the source page itself
            if (!/^\d+$/.test(sourceTitle)) {
                cleanedLinks.push({
                    title: sourceTitle,
                    url: `https://en.wikipedia.org/wiki/${sourceTitle}`
                });
            }
            
            // Add all the linked pages
            for (const [title, url] of Object.entries(links)) {
                if (!/^\d+$/.test(title)) {
                    cleanedLinks.push({ title, url });
                }
            }
        }
        
        console.log(`Found ${Object.keys(linksData).length} source pages`);
        console.log(`Total links before cleaning: ${Object.values(linksData).reduce((sum, links) => sum + Object.keys(links).length, 0)}`);
        console.log(`Total links after cleaning: ${cleanedLinks.length}`);
        
        // Initialize database
        console.log('Initializing database...');
        await db.init();
        
        // Save links to database
        console.log('Saving links to database...');
        await db.insertLinks(cleanedLinks);
        console.log('Links saved to database successfully');
        
        // Print some statistics
        const uniqueUrls = new Set(cleanedLinks.map(link => link.url));
        const uniqueTitles = new Set(cleanedLinks.map(link => link.title));
        
        console.log('\nStatistics:');
        console.log(`Total links: ${cleanedLinks.length}`);
        console.log(`Unique URLs: ${uniqueUrls.size}`);
        console.log(`Unique titles: ${uniqueTitles.size}`);
        
        // Test random pair retrieval
        console.log('\nTesting random pair retrieval:');
        const randomPair = await db.getRandomPair();
        console.log('Random start:', randomPair.start.title);
        console.log('Random end:', randomPair.end.title);
        
        // Close database connection
        await db.close();
        
    } catch (error) {
        console.error('Error cleaning links:', error);
        process.exit(1);
    }
}

cleanLinks(); 