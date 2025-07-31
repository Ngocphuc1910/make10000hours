class StorageManager {
    static async saveApiKey(apiKey) {
        if (!apiKey || !apiKey.startsWith('sk-')) {
            throw new Error('Invalid API key format');
        }
        
        await chrome.storage.local.set({ 
            openai_api_key: apiKey,
            api_key_saved_at: Date.now()
        });
    }

    static async getApiKey() {
        const result = await chrome.storage.local.get(['openai_api_key']);
        return result.openai_api_key || null;
    }

    static async removeApiKey() {
        await chrome.storage.local.remove(['openai_api_key', 'api_key_saved_at']);
    }

    static async savePageAnalysis(tabId, analysis) {
        const key = `analysis_${tabId}`;
        const data = {
            ...analysis,
            ttl: Date.now() + (24 * 60 * 60 * 1000) // 24 hours TTL
        };
        
        await chrome.storage.local.set({ [key]: data });
    }

    static async getPageAnalysis(tabId) {
        const key = `analysis_${tabId}`;
        const result = await chrome.storage.local.get([key]);
        const analysis = result[key];
        
        if (!analysis) return null;
        
        if (Date.now() > analysis.ttl) {
            await chrome.storage.local.remove([key]);
            return null;
        }
        
        return analysis;
    }

    static async saveQueryCache(query, tabId, result) {
        const key = `query_${tabId}_${this.hashString(query)}`;
        const data = {
            query,
            result,
            timestamp: Date.now(),
            ttl: Date.now() + (5 * 60 * 1000) // 5 minutes TTL
        };
        
        await chrome.storage.local.set({ [key]: data });
    }

    static async getQueryCache(query, tabId) {
        const key = `query_${tabId}_${this.hashString(query)}`;
        const result = await chrome.storage.local.get([key]);
        const cache = result[key];
        
        if (!cache) return null;
        
        if (Date.now() > cache.ttl) {
            await chrome.storage.local.remove([key]);
            return null;
        }
        
        return cache.result;
    }

    static async saveUserPreferences(preferences) {
        await chrome.storage.local.set({ 
            user_preferences: {
                ...preferences,
                updated_at: Date.now()
            }
        });
    }

    static async getUserPreferences() {
        const result = await chrome.storage.local.get(['user_preferences']);
        return result.user_preferences || {
            auto_analyze: true,
            max_components: 50,
            analysis_depth: 'medium',
            cache_duration: 24
        };
    }

    static async saveQueryHistory(query, result, tabId) {
        const history = await this.getQueryHistory();
        const entry = {
            id: Date.now(),
            query,
            result: result.substring(0, 200) + '...',
            tabId,
            url: await this.getCurrentTabUrl(tabId),
            timestamp: Date.now()
        };
        
        history.unshift(entry);
        
        const maxHistory = 50;
        if (history.length > maxHistory) {
            history.splice(maxHistory);
        }
        
        await chrome.storage.local.set({ query_history: history });
    }

    static async getQueryHistory() {
        const result = await chrome.storage.local.get(['query_history']);
        return result.query_history || [];
    }

    static async clearQueryHistory() {
        await chrome.storage.local.remove(['query_history']);
    }

    static async clearAllAnalyses() {
        const allKeys = await chrome.storage.local.get();
        const analysisKeys = Object.keys(allKeys).filter(key => 
            key.startsWith('analysis_') || key.startsWith('query_')
        );
        
        if (analysisKeys.length > 0) {
            await chrome.storage.local.remove(analysisKeys);
        }
    }

    static async getStorageUsage() {
        const data = await chrome.storage.local.get();
        const usage = {
            totalKeys: Object.keys(data).length,
            analysisKeys: 0,
            queryKeys: 0,
            estimatedSize: 0
        };
        
        Object.keys(data).forEach(key => {
            if (key.startsWith('analysis_')) usage.analysisKeys++;
            if (key.startsWith('query_')) usage.queryKeys++;
            usage.estimatedSize += JSON.stringify(data[key]).length;
        });
        
        return usage;
    }

    static async cleanupExpiredData() {
        const allData = await chrome.storage.local.get();
        const expiredKeys = [];
        const now = Date.now();
        
        Object.entries(allData).forEach(([key, value]) => {
            if (value && typeof value === 'object' && value.ttl && now > value.ttl) {
                expiredKeys.push(key);
            }
        });
        
        if (expiredKeys.length > 0) {
            await chrome.storage.local.remove(expiredKeys);
            console.log(`Cleaned up ${expiredKeys.length} expired entries`);
        }
        
        return expiredKeys.length;
    }

    static async getCurrentTabUrl(tabId) {
        try {
            const tab = await chrome.tabs.get(tabId);
            return tab.url;
        } catch (error) {
            return 'Unknown URL';
        }
    }

    static hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString();
    }

    static async exportData() {
        const data = await chrome.storage.local.get();
        
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            data: {
                preferences: data.user_preferences,
                history: data.query_history,
                analyses: {}
            }
        };
        
        Object.entries(data).forEach(([key, value]) => {
            if (key.startsWith('analysis_')) {
                exportData.data.analyses[key] = value;
            }
        });
        
        return exportData;
    }

    static async importData(importData) {
        if (!importData.data) {
            throw new Error('Invalid import data format');
        }
        
        const toSave = {};
        
        if (importData.data.preferences) {
            toSave.user_preferences = importData.data.preferences;
        }
        
        if (importData.data.history) {
            toSave.query_history = importData.data.history;
        }
        
        if (importData.data.analyses) {
            Object.entries(importData.data.analyses).forEach(([key, value]) => {
                toSave[key] = value;
            });
        }
        
        await chrome.storage.local.set(toSave);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}