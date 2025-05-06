import { generateRoomName, generatePlayerName } from './nameGenerator.js';
import popupManager from './popup.js';
import { urlToTitle, isValidWikiUrl } from './wikiHelper.js';

class CreateRoomManager {
    constructor() {
        this.form = document.getElementById('createForm');
        this.roomNameInput = document.getElementById('roomName');
        this.playerNameInput = document.getElementById('playerName');
        this.startUrlInput = document.getElementById('startUrl');
        this.endUrlInput = document.getElementById('endUrl');
        
        this.startUrlHistory = [];
        this.endUrlHistory = [];
        this.currentStartIndex = -1;
        this.currentEndIndex = -1;
        this.descriptions = {};
        
        this.initialize();
    }

    async initialize() {
        this.initializePlaceholders();
        this.setupEventListeners();
        await this.parseUrlParameters();
        // If S or E are missing, initialize only the missing one(s)
        const urlParams = new URLSearchParams(window.location.search);
        const hasStart = urlParams.has('S');
        const hasEnd = urlParams.has('E');
        if (!hasStart && !hasEnd) {
            await this.loadInitialLinks();
        } else if (!hasStart) {
            await this.loadRandomUrl('start');
        } else if (!hasEnd) {
            await this.loadRandomUrl('end');
        }
        await this.loadDescriptions();
        this.initializeInfoPopups();
    }

    initializePlaceholders() {
        // Set initial placeholders
        this.roomNameInput.placeholder = generateRoomName();
        this.playerNameInput.placeholder = generatePlayerName();
    }

    setupEventListeners() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        
        // Start URL navigation
        document.getElementById('prevStartUrl').addEventListener('click', () => {
            this.goToPrevious('start');
        });
        document.getElementById('nextStartUrl').addEventListener('click', () => {
            this.goToNext('start');
        });
        
        // End URL navigation
        document.getElementById('prevEndUrl').addEventListener('click', () => {
            this.goToPrevious('end');
        });
        document.getElementById('nextEndUrl').addEventListener('click', () => {
            this.goToNext('end');
        });
        
        // Handle input changes
        this.startUrlInput.addEventListener('input', (e) => {
            // Just store the raw input value
            const value = e.target.value;
            e.target.dataset.rawValue = value;
        });
        this.endUrlInput.addEventListener('input', (e) => {
            // Just store the raw input value
            const value = e.target.value;
            e.target.dataset.rawValue = value;
        });

        // Add blur event listeners for validation
        this.startUrlInput.addEventListener('blur', (e) => {
            const value = e.target.dataset.rawValue || e.target.value;
            this.handleInputChange({ target: { value } }, 'start');
        });
        this.endUrlInput.addEventListener('blur', (e) => {
            const value = e.target.dataset.rawValue || e.target.value;
            this.handleInputChange({ target: { value } }, 'end');
        });

        // Handle sliders
        this.setupSlider('countdownTime', 5, 35, 30);
        this.setupSlider('additions_timer', 5, 60, 30);

        // Handle icon buttons
        this.setupIconButtons('role', ['player', 'observer']);
        this.setupIconButtons('continuation', ['democratic', 'creator', 'automatic']);
        this.setupIconButtons('chooser', ['player', 'random']);

        // Setup effect cards
        this.setupEffectCards();

        // Setup share button
        const shareButton = document.getElementById('shareSetup');
        shareButton.addEventListener('click', () => {
            const formData = this.getFormData();
            const shareUrl = this.generateShareUrl(formData);
            this.copyToClipboard(shareUrl);
            
            // Show brief popup
            popupManager.showInfo('Room setup copied to clipboard!', 'success', 750);
        });
    }

    setupSlider(id, min, max, defaultValue) {
        const slider = document.getElementById(id);
        const valueDisplay = slider.nextElementSibling;

        if (!slider || !valueDisplay) {
            return;
        }

        // Update value display
        const updateValue = () => {
            valueDisplay.textContent = slider.value;
        };

        // Handle slider input
        slider.addEventListener('input', updateValue);

        // Set initial value
        slider.value = defaultValue;
        updateValue();
    }

    setupIconButtons(name, values) {
        const buttonGroup = document.querySelector(`.icon-button-group input[name="${name}"]`)?.closest('.icon-button-group');
        if (!buttonGroup) {
            return;
        }

        const hiddenInput = buttonGroup.querySelector(`input[name="${name}"]`);
        if (!hiddenInput) {
            return;
        }

        // Remove active class from all buttons first
        buttonGroup.querySelectorAll('.icon-button').forEach(btn => btn.classList.remove('active'));

        // Set initial value to first value in the array
        hiddenInput.value = values[0];
        const initialButton = buttonGroup.querySelector(`.icon-button[data-value="${values[0]}"]`);
        if (initialButton) {
            initialButton.classList.add('active');
            const stateSpan = initialButton.querySelector('.effect-state');
            if (stateSpan) {
                stateSpan.textContent = values[0] === 'true' ? 'On' : 'Off';
            }
        }

        buttonGroup.querySelectorAll('.icon-button').forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons in this group
                buttonGroup.querySelectorAll('.icon-button').forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                button.classList.add('active');
                
                // Update hidden input value
                hiddenInput.value = button.dataset.value;

                // Update state text
                const stateSpan = button.querySelector('.effect-state');
                if (stateSpan) {
                    stateSpan.textContent = button.dataset.value === 'true' ? 'On' : 'Off';
                }
            });
        });
    }

    async loadInitialLinks() {
        try {
            // Check if we have URL parameters first
            const urlParams = new URLSearchParams(window.location.search);
            const startUrlId = urlParams.get('S');
            const endUrlId = urlParams.get('E');

            // Load start URL
            if (startUrlId) {
                // Use the provided start URL ID
                const startResponse = await fetch(`/api/url/${startUrlId}`);
                if (!startResponse.ok) {
                    throw new Error(`Failed to fetch start URL: ${startResponse.status} ${startResponse.statusText}`);
                }
                const startData = await startResponse.json();
                if (!startData.url) {
                    throw new Error(`Invalid start URL response: ${JSON.stringify(startData)}`);
                }
                const startUrl = startData.url;
                this.startUrlHistory = [startUrl];
                this.currentStartIndex = 0;
                this.startUrlInput.value = startData.title || urlToTitle(startUrl);
                this.startUrlInput.dataset.url = startUrl;
                this.startUrlInput.dataset.urlId = startUrlId;
            } else {
                // Load random start URL
                const startResponse = await fetch('/api/random-url');
                if (!startResponse.ok) {
                    throw new Error(`Failed to fetch start URL: ${startResponse.status} ${startResponse.statusText}`);
                }
                const startData = await startResponse.json();
                if (!startData.url || !startData.id) {
                    throw new Error(`Invalid start URL response: ${JSON.stringify(startData)}`);
                }
                const startUrl = startData.url;
                this.startUrlHistory = [startUrl];
                this.currentStartIndex = 0;
                this.startUrlInput.value = startData.title || urlToTitle(startUrl);
                this.startUrlInput.dataset.url = startUrl;
                this.startUrlInput.dataset.urlId = startData.id;
            }
            
            // Load end URL
            if (endUrlId) {
                // Use the provided end URL ID
                const endResponse = await fetch(`/api/url/${endUrlId}`);
                if (!endResponse.ok) {
                    throw new Error(`Failed to fetch end URL: ${endResponse.status} ${endResponse.statusText}`);
                }
                const endData = await endResponse.json();
                if (!endData.url) {
                    throw new Error(`Invalid end URL response: ${JSON.stringify(endData)}`);
                }
                const endUrl = endData.url;
                this.endUrlHistory = [endUrl];
                this.currentEndIndex = 0;
                this.endUrlInput.value = endData.title || urlToTitle(endUrl);
                this.endUrlInput.dataset.url = endUrl;
                this.endUrlInput.dataset.urlId = endUrlId;
            } else {
                // Load random end URL
                const endResponse = await fetch('/api/random-url');
                if (!endResponse.ok) {
                    throw new Error(`Failed to fetch end URL: ${endResponse.status} ${endResponse.statusText}`);
                }
                const endData = await endResponse.json();
                if (!endData.url || !endData.id) {
                    throw new Error(`Invalid end URL response: ${JSON.stringify(endData)}`);
                }
                const endUrl = endData.url;
                this.endUrlHistory = [endUrl];
                this.currentEndIndex = 0;
                this.endUrlInput.value = endData.title || urlToTitle(endUrl);
                this.endUrlInput.dataset.url = endUrl;
                this.endUrlInput.dataset.urlId = endData.id;
            }

            // Update button states
            this.updateButtonStates('start');
            this.updateButtonStates('end');
        } catch (error) {
            popupManager.showInfo(`Failed to load initial links: ${error.message}`);
        }
    }

    updateButtonStates(type) {
        const currentIndex = type === 'start' ? this.currentStartIndex : this.currentEndIndex;
        const history = type === 'start' ? this.startUrlHistory : this.endUrlHistory;
        
        const prevButton = document.getElementById(`prev${type === 'start' ? 'Start' : 'End'}Url`);
        const nextButton = document.getElementById(`next${type === 'start' ? 'Start' : 'End'}Url`);
        
        if (prevButton && nextButton) {
            // Previous button is disabled only when at the start of history
            prevButton.disabled = currentIndex <= 0;
            
            // Next button is never disabled - it should always be able to fetch a new URL
            nextButton.disabled = false;
        }
    }

    async handleInputChange(event, type) {
        const value = event.target.value;
        const input = type === 'start' ? this.startUrlInput : this.endUrlInput;
        const history = type === 'start' ? this.startUrlHistory : this.endUrlHistory;
        const currentIndex = type === 'start' ? this.currentStartIndex : this.currentEndIndex;

        if (isValidWikiUrl(value)) {
            try {
                // Store the URL in the database
                const response = await fetch('/api/url', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ url: value })
                });

                if (!response.ok) {
                    throw new Error('Failed to store URL');
                }

                const data = await response.json();
                
                // Only add to history if it's a new URL
                if (currentIndex === history.length - 1 || value !== history[currentIndex]) {
                    history.push(value);
                    if (type === 'start') {
                        this.currentStartIndex = history.length - 1;
                    } else {
                        this.currentEndIndex = history.length - 1;
                    }
                    input.value = urlToTitle(value);
                    input.dataset.url = value;
                    input.dataset.urlId = data.id;
                    this.updateButtonStates(type);
                }
            } catch (error) {
                popupManager.showInfo('Failed to store URL. Please try again.');
                await this.loadRandomUrl(type);
            }
        } else {
            // If the URL is invalid, load a random one
            await this.loadRandomUrl(type);
        }
    }

    async loadRandomUrl(type, showPopup = false) {
        const input = type === 'start' ? this.startUrlInput : this.endUrlInput;
        const history = type === 'start' ? this.startUrlHistory : this.endUrlHistory;
        try {
            const response = await fetch('/api/random-url');
            if (!response.ok) {
                throw new Error('Failed to fetch random URL');
            }
            const data = await response.json();
            if (!data.url || !data.id) {
                throw new Error('Invalid response from server');
            }
            history.push(data.url);
            const newIndex = history.length - 1;
            input.value = data.title || urlToTitle(data.url);
            input.dataset.url = data.url;
            input.dataset.urlId = data.id;
            if (type === 'start') {
                this.currentStartIndex = newIndex;
            } else {
                this.currentEndIndex = newIndex;
            }
            this.updateButtonStates(type);
            if (showPopup) {
                popupManager.showInfo('Invalid URL replaced with a random Wikipedia article.', 'info', 2000);
            }
        } catch (error) {
            popupManager.showInfo('Failed to load random URL. Please try again.');
        }
    }

    goToPrevious(type) {
        const history = type === 'start' ? this.startUrlHistory : this.endUrlHistory;
        const currentIndex = type === 'start' ? this.currentStartIndex : this.currentEndIndex;
        const input = type === 'start' ? this.startUrlInput : this.endUrlInput;

        if (currentIndex > 0) {
            const newIndex = currentIndex - 1;
            const url = history[newIndex];
            input.value = urlToTitle(url);
            input.dataset.url = url;
            
            if (type === 'start') {
                this.currentStartIndex = newIndex;
            } else {
                this.currentEndIndex = newIndex;
            }
            
            this.updateButtonStates(type);
        }
    }

    async goToNext(type) {
        const history = type === 'start' ? this.startUrlHistory : this.endUrlHistory;
        const currentIndex = type === 'start' ? this.currentStartIndex : this.currentEndIndex;
        const input = type === 'start' ? this.startUrlInput : this.endUrlInput;

        try {
            if (currentIndex < history.length - 1) {
                // If we have history items ahead, go to the next one
                const newIndex = currentIndex + 1;
                const url = history[newIndex];
                input.value = urlToTitle(url);
                input.dataset.url = url;
                
                if (type === 'start') {
                    this.currentStartIndex = newIndex;
                } else {
                    this.currentEndIndex = newIndex;
                }
            } else {
                // If we're at the end of history, fetch a new URL
                const response = await fetch('/api/random-url');
                if (!response.ok) {
                    throw new Error('Failed to fetch new URL');
                }
                const data = await response.json();
                if (!data.url || !data.id) {
                    throw new Error('Invalid response from server');
                }
                const newUrl = data.url;
                
                // Add the new URL to history
                history.push(newUrl);
                const newIndex = history.length - 1;
                
                // Update the input with the new URL
                input.value = data.title || urlToTitle(newUrl);
                input.dataset.url = newUrl;
                input.dataset.urlId = data.id;
                
                if (type === 'start') {
                    this.currentStartIndex = newIndex;
                } else {
                    this.currentEndIndex = newIndex;
                }
            }
            
            // Update button states after any change
            this.updateButtonStates(type);
        } catch (error) {
            console.error('Error in goToNext:', error);
            popupManager.showInfo('Failed to load next link. Please try again.');
        }
    }

    updateInput(type) {
        const input = type === 'start' ? this.startUrlInput : this.endUrlInput;
        const history = type === 'start' ? this.startUrlHistory : this.endUrlHistory;
        const currentIndex = type === 'start' ? this.currentStartIndex : this.currentEndIndex;
        
        const currentUrl = history[currentIndex];
        if (currentUrl) {
            // Display the title but store the URL
            input.value = urlToTitle(currentUrl);
            input.dataset.url = currentUrl;
        }
    }

    async handleSubmit(e) {
        e.preventDefault();

        // Show loading state
        const submitButton = this.form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.classList.add('loading');
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Room...';

        try {
            // Get effect card counts
            const bombCount = document.getElementById('bombCountContainer').style.display !== 'none' 
                ? parseInt(document.querySelector('#bombCountContainer .count-value').textContent) 
                : 0;
            const returnCount = document.getElementById('returnCountContainer').style.display !== 'none'
                ? parseInt(document.querySelector('#returnCountContainer .count-value').textContent)
                : 0;
            const swapCount = document.getElementById('swapCountContainer').style.display !== 'none'
                ? parseInt(document.querySelector('#swapCountContainer .count-value').textContent)
                : 0;

            // Get effect card settings
            const timerCount = document.getElementById('timerCountContainer').style.display !== 'none'
                ? parseInt(document.querySelector('#timerCountContainer .count-value').textContent)
                : 0;
            const exposureCount = document.getElementById('exposureCountContainer').style.display !== 'none'
                ? parseInt(document.querySelector('#exposureCountContainer .count-value').textContent)
                : 0;

            // Only include enabled additions in the config
            const additions = {};
            if (document.querySelector('button[name="bombEnabled"]').dataset.value === 'true') {
                additions.bomb = bombCount;
            }
            if (document.querySelector('button[name="returnEnabled"]').dataset.value === 'true') {
                additions.return = returnCount;
            }
            if (document.querySelector('button[name="swapEnabled"]').dataset.value === 'true') {
                additions.swap = swapCount;
            }

            const formData = {
                name: this.roomNameInput.value || this.roomNameInput.placeholder,
                playerName: this.playerNameInput.value || this.playerNameInput.placeholder,
                startUrl: this.startUrlInput.dataset.url,
                endUrl: this.endUrlInput.dataset.url,
                countdownTime: parseInt(document.getElementById('countdownTime').value),
                role: document.querySelector('input[name="role"]').value,
                config: {
                    continuation: document.querySelector('input[name="continuation"]').value,
                    chooser: document.querySelector('input[name="chooser"]').value,
                    additions,
                    additions_creatorGive: document.querySelector('input[name="additions_creatorGive"]').value === 'true',
                    additions_obtainWithExposure: exposureCount,
                    additions_obtainWithTimer: timerCount,
                    additions_application: document.querySelector('input[name="additions_application"]').value === 'true' ? 'unlimited' : 'once',
                    additions_callType: document.querySelector('input[name="additions_callType"]').value,
                    additions_timer: parseInt(document.getElementById('additions_timer').value),
                    additions_multiplePerRound: document.querySelector('input[name="additions_multiplePerRound"]').value === 'true'
                }
            };

            const response = await fetch('/api/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create room');
            }

            const data = await response.json();
            
            // Store player name and type in session storage
            sessionStorage.setItem('playerName', formData.playerName);
            sessionStorage.setItem('playerType', formData.role);
            
            // Redirect to room page
            window.location.href = `/room/${data.id}`;
        } catch (error) {
            // Reset button state
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
            submitButton.textContent = originalButtonText;
            popupManager.showInfo(error.message);
        }
    }

    setupEffectCards() {
        // Container toggle
        const toggleButton = document.querySelector('.effect-cards-toggle');
        const container = document.querySelector('.effect-cards-container');
        
        toggleButton.addEventListener('click', () => {
            container.classList.toggle('active');
        });

        // Setup effect card toggles
        const effects = ['bomb', 'return', 'swap'];
        const effectSettings = document.querySelector('.effect-settings');

        // Setup main effect cards
        effects.forEach(effect => {
            const button = document.querySelector(`.icon-button[name="${effect}Enabled"]`);
            const countContainer = document.getElementById(`${effect}CountContainer`);
            const countValue = countContainer.querySelector('.count-value');
            const minusBtn = countContainer.querySelector('.minus');
            const plusBtn = countContainer.querySelector('.plus');
            let count = 0;

            // Toggle effect
            button.addEventListener('click', () => {
                const isEnabled = button.dataset.value === 'true';
                button.dataset.value = !isEnabled;
                const stateSpan = button.querySelector('.effect-state');
                stateSpan.textContent = isEnabled ? 'Off' : 'On';
                button.classList.toggle('active');

                // Update hidden input
                const hiddenInput = button.parentElement.querySelector(`input[name="${effect}Enabled"]`);
                hiddenInput.value = !isEnabled;

                // Show/hide count container based on enabled state
                countContainer.style.display = !isEnabled ? 'flex' : 'none';
                if (isEnabled) {
                    count = 0;
                    countValue.textContent = '0';
                } else {
                    // When enabling, set count to 1
                    count = 1;
                    countValue.textContent = '1';
                }

                // Check if any effects are enabled
                const anyEnabled = effects.some(e => {
                    const btn = document.querySelector(`.icon-button[name="${e}Enabled"]`);
                    return btn && btn.dataset.value === 'true';
                });
                effectSettings.style.display = anyEnabled ? 'block' : 'none';
            });

            // Count buttons
            minusBtn.addEventListener('click', () => {
                if (count > 0) {  // Allow going down to 0 for bomb/swap/return
                    count--;
                    countValue.textContent = count;
                }
            });

            plusBtn.addEventListener('click', () => {
                count++;
                countValue.textContent = count;
            });
        });

        // Setup additional settings
        const additionalSettings = [
            { name: 'additions_obtainWithTimer', container: 'timerCountContainer' },
            { name: 'additions_obtainWithExposure', container: 'exposureCountContainer' }
        ];

        additionalSettings.forEach(setting => {
            const button = document.querySelector(`.icon-button[name="${setting.name}"]`);
            const countContainer = document.getElementById(setting.container);
            const countValue = countContainer.querySelector('.count-value');
            const minusBtn = countContainer.querySelector('.minus');
            const plusBtn = countContainer.querySelector('.plus');
            let count = 1;  // Start at 1 for timer/exposure

            // Toggle setting
            button.addEventListener('click', () => {
                const isEnabled = button.dataset.value === 'true';
                button.dataset.value = !isEnabled;
                const stateSpan = button.querySelector('.effect-state');
                stateSpan.textContent = isEnabled ? 'Off' : 'On';
                button.classList.toggle('active');

                // Update hidden input
                const hiddenInput = button.parentElement.querySelector(`input[name="${setting.name}"]`);
                hiddenInput.value = !isEnabled;

                // Show/hide count container based on enabled state
                countContainer.style.display = !isEnabled ? 'flex' : 'none';
                if (isEnabled) {
                    count = 0;
                    countValue.textContent = '0';
                } else {
                    // When enabling, set count to 1
                    count = 1;
                    countValue.textContent = '1';
                }
            });

            // Count buttons
            minusBtn.addEventListener('click', () => {
                if (count > 1) {  // Keep minimum at 1 for timer/exposure
                    count--;
                    countValue.textContent = count;
                }
            });

            plusBtn.addEventListener('click', () => {
                count++;
                countValue.textContent = count;
            });
        });

        // Setup effect settings
        this.setupIconButtons('additions_creatorGive', ['true', 'false']);
        this.setupIconButtons('additions_multiplePerRound', ['false', 'true']);
        this.setupIconButtons('additions_application', ['false', 'true']);
        this.setupIconButtons('additions_callType', ['free_for_all', 'round_robin']);
    }

    async loadDescriptions() {
        try {
            const response = await fetch('/js/createRoomDescriptions.json');
            if (!response.ok) {
                throw new Error('Failed to load descriptions');
            }
            this.descriptions = await response.json();
            this.updateLabels();
            this.initializeInfoPopups();
        } catch (error) {
            console.error('Error loading descriptions:', error);
        }
    }

    updateLabels() {
        // Update all form labels with their titles from descriptions
        document.querySelectorAll('.info-icon').forEach(icon => {
            const infoKey = icon.getAttribute('data-info');
            const info = this.descriptions[infoKey];
            if (info) {
                // Get the label element (parent of the info icon)
                const label = icon.closest('.form-label');
                if (label) {
                    // Get the text node (first child of the label)
                    const textNode = label.firstChild;
                    if (textNode) {
                        // Update the text content
                        textNode.textContent = info.title;
                    }
                }
            }
        });
    }

    initializeInfoPopups() {
        const infoIcons = document.querySelectorAll('.info-icon');
        const popup = document.getElementById('infoPopup');
        const popupTitle = popup.querySelector('.info-popup-title');
        const popupText = popup.querySelector('.info-popup-text');
        const closeButton = popup.querySelector('.info-popup-close');

        const showPopup = (info) => {
            if (info && info.title && info.description) {
                popupTitle.textContent = info.title;
                popupText.textContent = info.description;
                popup.classList.add('visible');
            }
        };

        const hidePopup = () => {
            popup.classList.remove('visible');
        };

        infoIcons.forEach(icon => {
            // Handle both click and touch events
            const handleInteraction = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const infoKey = icon.getAttribute('data-info');
                const info = this.descriptions[infoKey];
                showPopup(info);
            };

            icon.addEventListener('click', handleInteraction);
            icon.addEventListener('touchend', handleInteraction);
        });

        // Close popup when clicking/touching the close button
        const handleClose = (e) => {
            e.preventDefault();
            e.stopPropagation();
            hidePopup();
        };
        closeButton.addEventListener('click', handleClose);
        closeButton.addEventListener('touchend', handleClose);

        // Close popup when clicking/touching outside
        const handleOutsideClick = (e) => {
            if (e.target === popup) {
                hidePopup();
            }
        };
        popup.addEventListener('click', handleOutsideClick);
        popup.addEventListener('touchend', handleOutsideClick);

        // Close popup when pressing Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && popup.classList.contains('visible')) {
                hidePopup();
            }
        });
    }

    async parseUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Parse room name (R)
        const roomName = urlParams.get('R');
        if (roomName) {
            this.roomNameInput.value = roomName;
        }
        
        // Parse player name (N)
        const playerName = urlParams.get('N');
        if (playerName) {
            this.playerNameInput.value = playerName;
        }

        // Helper to load either a Wikipedia URL or an ID
        const loadUrl = async (param, type) => {
            const value = urlParams.get(param);
            let success = false;
            let triedUrl = false;
            let triedId = false;
            if (value) {
                if (isValidWikiUrl(value)) {
                    // It's a full Wikipedia URL
                    triedUrl = true;
                    try {
                        const response = await fetch('/api/url', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url: value })
                        });
                        if (!response.ok) throw new Error('Failed to store URL');
                        const data = await response.json();
                        const input = type === 'start' ? this.startUrlInput : this.endUrlInput;
                        input.value = urlToTitle(value);
                        input.dataset.url = value;
                        input.dataset.urlId = data.id;
                        if (type === 'start') {
                            this.startUrlHistory = [value];
                            this.currentStartIndex = 0;
                        } else {
                            this.endUrlHistory = [value];
                            this.currentEndIndex = 0;
                        }
                        success = true;
                    } catch (error) {
                        // Try as ID next
                    }
                }
                if (!success) {
                    // Try to treat as ID and fetch from /api/url/{id}
                    triedId = true;
                    try {
                        const response = await fetch(`/api/url/${value}`);
                        if (!response.ok) throw new Error('Failed to fetch URL by ID');
                        const data = await response.json();
                        if (!data.url) throw new Error('Invalid URL response');
                        const input = type === 'start' ? this.startUrlInput : this.endUrlInput;
                        input.value = data.title || urlToTitle(data.url);
                        input.dataset.url = data.url;
                        input.dataset.urlId = value;
                        if (type === 'start') {
                            this.startUrlHistory = [data.url];
                            this.currentStartIndex = 0;
                        } else {
                            this.endUrlHistory = [data.url];
                            this.currentEndIndex = 0;
                        }
                        success = true;
                    } catch (error) {
                        // Both attempts failed
                    }
                }
            }
        };

        // Always try to load S and E if present, but do not load random if missing
        await Promise.all([
            loadUrl('S', 'start'),
            loadUrl('E', 'end')
        ]);
        // Update button states
        this.updateButtonStates('start');
        this.updateButtonStates('end');

        // Always parse Q if present
        const settingsString = urlParams.get('Q');
        if (settingsString) {
            this.parseSettingsString(settingsString);
        }
    }

    parseSettingsString(settingsString) {
        let index = 0;
        const length = settingsString.length;

        // Parse countdown timer (5-35)
        let countdownTimer = '';
        while (index < length && /[0-9]/.test(settingsString[index])) {
            countdownTimer += settingsString[index];
            index++;
        }
        if (countdownTimer) {
            const timer = parseInt(countdownTimer);
            if (timer >= 5 && timer <= 35) {
                document.getElementById('countdownTime').value = timer;
                document.getElementById('countdownTime').nextElementSibling.textContent = timer;
            }
        }

        // Parse player role (P or O)
        if (index < length) {
            const role = settingsString[index];
            if (role === 'P' || role === 'O') {
                const roleValue = role === 'P' ? 'player' : 'observer';
                const roleInput = document.querySelector('input[name="role"]');
                const roleButton = document.querySelector(`.icon-button[data-value="${roleValue}"]`);
                if (roleInput && roleButton) {
                    roleInput.value = roleValue;
                    roleButton.closest('.icon-button-group').querySelectorAll('.icon-button').forEach(btn => btn.classList.remove('active'));
                    roleButton.classList.add('active');
                }
            }
            index++;
        }

        // Parse continuation (N, O, or A)
        if (index < length) {
            const continuation = settingsString[index];
            let continuationValue;
            switch (continuation) {
                case 'N': continuationValue = 'automatic'; break;
                case 'O': continuationValue = 'creator'; break;
                case 'A': continuationValue = 'democratic'; break;
            }
            if (continuationValue) {
                const continuationInput = document.querySelector('input[name="continuation"]');
                const continuationButton = document.querySelector(`.icon-button[data-value="${continuationValue}"]`);
                if (continuationInput && continuationButton) {
                    continuationInput.value = continuationValue;
                    continuationButton.closest('.icon-button-group').querySelectorAll('.icon-button').forEach(btn => btn.classList.remove('active'));
                    continuationButton.classList.add('active');
                }
            }
            index++;
        }

        // Parse link chooser (R or P)
        if (index < length) {
            const chooser = settingsString[index];
            let chooserValue;
            switch (chooser) {
                case 'R': chooserValue = 'random'; break;
                case 'P': chooserValue = 'player'; break;
            }
            if (chooserValue) {
                const chooserInput = document.querySelector('input[name="chooser"]');
                const chooserButtonGroup = document.querySelector('.icon-button-group input[name="chooser"]')?.closest('.icon-button-group');
                const chooserButton = chooserButtonGroup?.querySelector(`.icon-button[data-value="${chooserValue}"]`);
                if (chooserInput && chooserButton) {
                    chooserInput.value = chooserValue;
                    if (chooserButtonGroup) {
                        chooserButtonGroup.querySelectorAll('.icon-button').forEach(btn => btn.classList.remove('active'));
                        chooserButton.classList.add('active');
                    }
                }
            }
            index++;
        }

        // Parse additions
        let hasAdditions = false;

        // Parse bomb (BN or B followed by number)
        if (index < length) {
            if (settingsString.substring(index, index + 2) === 'BN') {
                // Bombs off
                index += 2;
            } else if (settingsString[index] === 'B') {
                index++;
                let bombCount = '';
                while (index < length && /[0-9]/.test(settingsString[index])) {
                    bombCount += settingsString[index];
                    index++;
                }
                if (bombCount) {
                    hasAdditions = true;
                    const bombButton = document.querySelector('button[name="bombEnabled"]');
                    const bombContainer = document.getElementById('bombCountContainer');
                    if (bombButton && bombContainer) {
                        bombButton.dataset.value = 'true';
                        bombButton.classList.add('active');
                        bombButton.querySelector('.effect-state').textContent = 'On';
                        bombContainer.style.display = 'flex';
                        bombContainer.querySelector('.count-value').textContent = bombCount;
                        const bombInput = bombButton.closest('.icon-button-group').querySelector('input[name="bombEnabled"]');
                        if (bombInput) bombInput.value = 'true';
                    }
                }
            }
        }

        // Parse return (RN or R followed by number)
        if (index < length) {
            if (settingsString.substring(index, index + 2) === 'RN') {
                // Return off
                index += 2;
            } else if (settingsString[index] === 'R') {
                index++;
                let returnCount = '';
                while (index < length && /[0-9]/.test(settingsString[index])) {
                    returnCount += settingsString[index];
                    index++;
                }
                if (returnCount) {
                    hasAdditions = true;
                    const returnButton = document.querySelector('button[name="returnEnabled"]');
                    const returnContainer = document.getElementById('returnCountContainer');
                    if (returnButton && returnContainer) {
                        returnButton.dataset.value = 'true';
                        returnButton.classList.add('active');
                        returnButton.querySelector('.effect-state').textContent = 'On';
                        returnContainer.style.display = 'flex';
                        returnContainer.querySelector('.count-value').textContent = returnCount;
                        const returnInput = returnButton.closest('.icon-button-group').querySelector('input[name="returnEnabled"]');
                        if (returnInput) returnInput.value = 'true';
                    }
                }
            }
        }

        // Parse swap (SN or S followed by number)
        if (index < length) {
            if (settingsString.substring(index, index + 2) === 'SN') {
                // Swap off
                index += 2;
            } else if (settingsString[index] === 'S') {
                index++;
                let swapCount = '';
                while (index < length && /[0-9]/.test(settingsString[index])) {
                    swapCount += settingsString[index];
                    index++;
                }
                if (swapCount) {
                    hasAdditions = true;
                    const swapButton = document.querySelector('button[name="swapEnabled"]');
                    const swapContainer = document.getElementById('swapCountContainer');
                    if (swapButton && swapContainer) {
                        swapButton.dataset.value = 'true';
                        swapButton.classList.add('active');
                        swapButton.querySelector('.effect-state').textContent = 'On';
                        swapContainer.style.display = 'flex';
                        swapContainer.querySelector('.count-value').textContent = swapCount;
                        const swapInput = swapButton.closest('.icon-button-group').querySelector('input[name="swapEnabled"]');
                        if (swapInput) swapInput.value = 'true';
                    }
                }
            }
        }

        // If any additions are enabled, show the settings
        if (hasAdditions) {
            document.querySelector('.effect-settings').style.display = 'block';
            document.querySelector('.effect-cards-container').classList.add('active');
        }

        // Parse additional settings if additions are enabled
        if (hasAdditions && index < length) {
            // Parse card use style (F or R)
            const cardUseStyle = settingsString[index];
            let cardUseValue;
            switch (cardUseStyle) {
                case 'F': cardUseValue = 'free_for_all'; break;
                case 'R': cardUseValue = 'round_robin'; break;
            }
            if (cardUseValue) {
                const cardUseInput = document.querySelector('input[name="additions_callType"]');
                const cardUseButton = document.querySelector(`.icon-button[data-value="${cardUseValue}"]`);
                if (cardUseInput && cardUseButton) {
                    cardUseInput.value = cardUseValue;
                    cardUseButton.closest('.icon-button-group').querySelectorAll('.icon-button').forEach(btn => btn.classList.remove('active'));
                    cardUseButton.classList.add('active');
                }
            }
            index++;

            // Parse additions timer
            let additionsTimer = '';
            while (index < length && /[0-9]/.test(settingsString[index])) {
                additionsTimer += settingsString[index];
                index++;
            }
            if (additionsTimer) {
                const timer = parseInt(additionsTimer);
                if (timer >= 5 && timer <= 60) {
                    document.getElementById('additions_timer').value = timer;
                    document.getElementById('additions_timer').nextElementSibling.textContent = timer;
                }
            }

            // Parse multiple cards per player (N or Y)
            if (index < length) {
                const multiplePerPlayer = settingsString[index];
                let multiplePerPlayerValue;
                switch (multiplePerPlayer) {
                    case 'N': multiplePerPlayerValue = 'false'; break;
                    case 'Y': multiplePerPlayerValue = 'true'; break;
                }
                if (multiplePerPlayerValue) {
                    const multiplePerPlayerInput = document.querySelector('input[name="additions_application"]');
                    const multiplePerPlayerButtonGroup = document.querySelector('.icon-button-group input[name="additions_application"]')?.closest('.icon-button-group');
                    const multiplePerPlayerButton = multiplePerPlayerButtonGroup?.querySelector(`.icon-button[data-value="${multiplePerPlayerValue}"]`);
                    if (multiplePerPlayerInput && multiplePerPlayerButton) {
                        multiplePerPlayerInput.value = multiplePerPlayerValue;
                        if (multiplePerPlayerButtonGroup) {
                            multiplePerPlayerButtonGroup.querySelectorAll('.icon-button').forEach(btn => btn.classList.remove('active'));
                            multiplePerPlayerButton.classList.add('active');
                        }
                    }
                }
                index++;
            }

            // Parse multiple cards per round (N or Y)
            if (index < length) {
                const multiplePerRound = settingsString[index];
                let multiplePerRoundValue;
                switch (multiplePerRound) {
                    case 'N': multiplePerRoundValue = 'false'; break;
                    case 'Y': multiplePerRoundValue = 'true'; break;
                }
                if (multiplePerRoundValue) {
                    const multiplePerRoundInput = document.querySelector('input[name="additions_multiplePerRound"]');
                    const multiplePerRoundButtonGroup = document.querySelector('.icon-button-group input[name="additions_multiplePerRound"]')?.closest('.icon-button-group');
                    const multiplePerRoundButton = multiplePerRoundButtonGroup?.querySelector(`.icon-button[data-value="${multiplePerRoundValue}"]`);
                    if (multiplePerRoundInput && multiplePerRoundButton) {
                        multiplePerRoundInput.value = multiplePerRoundValue;
                        if (multiplePerRoundButtonGroup) {
                            multiplePerRoundButtonGroup.querySelectorAll('.icon-button').forEach(btn => btn.classList.remove('active'));
                            multiplePerRoundButton.classList.add('active');
                        }
                    }
                }
                index++;
            }

            // Parse owner handout (N or Y)
            if (index < length) {
                const ownerHandout = settingsString[index];
                let ownerHandoutValue;
                switch (ownerHandout) {
                    case 'N': ownerHandoutValue = 'false'; break;
                    case 'Y': ownerHandoutValue = 'true'; break;
                }
                if (ownerHandoutValue) {
                    const ownerHandoutInput = document.querySelector('input[name="additions_creatorGive"]');
                    const ownerHandoutButtonGroup = document.querySelector('.icon-button-group input[name="additions_creatorGive"]')?.closest('.icon-button-group');
                    const ownerHandoutButton = ownerHandoutButtonGroup?.querySelector(`.icon-button[data-value="${ownerHandoutValue}"]`);
                    if (ownerHandoutInput && ownerHandoutButton) {
                        ownerHandoutInput.value = ownerHandoutValue;
                        if (ownerHandoutButtonGroup) {
                            ownerHandoutButtonGroup.querySelectorAll('.icon-button').forEach(btn => btn.classList.remove('active'));
                            ownerHandoutButton.classList.add('active');
                        }
                    }
                }
                index++;
            }

            // Parse link reward (LN or L followed by number)
            if (index < length) {
                if (settingsString.substring(index, index + 2) === 'LN') {
                    // Link reward off
                    index += 2;
                } else if (settingsString[index] === 'L') {
                    index++;
                    let linkRewardCount = '';
                    while (index < length && /[0-9]/.test(settingsString[index])) {
                        linkRewardCount += settingsString[index];
                        index++;
                    }
                    if (linkRewardCount) {
                        const linkRewardButton = document.querySelector('button[name="additions_obtainWithTimer"]');
                        const linkRewardContainer = document.getElementById('timerCountContainer');
                        if (linkRewardButton && linkRewardContainer) {
                            linkRewardButton.dataset.value = 'true';
                            linkRewardButton.classList.add('active');
                            linkRewardButton.querySelector('.effect-state').textContent = 'On';
                            linkRewardContainer.style.display = 'flex';
                            linkRewardContainer.querySelector('.count-value').textContent = linkRewardCount;
                            const linkRewardInput = linkRewardButton.closest('.icon-button-group').querySelector('input[name="additions_obtainWithTimer"]');
                            if (linkRewardInput) linkRewardInput.value = 'true';
                        }
                    }
                }
            }

            // Parse card reward (SN or S followed by number)
            if (index < length) {
                if (settingsString.substring(index, index + 2) === 'SN') {
                    // Card reward off
                    index += 2;
                } else if (settingsString[index] === 'S') {
                    index++;
                    let cardRewardCount = '';
                    while (index < length && /[0-9]/.test(settingsString[index])) {
                        cardRewardCount += settingsString[index];
                        index++;
                    }
                    if (cardRewardCount) {
                        const cardRewardButton = document.querySelector('button[name="additions_obtainWithExposure"]');
                        const cardRewardContainer = document.getElementById('exposureCountContainer');
                        if (cardRewardButton && cardRewardContainer) {
                            cardRewardButton.dataset.value = 'true';
                            cardRewardButton.classList.add('active');
                            cardRewardButton.querySelector('.effect-state').textContent = 'On';
                            cardRewardContainer.style.display = 'flex';
                            cardRewardContainer.querySelector('.count-value').textContent = cardRewardCount;
                            const cardRewardInput = cardRewardButton.closest('.icon-button-group').querySelector('input[name="additions_obtainWithExposure"]');
                            if (cardRewardInput) cardRewardInput.value = 'true';
                        }
                    }
                }
            }
        }
    }

    getFormData() {
        // Get effect card counts
        const bombCount = document.getElementById('bombCountContainer').style.display !== 'none' 
            ? parseInt(document.querySelector('#bombCountContainer .count-value').textContent) 
            : 0;
        const returnCount = document.getElementById('returnCountContainer').style.display !== 'none'
            ? parseInt(document.querySelector('#returnCountContainer .count-value').textContent)
            : 0;
        const swapCount = document.getElementById('swapCountContainer').style.display !== 'none'
            ? parseInt(document.querySelector('#swapCountContainer .count-value').textContent)
            : 0;

        // Get effect card settings
        const timerCount = document.getElementById('timerCountContainer').style.display !== 'none'
            ? parseInt(document.querySelector('#timerCountContainer .count-value').textContent)
            : 0;
        const exposureCount = document.getElementById('exposureCountContainer').style.display !== 'none'
            ? parseInt(document.querySelector('#exposureCountContainer .count-value').textContent)
            : 0;

        // Only include enabled additions in the config
        const additions = {};
        if (document.querySelector('button[name="bombEnabled"]').dataset.value === 'true') {
            additions.bomb = bombCount;
        }
        if (document.querySelector('button[name="returnEnabled"]').dataset.value === 'true') {
            additions.return = returnCount;
        }
        if (document.querySelector('button[name="swapEnabled"]').dataset.value === 'true') {
            additions.swap = swapCount;
        }

        return {
            name: this.roomNameInput.value || this.roomNameInput.placeholder,
            playerName: this.playerNameInput.value || this.playerNameInput.placeholder,
            startUrl: this.startUrlInput.dataset.url,
            endUrl: this.endUrlInput.dataset.url,
            countdownTime: parseInt(document.getElementById('countdownTime').value),
            role: document.querySelector('input[name="role"]').value,
            config: {
                continuation: document.querySelector('input[name="continuation"]').value,
                chooser: document.querySelector('input[name="chooser"]').value,
                additions,
                additions_creatorGive: document.querySelector('input[name="additions_creatorGive"]').value === 'true',
                additions_obtainWithExposure: exposureCount,
                additions_obtainWithTimer: timerCount,
                additions_application: document.querySelector('input[name="additions_application"]').value === 'true' ? 'unlimited' : 'once',
                additions_callType: document.querySelector('input[name="additions_callType"]').value,
                additions_timer: parseInt(document.getElementById('additions_timer').value),
                additions_multiplePerRound: document.querySelector('input[name="additions_multiplePerRound"]').value === 'true'
            }
        };
    }

    generateShareUrl(formData) {
        const params = new URLSearchParams();
        
        // Q parameter (settings) comes first
        let settingsString = '';
        
        // Countdown timer
        settingsString += formData.countdownTime;
        
        // Player role (P or O)
        settingsString += formData.role === 'player' ? 'P' : 'O';
        
        // Continuation (N, O, or A)
        switch (formData.config.continuation) {
            case 'automatic': settingsString += 'N'; break;
            case 'creator': settingsString += 'O'; break;
            case 'democratic': settingsString += 'A'; break;
        }
        
        // Link chooser (R or P)
        settingsString += formData.config.chooser === 'random' ? 'R' : 'P';
        
        // Additions
        if (formData.config.additions.bomb !== undefined) {
            settingsString += 'B' + formData.config.additions.bomb;
        } else {
            settingsString += 'BN';
        }
        
        if (formData.config.additions.return !== undefined) {
            settingsString += 'R' + formData.config.additions.return;
        } else {
            settingsString += 'RN';
        }
        
        if (formData.config.additions.swap !== undefined) {
            settingsString += 'S' + formData.config.additions.swap;
        } else {
            settingsString += 'SN';
        }
        
        // Additional settings if any additions are enabled
        if (Object.keys(formData.config.additions).length > 0) {
            // Card use style (F or R)
            settingsString += formData.config.additions_callType === 'free_for_all' ? 'F' : 'R';
            
            // Additions timer
            settingsString += formData.config.additions_timer;
            
            // Multiple cards per player (N or Y)
            settingsString += formData.config.additions_application === 'once' ? 'N' : 'Y';
            
            // Multiple cards per round (N or Y)
            settingsString += formData.config.additions_multiplePerRound ? 'Y' : 'N';
            
            // Owner handout (N or Y)
            settingsString += formData.config.additions_creatorGive ? 'Y' : 'N';
            
            // Link reward (LN or L followed by number)
            if (formData.config.additions_obtainWithTimer) {
                settingsString += 'L' + formData.config.additions_obtainWithTimer;
            } else {
                settingsString += 'LN';
            }
            
            // Card reward (SN or S followed by number)
            if (formData.config.additions_obtainWithExposure) {
                settingsString += 'S' + formData.config.additions_obtainWithExposure;
            } else {
                settingsString += 'SN';
            }
        }
        
        params.set('Q', settingsString);
        
        // Start and end URLs (using IDs)
        params.set('S', this.startUrlInput.dataset.urlId);
        params.set('E', this.endUrlInput.dataset.urlId);
        
        // Room name and player name
        params.set('R', formData.name);
        params.set('N', formData.playerName);
        
        return `${window.location.origin}/create?${params.toString()}`;
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(err => {
            popupManager.showInfo('Failed to copy to clipboard. Please try again.');
        });
    }
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CreateRoomManager();
}); 