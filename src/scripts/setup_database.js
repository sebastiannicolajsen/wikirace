#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('../db');

let scrapingProcess = null;

// Handle Ctrl+C
process.on('SIGINT', async () => {
    console.log('\nReceived interrupt signal...');
    if (scrapingProcess) {
        console.log('Stopping scraping process...');
        scrapingProcess.kill('SIGINT');
        // Wait a moment for the scraping process to save its progress
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('Continuing with cleaning and database setup...');
    await cleanAndSetupDatabase();
    process.exit(0);
});

async function runScraping() {
    return new Promise((resolve, reject) => {
        scrapingProcess = spawn('npm', ['run', 'scrape'], {
            stdio: 'inherit',
            shell: true
        });

        scrapingProcess.on('exit', (code) => {
            if (code === 0 || code === 130) { // 130 is SIGINT
                resolve();
            } else {
                reject(new Error(`Scraping process exited with code ${code}`));
            }
        });

        scrapingProcess.on('error', reject);
    });
}

async function cleanAndSetupDatabase() {
    try {
        // Step 1: Initialize the database
        console.log('\nStep 1: Initializing database...');
        await db.init();
        
        // Step 2: Read and clean the links
        console.log('\nStep 2: Reading and cleaning links...');
        const LINKS_FILE = path.join(__dirname, '../../data/cleaned_links.json');
        const linksData = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
        
        console.log(`Found ${linksData.length} links`);
        
        // Step 3: Insert links into database
        console.log('\nStep 3: Inserting links into database...');
        await db.insertLinks(linksData);
        
        // Step 4: Verify the database
        console.log('\nStep 4: Verifying database...');
        const pair = await db.getRandomPair();
        console.log('Successfully retrieved random pair:');
        console.log('Start:', pair.start.title);
        console.log('End:', pair.end.title);
        
        console.log('\nDatabase setup completed successfully!');
        
    } catch (error) {
        console.error('Error during database setup:', error);
        process.exit(1);
    } finally {
        // Close the database connection
        await db.close();
    }
}

async function setupDatabase() {
    try {
        console.log('Starting database setup process...');
        
        // Step 1: Run the scraping script
        console.log('\nStep 1: Running Wikipedia scraping script...');
        console.log('Press Ctrl+C to stop scraping and continue with cleaning and database setup');
        
        try {
            await runScraping();
        } catch (error) {
            if (error.message.includes('130')) {
                console.log('\nScraping interrupted by user. Continuing with cleaning and database setup...');
            } else {
                throw error;
            }
        }
        
        // Continue with cleaning and database setup
        await cleanAndSetupDatabase();
        
    } catch (error) {
        console.error('Error during database setup:', error);
        process.exit(1);
    }
}

setupDatabase(); 