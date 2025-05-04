const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const DB_PATH = path.join(__dirname, '../data/wikirace.db');

// Function to validate Wikipedia URLs
function isValidWikipediaUrl(url) {
  if (!url || !url.startsWith("https://en.wikipedia.org/wiki/")) {
    return false;
  }

  // Check for non-article content
  const path = url.toLowerCase();
  const invalidPrefixes = [
    '/file:', '/special:', '/help:', '/template:', '/category:', '/portal:', '/wikipedia:',
    '/user:', '/talk:', '/project:', '/module:', '/mediawiki:', '/draft:', '/book:',
    '/wiktionary:', '/wikibooks:', '/wikiquote:', '/wikisource:', '/wikinews:',
    '/wikiversity:', '/wikivoyage:', '/wikidata:', '/commons:', '/meta:', '/incubator:',
    '/outreach:', '/species:', '/media:', '/s:', '/q:', '/n:', '/v:', '/voy:', '/d:',
    '/c:', '/m:', '/i:', '/o:'
  ];

  return !invalidPrefixes.some(prefix => path.includes(prefix));
}

// Main cleanup function
async function cleanupInvalidUrls() {
  const db = new sqlite3.Database(DB_PATH);
  
  try {
    // Get all URLs
    const urls = await new Promise((resolve, reject) => {
      db.all('SELECT id, url FROM popular_pages', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log(`Found ${urls.length} URLs in database`);

    // Find invalid URLs
    const invalidUrls = urls.filter(row => !isValidWikipediaUrl(row.url));
    console.log(`Found ${invalidUrls.length} invalid URLs`);

    if (invalidUrls.length > 0) {
      // Begin transaction
      await new Promise((resolve, reject) => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Delete invalid URLs
      for (const row of invalidUrls) {
        await new Promise((resolve, reject) => {
          db.run('DELETE FROM popular_pages WHERE id = ?', [row.id], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        console.log(`Deleted invalid URL: ${row.url}`);
      }

      // Commit transaction
      await new Promise((resolve, reject) => {
        db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log(`Successfully deleted ${invalidUrls.length} invalid URLs`);
    } else {
      console.log('No invalid URLs found');
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
    // Rollback transaction if there was an error
    await new Promise((resolve) => {
      db.run('ROLLBACK', () => resolve());
    });
  } finally {
    // Close database connection
    db.close();
  }
}

// Run the cleanup
cleanupInvalidUrls().catch(console.error); 