#!/usr/bin/env node

const db = require('../db');

async function countLinks() {
    try {
        await db.init();
        
        // Get total count
        const count = await new Promise((resolve, reject) => {
            db.db.get('SELECT COUNT(*) as count FROM wiki_links', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        
        console.log(`Total links in database: ${count}`);
        
        // Get some sample titles
        const samples = await new Promise((resolve, reject) => {
            db.db.all('SELECT title FROM wiki_links ORDER BY RANDOM() LIMIT 5', (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.title));
            });
        });
        
        console.log('\nSample titles:');
        samples.forEach(title => console.log(`- ${title}`));
        
    } catch (error) {
        console.error('Error counting links:', error);
    } finally {
        await db.close();
    }
}

countLinks(); 