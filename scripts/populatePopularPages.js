const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Database path
const DB_PATH = path.join(__dirname, '../data/wikirace.db');

// Wikipedia API endpoint for pageviews
const WIKIPEDIA_API = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access';

async function fetchPopularPagesForDay(year, month, day) {
    try {
        const response = await axios.get(`${WIKIPEDIA_API}/${year}/${month}/${day}`, {
            headers: {
                'User-Agent': 'WikiRace/1.0 (https://github.com/yourusername/wikirace; your@email.com)'
            }
        });
        
        if (response.data && response.data.items && response.data.items[0]) {
            return response.data.items[0].articles;
        }
        
        return [];
    } catch (error) {
        console.error(`Error fetching popular pages for ${year}-${month}-${day}:`, error);
        return [];
    }
}

async function fetchPopularPages() {
    try {
        // Get the current date and last month's date
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        
        // Format dates for API
        const year = lastMonth.getFullYear();
        const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
        
        // Fetch data from multiple days
        const allPages = new Map(); // Use Map to deduplicate pages
        
        // Fetch from first 10 days of the month
        for (let day = 1; day <= 10; day++) {
            const dayStr = String(day).padStart(2, '0');
            console.log(`Fetching data for ${year}-${month}-${dayStr}...`);
            
            const pages = await fetchPopularPagesForDay(year, month, dayStr);
            
            // Add pages to map, keeping the highest view count
            for (const page of pages) {
                const existingPage = allPages.get(page.article);
                if (!existingPage || page.views > existingPage.views) {
                    allPages.set(page.article, page);
                }
            }
            
            // If we have enough pages, break
            if (allPages.size >= 10000) {
                break;
            }
        }
        
        // Convert map to array and sort by views
        const sortedPages = Array.from(allPages.values())
            .sort((a, b) => b.views - a.views)
            .slice(0, 10000);
        
        console.log(`Fetched ${sortedPages.length} unique pages`);
        return sortedPages;
        
    } catch (error) {
        console.error('Error fetching popular pages:', error);
        throw error;
    }
}

async function populateDatabase() {
    let db = null;
    try {
        // Delete existing database if it exists
        if (fs.existsSync(DB_PATH)) {
            console.log('Deleting existing database...');
            fs.unlinkSync(DB_PATH);
        }

        // Create new database connection
        db = new sqlite3.Database(DB_PATH);
        
        // Create table
        console.log('Creating new database...');
        await new Promise((resolve, reject) => {
            db.run(`
                CREATE TABLE popular_pages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    url TEXT NOT NULL,
                    views INTEGER NOT NULL,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Fetch popular pages
        console.log('Fetching popular pages from Wikipedia...');
        const popularPages = await fetchPopularPages();
        
        // Begin transaction
        db.run('BEGIN TRANSACTION');
        
        // Prepare insert statement
        const stmt = db.prepare(`
            INSERT INTO popular_pages (title, url, views)
            VALUES (?, ?, ?)
        `);
        
        // Insert each page
        console.log(`Inserting ${popularPages.length} pages...`);
        for (const page of popularPages) {
            const title = page.article.replace(/_/g, ' ');
            const url = `https://en.wikipedia.org/wiki/${page.article}`;
            
            stmt.run(title, url, page.views);
        }
        
        // Finalize statement
        stmt.finalize();
        
        // Commit transaction
        db.run('COMMIT', (err) => {
            if (err) {
                console.error('Error committing transaction:', err);
                db.run('ROLLBACK');
            } else {
                console.log(`Successfully populated database with ${popularPages.length} popular pages`);
            }
        });
        
    } catch (error) {
        console.error('Error populating database:', error);
        if (db) db.run('ROLLBACK');
    } finally {
        // Close database connection
        if (db) db.close();
    }
}

// Run the script
populateDatabase(); 