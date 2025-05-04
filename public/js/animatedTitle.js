// Title animation
function getRandomOrder(length) {
    const order = Array.from({length}, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
}

function animateLetter(order, index) {
    const letters = document.querySelectorAll('.animated-letter');
    if (index >= letters.length) {
        // Start over with a new random order
        setTimeout(() => animateLetter(getRandomOrder(letters.length), 0), 1000);
        return;
    }

    const letter = letters[order[index]];
    const currentSpan = letter.querySelector('.current');
    const nextFont = `font-${Math.floor(Math.random() * 20) + 1}`;
    
    // Create next span
    const nextSpan = document.createElement('span');
    nextSpan.textContent = currentSpan.textContent;
    nextSpan.className = `next ${nextFont}`;
    letter.appendChild(nextSpan);

    // Force a reflow to ensure the next span is positioned below
    nextSpan.offsetHeight;

    // Animate
    currentSpan.classList.remove('current');
    currentSpan.classList.add('prev');
    nextSpan.classList.remove('next');
    nextSpan.classList.add('current');

    // Remove old span after animation
    setTimeout(() => {
        currentSpan.remove();
    }, 800);

    // Animate next letter after 1 second
    setTimeout(() => {
        animateLetter(order, index + 1);
    }, 1000);
}

// Function to initialize the animated title
export function initAnimatedTitle() {
    // Start animation with initial random order
    const letters = document.querySelectorAll('.animated-letter');
    animateLetter(getRandomOrder(letters.length), 0);
}

// Function to get the HTML for the animated title
export function getAnimatedTitleHTML(text = "WikiRace", context = "home") {
    const isRoom = context === "room";
    return `
        <h1 class="wikirace-title ${isRoom ? 'room-title' : ''}">
            ${text.split('').map(letter => `
                <div class="animated-letter"><span class="current font-1">${letter}</span></div>
            `).join('')}
        </h1>
    `;
} 