class OptionsManager {
    constructor() {
        this.settings = {};
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.populateUI();
        await this.updateStorageStats();
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get();
            
            this.settings = {
                openai_api_key: result.openai_api_key || '',
                model: result.model || 'gpt-4o-mini',
                auto_analyze: result.auto_analyze !== false,
                analysis_depth: result.analysis_depth || 'medium',
                max_components: result.max_components || 50,
                cache_duration: result.cache_duration || 24,
                save_history: result.save_history !== false,
                max_history: result.max_history || 100,
                max_tokens: result.max_tokens || 2000,
                temperature: result.temperature || 0.1,
                debug_mode: result.debug_mode || false
            };
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showMessage('Error loading settings', 'error');
        }
    }

    setupEventListeners() {
        document.getElementById('saveApiKey').addEventListener('click', () => this.saveApiKey());
        document.getElementById('testApiKey').addEventListener('click', () => this.testApiKey());
        document.getElementById('saveSettings').addEventListener('click', () => this.saveAllSettings());
        document.getElementById('resetDefaults').addEventListener('click', () => this.resetToDefaults());
        
        document.getElementById('refreshStats').addEventListener('click', () => this.updateStorageStats());
        document.getElementById('clearCache').addEventListener('click', () => this.clearCache());
        document.getElementById('clearAll').addEventListener('click', () => this.clearAllData());
        
        document.getElementById('viewHistory').addEventListener('click', () => this.showHistoryModal());
        document.getElementById('clearHistory').addEventListener('click', () => this.clearHistory());
        
        document.getElementById('exportData').addEventListener('click', () => this.exportData());
        document.getElementById('importData').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));
        
        document.getElementById('viewLogs').addEventListener('click', () => this.showLogsModal());
        
        document.getElementById('temperature').addEventListener('input', (e) => {
            document.getElementById('temperatureValue').textContent = e.target.value;
        });

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }

    populateUI() {
        document.getElementById('apiKey').value = this.settings.openai_api_key;
        document.getElementById('modelSelect').value = this.settings.model;
        document.getElementById('autoAnalyze').checked = this.settings.auto_analyze;
        document.getElementById('analysisDepth').value = this.settings.analysis_depth;
        document.getElementById('maxComponents').value = this.settings.max_components;
        document.getElementById('cacheDuration').value = this.settings.cache_duration;
        document.getElementById('saveHistory').checked = this.settings.save_history;
        document.getElementById('maxHistory').value = this.settings.max_history;
        document.getElementById('maxTokens').value = this.settings.max_tokens;
        document.getElementById('temperature').value = this.settings.temperature;
        document.getElementById('temperatureValue').textContent = this.settings.temperature;
        document.getElementById('debugMode').checked = this.settings.debug_mode;
    }

    async saveApiKey() {
        const apiKey = document.getElementById('apiKey').value.trim();
        
        if (!apiKey) {
            this.showMessage('Please enter an API key', 'error');
            return;
        }

        if (!apiKey.startsWith('sk-')) {
            this.showMessage('Invalid API key format', 'error');
            return;
        }

        try {
            await chrome.storage.local.set({ 
                openai_api_key: apiKey,
                api_key_saved_at: Date.now()
            });
            
            this.settings.openai_api_key = apiKey;
            this.showMessage('API key saved successfully', 'success');
        } catch (error) {
            console.error('Error saving API key:', error);
            this.showMessage('Error saving API key', 'error');
        }
    }

    async testApiKey() {
        const apiKey = document.getElementById('apiKey').value.trim();
        
        if (!apiKey) {
            this.showMessage('Please enter an API key first', 'error');
            return;
        }

        const testBtn = document.getElementById('testApiKey');
        const originalText = testBtn.textContent;
        testBtn.textContent = 'Testing...';
        testBtn.disabled = true;

        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            if (response.ok) {
                this.showMessage('API key is valid!', 'success');
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('API key test failed:', error);
            this.showMessage(`API key test failed: ${error.message}`, 'error');
        } finally {
            testBtn.textContent = originalText;
            testBtn.disabled = false;
        }
    }

    async saveAllSettings() {
        try {
            const newSettings = {
                model: document.getElementById('modelSelect').value,
                auto_analyze: document.getElementById('autoAnalyze').checked,
                analysis_depth: document.getElementById('analysisDepth').value,
                max_components: parseInt(document.getElementById('maxComponents').value),
                cache_duration: parseInt(document.getElementById('cacheDuration').value),
                save_history: document.getElementById('saveHistory').checked,
                max_history: parseInt(document.getElementById('maxHistory').value),
                max_tokens: parseInt(document.getElementById('maxTokens').value),
                temperature: parseFloat(document.getElementById('temperature').value),
                debug_mode: document.getElementById('debugMode').checked,
                settings_updated_at: Date.now()
            };

            await chrome.storage.local.set(newSettings);
            Object.assign(this.settings, newSettings);
            
            this.showMessage('Settings saved successfully', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showMessage('Error saving settings', 'error');
        }
    }

    async resetToDefaults() {
        if (!confirm('Are you sure you want to reset all settings to defaults? This will not affect your API key or data.')) {
            return;
        }

        const defaults = {
            model: 'gpt-4o-mini',
            auto_analyze: true,
            analysis_depth: 'medium',
            max_components: 50,
            cache_duration: 24,
            save_history: true,
            max_history: 100,
            max_tokens: 2000,
            temperature: 0.1,
            debug_mode: false
        };

        try {
            await chrome.storage.local.set(defaults);
            Object.assign(this.settings, defaults);
            this.populateUI();
            this.showMessage('Settings reset to defaults', 'success');
        } catch (error) {
            console.error('Error resetting settings:', error);
            this.showMessage('Error resetting settings', 'error');
        }
    }

    async updateStorageStats() {
        try {
            const data = await chrome.storage.local.get();
            const stats = {
                totalEntries: Object.keys(data).length,
                analysisCount: 0,
                queryCount: 0,
                estimatedSize: 0
            };

            Object.entries(data).forEach(([key, value]) => {
                if (key.startsWith('analysis_')) stats.analysisCount++;
                if (key.startsWith('query_')) stats.queryCount++;
                stats.estimatedSize += JSON.stringify(value).length;
            });

            document.getElementById('totalEntries').textContent = stats.totalEntries;
            document.getElementById('analysisCount').textContent = stats.analysisCount;
            document.getElementById('queryCount').textContent = stats.queryCount;
            document.getElementById('storageSize').textContent = this.formatBytes(stats.estimatedSize);
        } catch (error) {
            console.error('Error updating storage stats:', error);
        }
    }

    async clearCache() {
        if (!confirm('Clear cached page analyses? This will not affect your settings or history.')) {
            return;
        }

        try {
            const data = await chrome.storage.local.get();
            const keysToRemove = Object.keys(data).filter(key => 
                key.startsWith('analysis_') || key.startsWith('query_')
            );

            if (keysToRemove.length > 0) {
                await chrome.storage.local.remove(keysToRemove);
            }

            await this.updateStorageStats();
            this.showMessage(`Cleared ${keysToRemove.length} cached items`, 'success');
        } catch (error) {
            console.error('Error clearing cache:', error);
            this.showMessage('Error clearing cache', 'error');
        }
    }

    async clearAllData() {
        const confirmed = confirm(
            'WARNING: This will delete ALL extension data including settings, cache, and history. Your API key will also be removed. This cannot be undone.\n\nType "DELETE" to confirm:'
        );

        if (!confirmed) return;

        const confirmation = prompt('Type "DELETE" to confirm:');
        if (confirmation !== 'DELETE') {
            this.showMessage('Deletion cancelled', 'success');
            return;
        }

        try {
            await chrome.storage.local.clear();
            this.showMessage('All data cleared successfully', 'success');
            
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            console.error('Error clearing all data:', error);
            this.showMessage('Error clearing data', 'error');
        }
    }

    async showHistoryModal() {
        try {
            const result = await chrome.storage.local.get(['query_history']);
            const history = result.query_history || [];
            
            const historyList = document.getElementById('historyList');
            
            if (history.length === 0) {
                historyList.innerHTML = '<p>No query history found.</p>';
            } else {
                historyList.innerHTML = history.map(item => `
                    <div class="history-item">
                        <div class="query">${this.escapeHtml(item.query)}</div>
                        <div class="response">${this.escapeHtml(item.result)}</div>
                        <div class="meta">
                            <span>URL: ${this.escapeHtml(item.url)}</span>
                            <span>${new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                    </div>
                `).join('');
            }
            
            document.getElementById('historyModal').style.display = 'flex';
        } catch (error) {
            console.error('Error loading history:', error);
            this.showMessage('Error loading history', 'error');
        }
    }

    async clearHistory() {
        if (!confirm('Clear all query history?')) {
            return;
        }

        try {
            await chrome.storage.local.remove(['query_history']);
            this.showMessage('Query history cleared', 'success');
        } catch (error) {
            console.error('Error clearing history:', error);
            this.showMessage('Error clearing history', 'error');
        }
    }

    async exportData() {
        try {
            const data = await chrome.storage.local.get();
            
            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                settings: {},
                history: data.query_history || [],
                analyses: {}
            };

            Object.entries(data).forEach(([key, value]) => {
                if (key.startsWith('analysis_')) {
                    exportData.analyses[key] = value;
                } else if (!key.startsWith('query_') && key !== 'query_history') {
                    exportData.settings[key] = value;
                }
            });

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `webpage-analyzer-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showMessage('Data exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showMessage('Error exporting data', 'error');
        }
    }

    async importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            
            if (!importData.version || !importData.exportDate) {
                throw new Error('Invalid backup file format');
            }

            const confirmed = confirm(
                `Import data from ${new Date(importData.exportDate).toLocaleString()}?\nThis will overwrite your current settings and history.`
            );
            
            if (!confirmed) return;

            const toSave = {};
            
            if (importData.settings) {
                Object.assign(toSave, importData.settings);
            }
            
            if (importData.history) {
                toSave.query_history = importData.history;
            }
            
            if (importData.analyses) {
                Object.assign(toSave, importData.analyses);
            }

            await chrome.storage.local.set(toSave);
            this.showMessage('Data imported successfully', 'success');
            
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (error) {
            console.error('Error importing data:', error);
            this.showMessage(`Import failed: ${error.message}`, 'error');
        }
        
        event.target.value = '';
    }

    showLogsModal() {
        const logsList = document.getElementById('logsList');
        logsList.innerHTML = '<p>Debug logs are shown in the browser console when debug mode is enabled.</p>';
        document.getElementById('logsModal').style.display = 'flex';
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    showMessage(message, type) {
        const existing = document.querySelector('.success-message, .error-message');
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
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new OptionsManager();
});