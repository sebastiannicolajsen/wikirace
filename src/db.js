const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.NODE_ENV === 'test' 
    ? ':memory:' 
    : path.join(__dirname, '../data/wikirace.db');

let db = null;

function getDb() {
    if (!db) {
        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            }
        });
    }
    return db;
}

async function closeDb() {
    if (db) {
        return new Promise((resolve, reject) => {
            db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    db = null;
                    resolve();
                }
            });
        });
    }
    return Promise.resolve();
}

async function init() {
    const db = getDb();
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Create popular_pages table if it doesn't exist
            db.run(`CREATE TABLE IF NOT EXISTS popular_pages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                views INTEGER NOT NULL,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    });
}

async function insertLinks(links) {
    const db = getDb();
    return new Promise((resolve, reject) => {
        const stmt = db.prepare('INSERT INTO random_pairs (start, end) VALUES (?, ?)');
        
        links.forEach(link => {
            stmt.run(link.start, link.end, (err) => {
                if (err) {
                    console.error('Error inserting link:', err);
                }
            });
        });

        stmt.finalize((err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

async function getRandomPair() {
    const db = getDb();
    return new Promise((resolve, reject) => {
        db.get('SELECT id, rowid, title, url FROM popular_pages ORDER BY RANDOM() LIMIT 1', (err, row) => {
            if (err) {
                reject(err);
            } else if (!row) {
                reject(new Error('No popular pages found in database. Please run npm run populate-popular first.'));
            } else {
                // Use rowid if id is not available
                const id = row.id || row.rowid;
                if (!id) {
                    reject(new Error('Database row missing id field'));
                    return;
                }
                resolve({
                    id: id,
                    title: row.title,
                    url: row.url
                });
            }
        });
    });
}

async function getUrlById(id) {
    const db = getDb();
    return new Promise((resolve, reject) => {
        // Convert id to number if it's a string
        const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
        if (isNaN(numericId)) {
            reject(new Error('Invalid ID format'));
            return;
        }
        db.get('SELECT id, title, url FROM popular_pages WHERE id = ?', [numericId], (err, row) => {
            if (err) {
                console.error('Database error:', err);
                reject(err);
            } else if (!row) {
                console.log('No row found for ID:', numericId);
                reject(new Error('URL not found'));
            } else {
                resolve({
                    id: row.id,
                    title: row.title,
                    url: row.url
                });
            }
        });
    });
}

async function storeUrl(url) {
    const db = getDb();
    return new Promise((resolve, reject) => {
        // First check if the URL already exists
        db.get('SELECT id, title, url FROM popular_pages WHERE url = ?', [url], (err, row) => {
            if (err) {
                reject(err);
            } else if (row) {
                // URL already exists, return it
                resolve({
                    id: row.id,
                    title: row.title,
                    url: row.url
                });
            } else {
                // URL doesn't exist, insert it
                const title = url.split('/').pop().replace(/_/g, ' ');
                db.run('INSERT INTO popular_pages (title, url, views) VALUES (?, ?, 0)', [title, url], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            title: title,
                            url: url
                        });
                    }
                });
            }
        });
    });
}

module.exports = {
    getDb,
    getRandomPair,
    closeDb,
    init,
    insertLinks,
    getUrlById,
    storeUrl
}; 