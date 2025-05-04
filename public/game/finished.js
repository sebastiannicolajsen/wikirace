import websocketManager from "/js/websocket.js";
import { urlToTitle } from "/js/wikiHelper.js";
import popupManager from "/js/popup.js";

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
        console.error("Finished handleStateUpdate: Missing state or subpageElement");
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

        // Setup the content and initialize the subpage
        setupFinishedPage(state, subpageElement);

    } catch (error) {
        console.error(`Error processing finished state update:`, error);
        // Optionally display error in the subpageElement
        subpageElement.innerHTML = `<p style="color: red;">Error loading finished view: ${error.message}</p>`;
    }
} 