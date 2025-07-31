class BackgroundService {
    constructor() {
        this.pageAnalyses = new Map();
        this.queryCache = new Map();
        this.init();
    }

    init() {
        this.setupMessageListeners();
        this.setupStorageListeners();
        this.cleanupOldAnalyses();
    }

    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });
    }

    setupStorageListeners() {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.openai_api_key) {
                console.log('API key updated');
            }
        });
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'pageAnalyzed':
                    await this.storePageAnalysis(sender.tab.id, request.analysis);
                    sendResponse({ success: true });
                    break;

                case 'getPageAnalysis':
                    const analysis = this.pageAnalyses.get(request.tabId);
                    sendResponse({ analysis });
                    break;

                case 'analyzeQuery':
                    const result = await this.processQuery(request.tabId, request.query, request.apiKey);
                    sendResponse({ result });
                    break;

                case 'triggerAnalysis':
                    await this.triggerContentScriptAnalysis(request.tabId);
                    sendResponse({ success: true });
                    break;

                case 'scrapeAll':
                    const scrapedData = await this.scrapePageCode(request.tabId);
                    sendResponse({ scrapedData });
                    break;

                case 'clearCache':
                    await this.clearCache();
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background service error:', error);
            sendResponse({ error: error.message });
        }
    }

    async storePageAnalysis(tabId, analysis) {
        this.pageAnalyses.set(tabId, {
            ...analysis,
            ttl: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        });

        await chrome.storage.local.set({
            [`analysis_${tabId}`]: analysis
        });
    }

    async processQuery(tabId, query, apiKey) {
        const cacheKey = `${tabId}_${this.hashString(query)}`;
        
        if (this.queryCache.has(cacheKey)) {
            const cached = this.queryCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 300000) { // 5 minutes
                return cached.result;
            }
        }

        let analysis = this.pageAnalyses.get(tabId);
        
        // If no analysis in memory, try to load from storage
        if (!analysis) {
            try {
                const stored = await chrome.storage.local.get([`analysis_${tabId}`]);
                analysis = stored[`analysis_${tabId}`];
                if (analysis) {
                    this.pageAnalyses.set(tabId, analysis);
                }
            } catch (error) {
                console.log('Could not load stored analysis:', error);
            }
        }
        
        // If still no analysis, trigger a new one and wait
        if (!analysis) {
            try {
                await this.triggerContentScriptAnalysis(tabId);
                // Wait up to 5 seconds for analysis to complete
                for (let i = 0; i < 50; i++) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    analysis = this.pageAnalyses.get(tabId);
                    if (analysis) break;
                }
            } catch (error) {
                console.log('Could not trigger analysis:', error);
            }
        }
        
        if (!analysis) {
            throw new Error('Unable to analyze this page. Please refresh and try again.');
        }

        const result = await this.queryOpenAI(query, analysis, apiKey);
        
        this.queryCache.set(cacheKey, {
            result,
            timestamp: Date.now()
        });

        return result;
    }
    
    async triggerContentScriptAnalysis(tabId) {
        try {
            await chrome.tabs.sendMessage(tabId, { action: 'reanalyze' });
        } catch (error) {
            console.log('Could not send message to content script:', error);
            // Content script might not be loaded, try injecting it
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content/content-script.js']
                });
            } catch (injectionError) {
                console.log('Could not inject content script:', injectionError);
                throw new Error('Unable to analyze this page type');
            }
        }
    }

    async scrapePageCode(tabId) {
        try {
            // First, check if we can get basic tab info
            const tab = await chrome.tabs.get(tabId);
            if (!tab || !tab.url) {
                throw new Error('Invalid tab or URL');
            }
            
            // Skip special pages that can't be scraped
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
                tab.url.startsWith('moz-extension://') || tab.url.startsWith('about:')) {
                throw new Error('Cannot scrape browser internal pages');
            }

            console.log('Attempting to scrape tab:', tab.url);
            
            // Try to send message to existing content script
            try {
                const response = await chrome.tabs.sendMessage(tabId, { action: 'scrapeAll' });
                if (response && response.scrapedData) {
                    return response.scrapedData;
                }
                throw new Error('No scraped data received');
            } catch (messageError) {
                console.log('Content script not responding, injecting:', messageError.message);
                
                // Inject content script
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['content/content-script.js']
                    });
                    
                    console.log('Content script injected, waiting...');
                    
                    // Wait longer for script to initialize
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Try again with injected script
                    const retryResponse = await chrome.tabs.sendMessage(tabId, { action: 'scrapeAll' });
                    if (retryResponse && retryResponse.scrapedData) {
                        return retryResponse.scrapedData;
                    }
                    throw new Error('Content script injected but no data received');
                    
                } catch (injectionError) {
                    console.error('Script injection failed:', injectionError);
                    throw new Error(`Cannot inject script: ${injectionError.message}`);
                }
            }
        } catch (error) {
            console.error('Scrape page code error:', error);
            throw new Error(`Scraping failed: ${error.message}`);
        }
    }

    async queryOpenAI(query, analysis, apiKey) {
        const prompt = this.buildPrompt(query, analysis);
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a web development expert analyzing webpage structure. Provide specific code snippets and clear explanations for requested components. Focus on practical, implementable solutions.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 2000,
                temperature: 0.1
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || 'No response generated';
    }

    buildPrompt(query, analysis) {
        const { domStructure, cssRules, components, metadata } = analysis;
        
        let prompt = `Website Analysis:\n`;
        prompt += `URL: ${analysis.url}\n`;
        prompt += `Title: ${analysis.title}\n\n`;

        prompt += `Page Structure:\n`;
        if (domStructure.mainSections.length > 0) {
            domStructure.mainSections.forEach(section => {
                prompt += `- ${section.tag}: ${section.selector}`;
                if (section.text) {
                    prompt += ` (${section.text.substring(0, 50)}...)`;
                }
                prompt += '\n';
            });
        }

        prompt += `\nDetected Components:\n`;
        components.slice(0, 10).forEach(comp => {
            prompt += `- ${comp.type}: ${comp.selector}\n`;
        });

        if (cssRules.internal.length > 0) {
            prompt += `\nInternal CSS Rules (sample):\n`;
            prompt += cssRules.internal[0].content.substring(0, 500) + '...\n';
        }

        if (cssRules.inline.length > 0) {
            prompt += `\nInline Styles (sample):\n`;
            cssRules.inline.slice(0, 3).forEach(style => {
                prompt += `${style.selector}: ${style.styles}\n`;
            });
        }

        prompt += `\nFrameworks detected: ${metadata.framework.join(', ') || 'None'}\n`;
        
        prompt += `\nUser Question: ${query}\n\n`;
        prompt += `Please provide the relevant HTML/CSS code and explanation for the user's question. `;
        prompt += `Focus on the specific components or elements they're asking about. `;
        prompt += `Include practical code examples that can be used directly.`;

        return prompt;
    }

    async clearCache() {
        this.pageAnalyses.clear();
        this.queryCache.clear();
        
        const keys = await chrome.storage.local.get();
        const analysisKeys = Object.keys(keys).filter(key => key.startsWith('analysis_'));
        
        if (analysisKeys.length > 0) {
            await chrome.storage.local.remove(analysisKeys);
        }
    }

    cleanupOldAnalyses() {
        setInterval(() => {
            const now = Date.now();
            for (const [tabId, analysis] of this.pageAnalyses.entries()) {
                if (analysis.ttl < now) {
                    this.pageAnalyses.delete(tabId);
                    chrome.storage.local.remove(`analysis_${tabId}`);
                }
            }

            for (const [key, cached] of this.queryCache.entries()) {
                if (now - cached.timestamp > 300000) { // 5 minutes
                    this.queryCache.delete(key);
                }
            }
        }, 300000); // Clean every 5 minutes
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('Webpage Code Analyzer extension installed');
});

new BackgroundService();