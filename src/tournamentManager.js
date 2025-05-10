const express = require('express');
const router = express.Router();

// In-memory cache for tournaments
const tournaments = new Map();

// Helper function to generate a random tournament ID
function generateTournamentId() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let id;
    do {
        id = "";
        for (let i = 0; i < 4; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (tournaments.has(id));
    return id;
}

// Helper function to validate tournament data
function validateTournamentData(data) {
    if (!data.name || typeof data.name !== 'string') {
        return { valid: false, error: 'Tournament name is required and must be a string' };
    }

    if (!Array.isArray(data.legalPlayerNames)) {
        return { valid: false, error: 'legalPlayerNames must be an array' };
    }

    if (!Array.isArray(data.rounds)) {
        return { valid: false, error: 'rounds must be an array' };
    }

    if (!Array.isArray(data.roundInfo)) {
        return { valid: false, error: 'roundInfo must be an array' };
    }

    if (data.gameStates !== null && !Array.isArray(data.gameStates)) {
        return { valid: false, error: 'gameStates must be null or an array' };
    }

    // Validate game states if they exist
    if (data.gameStates) {
        for (const gameState of data.gameStates) {
            if (!gameState || typeof gameState !== 'object') {
                return { valid: false, error: 'Each game state must be an object' };
            }

            const requiredProps = ['id', 'name', 'state', 'startUrl', 'endUrl', 'creator', 'players', 'config'];
            for (const prop of requiredProps) {
                if (!(prop in gameState)) {
                    return { valid: false, error: `Game state missing required property: ${prop}` };
                }
            }
        }
    }

    return { valid: true };
}

// Function to update a tournament's current room
function setTournamentCurrentRoom(tournamentId, roomId) {
    const tournament = tournaments.get(tournamentId);
    if (!tournament) {
        return false;
    }

    // If there was a previous current room, clear its tournamentId
    if (tournament.currentRoom) {
        const previousRoom = rooms.get(tournament.currentRoom);
        if (previousRoom) {
            previousRoom.tournamentId = null;
        }
    }

    // Set the new current room
    tournament.currentRoom = roomId;
    return true;
}

// Function to get tournament ID from creator name
function getTournamentIdFromCreator(creatorName) {
    if (!creatorName || typeof creatorName !== 'string') {
        return null;
    }
    
    const match = creatorName.match(/\[TMD:([A-Z0-9]{4})\]/);
    if (!match) {
        return null;
    }
    
    const tournamentId = match[1];
    return tournamentId;
}

// Function to close a tournament
function closeTournament(tournamentId) {
    if (!tournaments.has(tournamentId)) {
        return false;
    }
    tournaments.delete(tournamentId);
    return true;
}

// Create a new tournament
router.post('/create', (req, res) => {
    const tournamentData = req.body;
    const validation = validateTournamentData(tournamentData);

    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    const tournamentId = generateTournamentId();
    tournaments.set(tournamentId, {
        ...tournamentData,
        id: tournamentId,
        createdAt: new Date().toISOString(),
        currentRoom: null
    });

    res.json({ 
        status: 'OK',
        id: tournamentId
    });
});

// Close a tournament
router.post('/close/:id', (req, res) => {
    const tournamentId = req.params.id;
    
    if (!tournaments.has(tournamentId)) {
        return res.status(404).json({ error: 'Tournament not found' });
    }

    const success = closeTournament(tournamentId);
    if (success) {
        res.json({ 
            status: 'OK',
            message: 'Tournament closed successfully'
        });
    } else {
        res.status(500).json({ error: 'Failed to close tournament' });
    }
});

// Update an existing tournament
router.put('/update/:id', (req, res) => {
    const tournamentId = req.params.id;
    const tournamentData = req.body;

    if (!tournaments.has(tournamentId)) {
        return res.status(404).json({ error: 'Tournament not found' });
    }

    const validation = validateTournamentData(tournamentData);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    tournaments.set(tournamentId, {
        ...tournamentData,
        id: tournamentId,
        updatedAt: new Date().toISOString()
    });

    res.json({ 
        status: 'OK',
        id: tournamentId
    });
});

// Get tournament information
router.get('/:id', (req, res) => {
    const tournamentId = req.params.id;
    const tournament = tournaments.get(tournamentId);

    if (!tournament) {
        return res.status(404).json({ error: 'Tournament not found' });
    }

    res.json(tournament);
});

module.exports = { 
    router,
    setTournamentCurrentRoom,
    getTournamentIdFromCreator,
    tournaments,
    closeTournament
}; 