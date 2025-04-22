#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const db = require('../db');

async function initializeDatabase() {
    try {
        console.log('Initializing database...');
        await db.init();
        
        console.log('Reading cleaned links...');
        const LINKS_FILE = path.join(__dirname, '../../data/cleaned_links.json');
        const linksData = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
        
        console.log(`Found ${linksData.length} links`);
        
        console.log('Inserting links into database...');
        await db.insertLinks(linksData);
        
        console.log('Verifying database...');
        const pair = await db.getRandomPair();
        console.log('Successfully retrieved random pair:');
        console.log('Start:', pair.start.title);
        console.log('End:', pair.end.title);
        
        console.log('\nDatabase initialization completed successfully!');
        
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    } finally {
        await db.close();
    }
}

initializeDatabase(); 