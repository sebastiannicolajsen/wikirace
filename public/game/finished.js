import websocketManager from "/js/websocket.js";
import { urlToTitle } from "/js/wikiHelper.js";
import popupManager from "/js/popup.js";
import GlobeVisualization from "/js/globeVisualization.js";

let globeVisualization = null;

// Wait for THREE.js to be loaded
async function waitForThree() {
    while (!window.THREE) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}

// Function to set up the finished page content
function setupFinishedPage(state, subpageElement) {
    // Update winner info within the subpageElement
    const winnerInfo = subpageElement.querySelector("#winnerInfo");
    if (winnerInfo) {
        if (state.winner) {
            let reasonText = '';
            switch (state.winnerReason) {
                case 'last_player_standing':
                    reasonText = ' (last player standing)';
                    break;
                case 'game_completed':
                    reasonText = ' (reached the target)';
                    break;
            }
            winnerInfo.textContent = `${state.winner} won the game!${reasonText}`;
        } else {
            winnerInfo.textContent = 'The game has ended.';
        }
    }

    // Initialize globe visualization
    const globeContainer = subpageElement.querySelector("#globeContainer");
    if (globeContainer && state.players) {
        // Clean up any previous globe/canvas
        if (globeVisualization) {
            if (globeVisualization.renderer && globeVisualization.renderer.domElement) {
                globeVisualization.renderer.domElement.remove();
            }
            globeVisualization = null;
        }
        if (!globeVisualization) {
            globeVisualization = new GlobeVisualization(globeContainer);
        }
        // Add player paths
        const colors = [
            0xff0000, // Red
            0x00ff00, // Green
            0x0000ff, // Blue
            0xffff00, // Yellow
            0xff00ff, // Magenta
            0x00ffff, // Cyan
            0xffa500, // Orange
            0x800080, // Purple
        ];
        state.players.forEach((player, index) => {
            if (player.path && player.path.length > 0) {
                const color = colors[index % colors.length];
                globeVisualization.addPlayerPath(player.name, player.path, color);
            }
        });
    }

    // Handle return home button
    const returnHomeButton = subpageElement.querySelector("#returnHomeButton");
    if (returnHomeButton) {
        returnHomeButton.addEventListener("click", () => {
            window.location.href = "/";
        });
    }
}

// Exported function to handle incoming state updates
export async function handleStateUpdate(state, subpageElement, timerContainerElement) {
    if (!state || !subpageElement) {
        return;
    }
    
    try {
        // Fetch the finished HTML template
        const response = await fetch('/game/finished.html');
        if (!response.ok) {
            throw new Error(`Failed to fetch finished.html: ${response.statusText}`);
        }
        const html = await response.text();
        
        // Load the HTML into the provided subpage element
        subpageElement.innerHTML = html;

        // Wait for DOM update
        await new Promise(resolve => setTimeout(resolve, 0));

        // Always hide the header when finished page loads
        const headerContainer = document.querySelector('.fixed-header-container');
        if (headerContainer) {
            headerContainer.style.display = 'none';
        }

        // Wait for THREE.js to be loaded before initializing the globe
        await waitForThree();

        // Setup the content and initialize the subpage
        setupFinishedPage(state, subpageElement);

    } catch (error) {
        // Optionally display error in the subpageElement
        subpageElement.innerHTML = `<p style=\"color: red;\">Error loading finished view: ${error.message}</p>`;
    }
} 