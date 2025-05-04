export default class PlayerList {
    constructor(container, websocketManager, isCreator = false) {
        this.container = container;
        this.websocketManager = websocketManager;
        this.isCreator = isCreator;
        this.players = new Map();
    }

    update(gameState) {
        this.container.innerHTML = '';
        
        // Create player list container
        const playerList = document.createElement('div');
        playerList.className = 'player-list';
        
        // Add each player to the list
        gameState.players.forEach((playerData, playerName) => {
            const playerElement = document.createElement('div');
            playerElement.className = 'player-item';
            
            // Player name
            const nameElement = document.createElement('span');
            nameElement.className = 'player-name';
            nameElement.textContent = playerName;
            playerElement.appendChild(nameElement);
            
            // Add kick button for creator
            if (this.isCreator && playerName !== gameState.creator) {
                const kickButton = document.createElement('button');
                kickButton.className = 'kick-button';
                kickButton.innerHTML = '×';
                kickButton.title = 'Kick player';
                kickButton.addEventListener('click', () => {
                    this.websocketManager.sendKickPlayer(playerName);
                });
                playerElement.appendChild(kickButton);
            }
            
            playerList.appendChild(playerElement);
        });
        
        this.container.appendChild(playerList);
    }
} 