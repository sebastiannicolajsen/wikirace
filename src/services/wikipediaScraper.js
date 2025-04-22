const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class WikipediaScraper {
    constructor() {
        this.links = new Map(); // title -> url
        this.visited = new Set();
        this.baseUrl = 'https://en.wikipedia.org';
        this.dataFile = path.join(__dirname, '../../data/wikipedia_links.json');
        this.statsFile = path.join(__dirname, '../../data/scraping_stats.json');
        this.ensureDataDirectory();
        this.loadLinks();
        this.loadStats();
    }

    ensureDataDirectory() {
        const dataDir = path.dirname(this.dataFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('Created data directory');
        }
    }

    loadLinks() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                this.links = new Map(Object.entries(data));
                console.log(`Loaded ${this.links.size} Wikipedia links`);
            } else {
                console.log('No existing links file found, starting fresh');
                this.saveLinks(); // Create empty file
            }
        } catch (error) {
            console.error('Error loading links:', error);
            this.saveLinks(); // Create empty file on error
        }
    }

    loadStats() {
        try {
            if (fs.existsSync(this.statsFile)) {
                const stats = JSON.parse(fs.readFileSync(this.statsFile, 'utf8'));
                this.visited = new Set(stats.visited || []);
                console.log(`Loaded ${this.visited.size} visited pages`);
            } else {
                console.log('No existing stats file found, starting fresh');
                this.saveStats(); // Create empty file
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            this.saveStats(); // Create empty file on error
        }
    }

    saveLinks() {
        try {
            const data = Object.fromEntries(this.links);
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
            console.log(`Saved ${this.links.size} Wikipedia links`);
        } catch (error) {
            console.error('Error saving links:', error);
        }
    }

    saveStats() {
        try {
            const stats = {
                visited: Array.from(this.visited),
                lastUpdated: new Date().toISOString(),
                totalLinks: this.links.size,
                lastUrl: this.lastUrl || null
            };
            fs.writeFileSync(this.statsFile, JSON.stringify(stats, null, 2));
        } catch (error) {
            console.error('Error saving stats:', error);
        }
    }

    async scrapePage(url) {
        if (this.visited.has(url)) return;
        this.visited.add(url);
        this.lastUrl = url; // Track the last URL for resuming

        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'WikiRace Scraper (https://github.com/yourusername/wikirace)'
                }
            });
            const $ = cheerio.load(response.data);
            
            // Get the page title
            const title = $('#firstHeading').text().trim();
            if (title && !this.links.has(title)) {
                this.links.set(title, url);
            }

            // Find all Wikipedia links in the main content
            $('#mw-content-text a').each((_, element) => {
                const href = $(element).attr('href');
                if (href && href.startsWith('/wiki/') && 
                    !href.includes(':') && // Exclude special pages
                    !href.includes('#')) { // Exclude anchors
                    const linkTitle = $(element).attr('title');
                    const fullUrl = `${this.baseUrl}${href}`;
                    if (linkTitle && !this.links.has(linkTitle)) {
                        this.links.set(linkTitle, fullUrl);
                    }
                }
            });

            // Save periodically
            if (this.links.size % 100 === 0) {
                this.saveLinks();
                this.saveStats();
                console.log(`Progress: ${this.visited.size} pages visited, ${this.links.size} links found`);
            }
        } catch (error) {
            console.error(`Error scraping ${url}:`, error);
        }
    }

    async startScraping(startUrl = 'https://en.wikipedia.org/wiki/Main_Page', maxPages = 1000) {
        // If we have a lastUrl in stats, resume from there
        const stats = JSON.parse(fs.readFileSync(this.statsFile, 'utf8'));
        const resumeUrl = stats.lastUrl || startUrl;
        
        console.log(`Starting scraping from ${resumeUrl}`);
        console.log('Press Ctrl+C to stop and save progress');
        
        try {
            await this.scrapePage(resumeUrl);
            let currentPage = 0;

            while (currentPage < maxPages && this.visited.size < this.links.size) {
                const unvisited = Array.from(this.links.values())
                    .filter(url => !this.visited.has(url));
                
                if (unvisited.length === 0) break;

                // Process in batches of 5 to be more gentle
                const batch = unvisited.slice(0, 5);
                await Promise.all(batch.map(url => this.scrapePage(url)));
                currentPage += batch.length;

                // Add a small delay between batches
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            this.saveLinks();
            this.saveStats();
            return this.links;
        } catch (error) {
            console.error('Error during scraping:', error);
            return this.links;
        }
    }

    getRandomLinks(count = 10) {
        const allLinks = Array.from(this.links.entries());
        const randomLinks = [];
        
        for (let i = 0; i < count && allLinks.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * allLinks.length);
            const [title, url] = allLinks.splice(randomIndex, 1)[0];
            randomLinks.push({ title, url });
        }
        
        return randomLinks;
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nSaving progress before exit...');
    const scraper = new WikipediaScraper();
    scraper.saveLinks();
    scraper.saveStats();
    console.log(`Saved ${scraper.links.size} links and ${scraper.visited.size} visited pages`);
    process.exit(0);
});

module.exports = new WikipediaScraper(); 