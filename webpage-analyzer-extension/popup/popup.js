class PopupManager {
    constructor() {
        this.apiKey = null;
        this.currentAnalysis = null;
        this.init();
    }

    async init() {
        await this.loadApiKey();
        this.setupEventListeners();
        this.updateUI();
        await this.checkPageAnalysis();
    }

    async loadApiKey() {
        try {
            const result = await chrome.storage.local.get(['openai_api_key']);
            this.apiKey = result.openai_api_key;
        } catch (error) {
            console.error('Error loading API key:', error);
        }
    }

    setupEventListeners() {
        document.getElementById('saveApiKey').addEventListener('click', () => this.saveApiKey());
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzeQuery());
        document.getElementById('scrapeAllBtn').addEventListener('click', () => this.scrapeAll());
        document.getElementById('copyBtn').addEventListener('click', () => this.copyResponse());
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
        document.getElementById('clearCacheBtn').addEventListener('click', () => this.clearCache());
        
        document.getElementById('apiKey').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveApiKey();
        });
        
        document.getElementById('userQuery').addEventListener('keypress', (e) => {
            if (e.ctrlKey && e.key === 'Enter') this.analyzeQuery();
        });

        document.getElementById('userQuery').addEventListener('input', () => {
            this.updateAnalyzeButton();
        });
    }

    async saveApiKey() {
        const apiKeyInput = document.getElementById('apiKey');
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            this.showMessage('Please enter an API key', 'error');
            return;
        }

        if (!apiKey.startsWith('sk-')) {
            this.showMessage('Invalid API key format', 'error');
            return;
        }

        try {
            await chrome.storage.local.set({ openai_api_key: apiKey });
            this.apiKey = apiKey;
            this.showMessage('API key saved successfully', 'success');
            this.updateUI();
        } catch (error) {
            console.error('Error saving API key:', error);
            this.showMessage('Error saving API key', 'error');
        }
    }

    async analyzeQuery() {
        const query = document.getElementById('userQuery').value.trim();
        if (!query) {
            this.showMessage('Please enter a query', 'error');
            return;
        }

        this.setAnalyzing(true);
        
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs[0]) {
                throw new Error('No active tab found');
            }

            // First check if page is analyzed
            this.updateStatus('Checking page analysis...', 'analyzing');
            
            const response = await chrome.runtime.sendMessage({
                action: 'analyzeQuery',
                tabId: tabs[0].id,
                query: query,
                apiKey: this.apiKey
            });

            if (response.error) {
                throw new Error(response.error);
            }

            this.displayResponse(response.result);
            this.setAnalyzing(false);
            
        } catch (error) {
            console.error('Analysis error:', error);
            
            // If it's a page analysis error, offer to retry
            if (error.message.includes('not analyzed') || error.message.includes('Unable to analyze')) {
                this.showRetryOption(error.message);
            } else {
                this.showMessage(`Analysis failed: ${error.message}`, 'error');
            }
            this.setAnalyzing(false);
        }
    }
    
    async scrapeAll() {
        this.updateStatus('Scraping page code...', 'analyzing');
        
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs[0]) {
                throw new Error('No active tab found');
            }
            
            console.log('Scraping tab:', tabs[0].url);
            
            // Check if it's a scrapeable page
            if (tabs[0].url.startsWith('chrome://') || tabs[0].url.startsWith('chrome-extension://')) {
                throw new Error('Cannot scrape browser internal pages. Please navigate to a regular website.');
            }

            const response = await chrome.runtime.sendMessage({
                action: 'scrapeAll',
                tabId: tabs[0].id
            });
            
            console.log('Scrape response received:', response);

            if (!response) {
                throw new Error('No response from background script');
            }

            if (response.scrapedData && response.scrapedData.error) {
                throw new Error(response.scrapedData.error);
            }

            if (!response.scrapedData) {
                throw new Error('No scraped data received - the page may not be accessible');
            }

            this.displayScrapedCode(response.scrapedData);
            this.updateStatus('Page code scraped successfully', 'ready');
            
        } catch (error) {
            console.error('Scraping error:', error);
            
            // Provide more helpful error messages
            let errorMessage = error.message;
            if (errorMessage.includes('Cannot inject script')) {
                errorMessage = 'Cannot scrape this page type. Try refreshing the page or navigating to a different website.';
            } else if (errorMessage.includes('browser internal pages')) {
                errorMessage = 'Cannot scrape browser internal pages. Please navigate to a regular website.';
            }
            
            this.showMessage(`Scraping failed: ${errorMessage}`, 'error');
            this.updateStatus('Scraping failed', 'error');
        }
    }
    
    displayScrapedCode(scrapedData) {
        const responseSection = document.getElementById('responseSection');
        const responseText = document.getElementById('responseText');
        
        let output = `/* SCRAPED FROM: ${scrapedData.url} */\n`;
        output += `/* TITLE: ${scrapedData.title} */\n`;
        output += `/* SCRAPED AT: ${new Date(scrapedData.timestamp).toLocaleString()} */\n\n`;
        
        // Add HTML
        output += `/* ========== HTML ========== */\n\n`;
        output += scrapedData.html + '\n\n';
        
        // Add CSS
        output += `/* ========== CSS ========== */\n\n`;
        
        // Internal CSS
        if (scrapedData.css.internal.length > 0) {
            output += `/* --- Internal Stylesheets --- */\n\n`;
            scrapedData.css.internal.forEach((style, index) => {
                output += `/* Internal Stylesheet ${index + 1} (${style.media}) */\n`;
                output += style.content + '\n\n';
            });
        }
        
        // Inline CSS
        if (scrapedData.css.inline.length > 0) {
            output += `/* --- Inline Styles --- */\n\n`;
            scrapedData.css.inline.forEach(style => {
                output += `${style.selector} { ${style.styles} }\n`;
            });
            output += '\n';
        }
        
        // Computed styles for key elements
        if (scrapedData.css.computed.length > 0) {
            output += `/* --- Key Element Computed Styles --- */\n\n`;
            scrapedData.css.computed.forEach(comp => {
                output += `/* ${comp.selector} */\n`;
                output += `${comp.actualSelector} {\n`;
                Object.entries(comp.styles).forEach(([prop, value]) => {
                    output += `    ${prop}: ${value};\n`;
                });
                output += '}\n\n';
            });
        }
        
        // External stylesheets info
        if (scrapedData.css.external.length > 0) {
            output += `/* --- External Stylesheets --- */\n\n`;
            scrapedData.css.external.forEach(link => {
                output += `/* External CSS: ${link.href} (${link.media}) */\n`;
                if (link.note) {
                    output += `/* Note: ${link.note} */\n`;
                }
            });
            output += '\n';
        }
        
        // Add metadata
        output += `/* ========== METADATA ========== */\n\n`;
        output += `/* Charset: ${scrapedData.metadata.charset} */\n`;
        output += `/* Language: ${scrapedData.metadata.language || 'Not specified'} */\n`;
        output += `/* Viewport: ${scrapedData.metadata.viewport || 'Not specified'} */\n`;
        output += `/* Frameworks: ${scrapedData.metadata.framework.join(', ') || 'None detected'} */\n`;
        
        responseText.textContent = output;
        responseSection.style.display = 'block';
        
        // Auto-scroll to response
        responseSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    showRetryOption(errorMessage) {
        const container = document.querySelector('.container');
        const retryDiv = document.createElement('div');
        retryDiv.className = 'error-message';
        retryDiv.innerHTML = `
            <p>${errorMessage}</p>
            <button id="retryAnalysis" style="margin-top: 10px;">Retry Analysis</button>
        `;
        
        const existing = document.querySelector('.error-message, .success-message');
        if (existing) existing.remove();
        
        container.insertBefore(retryDiv, container.firstChild);
        
        document.getElementById('retryAnalysis').addEventListener('click', async () => {
            retryDiv.remove();
            this.updateStatus('Re-analyzing page...', 'analyzing');
            
            try {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                await chrome.runtime.sendMessage({
                    action: 'triggerAnalysis',
                    tabId: tabs[0].id
                });
                
                // Wait a moment then check again
                setTimeout(async () => {
                    await this.checkPageAnalysis();
                    this.updateStatus('Page re-analyzed. Try your query again.', 'ready');
                }, 2000);
                
            } catch (error) {
                this.showMessage('Retry failed: ' + error.message, 'error');
                this.updateStatus('Analysis failed', 'error');
            }
        });
    }

    async checkPageAnalysis() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs[0]) return;

            const response = await chrome.runtime.sendMessage({
                action: 'getPageAnalysis',
                tabId: tabs[0].id
            });

            if (response.analysis) {
                this.currentAnalysis = response.analysis;
                this.displayComponents(response.analysis.components);
                this.updateStatus('Page analyzed', 'ready');
            } else {
                this.updateStatus('Click analyze to start', 'ready');
            }
        } catch (error) {
            console.error('Error checking page analysis:', error);
        }
    }

    displayResponse(result) {
        const responseSection = document.getElementById('responseSection');
        const responseText = document.getElementById('responseText');
        
        responseText.textContent = result;
        responseSection.style.display = 'block';
        
        responseSection.scrollIntoView({ behavior: 'smooth' });
    }

    displayComponents(components) {
        if (!components || components.length === 0) return;
        
        const componentPreview = document.getElementById('componentPreview');
        const componentList = document.getElementById('componentList');
        
        componentList.innerHTML = '';
        
        components.forEach(component => {
            const item = document.createElement('div');
            item.className = 'component-item';
            item.textContent = component.type;
            item.title = component.selector;
            item.addEventListener('click', () => {
                document.getElementById('userQuery').value = `Show me the code for the ${component.type}`;
                this.updateAnalyzeButton();
            });
            componentList.appendChild(item);
        });
        
        componentPreview.style.display = 'block';
    }

    copyResponse() {
        const responseText = document.getElementById('responseText').textContent;
        navigator.clipboard.writeText(responseText).then(() => {
            this.showMessage('Copied to clipboard', 'success');
        }).catch(() => {
            this.showMessage('Failed to copy', 'error');
        });
    }

    openSettings() {
        chrome.runtime.openOptionsPage();
    }

    async clearCache() {
        try {
            await chrome.runtime.sendMessage({ action: 'clearCache' });
            this.showMessage('Cache cleared', 'success');
            this.currentAnalysis = null;
            document.getElementById('componentPreview').style.display = 'none';
            document.getElementById('responseSection').style.display = 'none';
        } catch (error) {
            this.showMessage('Failed to clear cache', 'error');
        }
    }

    updateUI() {
        const apiKeySection = document.getElementById('apiKeySection');
        const mainContent = document.getElementById('mainContent');
        
        if (this.apiKey) {
            apiKeySection.style.display = 'none';
            mainContent.style.display = 'block';
            this.updateAnalyzeButton();
        } else {
            apiKeySection.style.display = 'block';
            mainContent.style.display = 'none';
        }
    }

    updateAnalyzeButton() {
        const analyzeBtn = document.getElementById('analyzeBtn');
        const query = document.getElementById('userQuery').value.trim();
        analyzeBtn.disabled = !query || !this.apiKey;
    }

    setAnalyzing(analyzing) {
        const analyzeBtn = document.getElementById('analyzeBtn');
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        
        if (analyzing) {
            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<div class="loading"></div> Analyzing...';
            this.updateStatus('Analyzing page...', 'analyzing');
        } else {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Analyze';
            this.updateStatus('Analysis complete', 'ready');
        }
    }

    updateStatus(text, type) {
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        
        statusText.textContent = text;
        statusIndicator.className = `status-indicator ${type}`;
        
        const symbols = {
            ready: '●',
            analyzing: '◐',
            error: '●'
        };
        statusIndicator.textContent = symbols[type] || '○';
    }

    showMessage(message, type) {
        const existing = document.querySelector('.error-message, .success-message');
        if (existing) existing.remove();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `${type}-message`;
        messageDiv.textContent = message;
        
        const container = document.querySelector('.container');
        container.insertBefore(messageDiv, container.firstChild);
        
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});