async function loadCurrentPage(url) {
    try {
        const response = await fetch(`/api/wiki-content?url=${encodeURIComponent(url)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const content = await response.text();
        
        // Create a temporary div to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        
        // Get the body content
        const bodyContent = tempDiv.querySelector('body');
        if (!bodyContent) {
            throw new Error('Could not find body content in response');
        }
        
        // Update the content area with the body content
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = bodyContent.innerHTML;

        // Update page title from the first heading
        const h1 = contentArea.querySelector('h1');
        if (h1) {
            document.getElementById('current-page').textContent = h1.textContent;
        }

        // Add click handlers to all links
        addClickHandlersToLinks();
        
        // Update game state
        updateGameState();
        
    } catch (error) {
        console.error('Error loading page:', error);
        document.getElementById('content-area').innerHTML = `<div class="error">Error loading page: ${error.message}</div>`;
    }
} 