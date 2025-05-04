// Word categories for name generation
const roomAdjectives = [
    'Grand', 'Majestic', 'Ancient', 'Mysterious', 'Enchanted', 'Sacred', 'Hidden',
    'Secret', 'Forgotten', 'Legendary', 'Mythical', 'Magical', 'Ethereal', 'Celestial',
    'Cosmic', 'Infinite', 'Eternal', 'Timeless', 'Vast', 'Spacious', 'Expansive',
    'Tranquil', 'Serene', 'Peaceful', 'Harmonious', 'Balanced', 'Perfect', 'Divine',
    'Noble', 'Royal', 'Imperial', 'Regal', 'Stately', 'Elegant', 'Sophisticated',
    'Refined', 'Cultured', 'Civilized', 'Enlightened', 'Wise', 'Prudent', 'Judicious',
    'Discerning', 'Perceptive', 'Insightful', 'Profound', 'Deep', 'Meaningful'
];

const roomNouns = [
    'Chamber', 'Hall', 'Sanctuary', 'Temple', 'Shrine', 'Cathedral', 'Palace',
    'Castle', 'Fortress', 'Citadel', 'Tower', 'Spire', 'Dome', 'Arch',
    'Gateway', 'Portal', 'Threshold', 'Entrance', 'Exit', 'Passage', 'Corridor',
    'Gallery', 'Exhibition', 'Museum', 'Library', 'Archive', 'Repository',
    'Vault', 'Treasury', 'Armory', 'Arsenal', 'Workshop', 'Laboratory', 'Observatory',
    'Academy', 'University', 'College', 'School', 'Institute', 'Center', 'Hub',
    'Nexus', 'Crossroads', 'Junction', 'Intersection', 'Meeting', 'Gathering', 'Assembly'
];

const roomThemes = [
    'Knowledge', 'Wisdom', 'Learning', 'Discovery', 'Exploration', 'Adventure',
    'Quest', 'Journey', 'Voyage', 'Expedition', 'Mission', 'Purpose', 'Destiny',
    'Fate', 'Fortune', 'Chance', 'Opportunity', 'Possibility', 'Potential', 'Promise',
    'Hope', 'Dream', 'Vision', 'Inspiration', 'Creativity', 'Imagination', 'Innovation',
    'Progress', 'Advancement', 'Development', 'Evolution', 'Growth', 'Transformation',
    'Change', 'Renewal', 'Rebirth', 'Revival', 'Renaissance', 'Enlightenment', 'Awakening'
];

const personAdjectives = [
    'Brave', 'Bold', 'Courageous', 'Daring', 'Fearless', 'Valiant', 'Heroic',
    'Noble', 'Honorable', 'Virtuous', 'Righteous', 'Just', 'Fair', 'Equitable',
    'Wise', 'Prudent', 'Judicious', 'Discerning', 'Perceptive', 'Insightful',
    'Clever', 'Intelligent', 'Brilliant', 'Genius', 'Masterful', 'Skilled', 'Talented',
    'Gifted', 'Adept', 'Proficient', 'Expert', 'Master', 'Virtuoso', 'Maestro',
    'Creative', 'Imaginative', 'Innovative', 'Original', 'Unique', 'Distinctive',
    'Remarkable', 'Extraordinary', 'Exceptional', 'Outstanding', 'Superior', 'Excellent'
];

const personNouns = [
    'Explorer', 'Adventurer', 'Pioneer', 'Trailblazer', 'Pathfinder', 'Navigator',
    'Guide', 'Mentor', 'Teacher', 'Scholar', 'Sage', 'Philosopher', 'Thinker',
    'Visionary', 'Dreamer', 'Creator', 'Artist', 'Craftsman', 'Artisan', 'Master',
    'Expert', 'Specialist', 'Professional', 'Practitioner', 'Performer', 'Virtuoso',
    'Genius', 'Prodigy', 'Savant', 'Scholar', 'Academic', 'Researcher', 'Scientist',
    'Inventor', 'Innovator', 'Developer', 'Designer', 'Architect', 'Engineer', 'Builder',
    'Craftsman', 'Artisan', 'Artist', 'Creator', 'Maker', 'Producer', 'Author'
];

const personTitles = [
    'the Wise', 'the Brave', 'the Bold', 'the Fearless', 'the Valiant', 'the Noble',
    'the Honorable', 'the Virtuous', 'the Righteous', 'the Just', 'the Fair',
    'the Clever', 'the Intelligent', 'the Brilliant', 'the Genius', 'the Masterful',
    'the Skilled', 'the Talented', 'the Gifted', 'the Adept', 'the Proficient',
    'the Expert', 'the Master', 'the Virtuoso', 'the Maestro', 'the Creative',
    'the Imaginative', 'the Innovative', 'the Original', 'the Unique', 'the Distinctive',
    'the Remarkable', 'the Extraordinary', 'the Exceptional', 'the Outstanding',
    'the Superior', 'the Excellent', 'the Great', 'the Magnificent', 'the Splendid',
    'the Glorious', 'the Majestic', 'the Regal', 'the Royal', 'the Imperial'
];

// Helper function to get a random item from an array
function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Generate a random number between min and max (inclusive)
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate a room name (2-3 words)
function generateRoomName() {
    const wordCount = getRandomInt(2, 3);
    let name = '';
    
    switch (wordCount) {
        case 2:
            // Combine two different categories
            const categories = [roomAdjectives, roomNouns, roomThemes];
            const category1 = getRandomItem(categories);
            const category2 = getRandomItem(categories.filter(cat => cat !== category1));
            name = `${getRandomItem(category1)} ${getRandomItem(category2)}`;
            break;
        case 3:
            // Combine three different categories
            const cat1 = getRandomItem([roomAdjectives, roomThemes]);
            const cat2 = getRandomItem([roomNouns]);
            const cat3 = getRandomItem([roomThemes, roomAdjectives]);
            name = `${getRandomItem(cat1)} ${getRandomItem(cat2)} ${getRandomItem(cat3)}`;
            break;
    }
    
    return name;
}

// Generate a player name (2-3 words)
function generatePlayerName() {
    const wordCount = getRandomInt(2, 3);
    let name = '';
    
    switch (wordCount) {
        case 2:
            // Combine adjective and noun
            name = `${getRandomItem(personAdjectives)} ${getRandomItem(personNouns)}`;
            break;
        case 3:
            // Combine adjective, noun, and title
            name = `${getRandomItem(personAdjectives)} ${getRandomItem(personNouns)} ${getRandomItem(personTitles)}`;
            break;
    }
    
    return name;
}

// Export the functions
export {
    generateRoomName,
    generatePlayerName
}; 