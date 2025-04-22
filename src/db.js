const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/wikirace.db');

class Database {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            } else {
                console.log('Connected to database');
            }
        });
    }

    init() {
        return new Promise((resolve, reject) => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS wiki_links (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    url TEXT NOT NULL,
                    UNIQUE(url)
                )
            `, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    insertLinks(links) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare('INSERT OR IGNORE INTO wiki_links (title, url) VALUES (?, ?)');
            
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                
                for (const link of links) {
                    stmt.run(link.title, link.url);
                }
                
                this.db.run('COMMIT', (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
            
            stmt.finalize();
        });
    }

    getRandomPair() {
        console.log('Getting random pair from database...');
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT title, url FROM wiki_links 
                ORDER BY RANDOM() 
                LIMIT 2
            `, (err, rows) => {
                if (err) {
                    console.error('Database error:', err);
                    reject(err);
                } else if (!rows || rows.length < 2) {
                    console.error('Not enough rows returned:', rows);
                    reject(new Error('Failed to get enough random links'));
                } else {
                    console.log('Retrieved rows:', rows);
                    resolve({
                        start: rows[0],
                        end: rows[1]
                    });
                }
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

module.exports = new Database(); 