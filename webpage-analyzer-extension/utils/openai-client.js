class OpenAIClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.openai.com/v1';
        this.model = 'gpt-4o-mini';
        this.maxTokens = 2000;
        this.temperature = 0.1;
    }

    async validateApiKey() {
        if (!this.apiKey || !this.apiKey.startsWith('sk-')) {
            throw new Error('Invalid API key format');
        }

        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(`API key validation failed: ${error.error?.message || response.statusText}`);
            }

            return true;
        } catch (error) {
            if (error.message.includes('API key validation failed')) {
                throw error;
            }
            throw new Error('Network error during API key validation');
        }
    }

    async analyzeCode(query, pageAnalysis) {
        const prompt = this.buildAnalysisPrompt(query, pageAnalysis);
        
        try {
            const response = await this.makeRequest([
                {
                    role: 'system',
                    content: this.getSystemPrompt()
                },
                {
                    role: 'user',
                    content: prompt
                }
            ]);

            return this.formatResponse(response);
        } catch (error) {
            throw new Error(`Code analysis failed: ${error.message}`);
        }
    }

    async explainComponent(componentSelector, pageAnalysis) {
        const component = this.findComponentInAnalysis(componentSelector, pageAnalysis);
        if (!component) {
            throw new Error('Component not found in page analysis');
        }

        const prompt = this.buildComponentExplanationPrompt(component, pageAnalysis);
        
        try {
            const response = await this.makeRequest([
                {
                    role: 'system',
                    content: 'You are a web development expert. Explain HTML/CSS components in detail with practical insights.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ]);

            return this.formatResponse(response);
        } catch (error) {
            throw new Error(`Component explanation failed: ${error.message}`);
        }
    }

    async generateSimilarCode(referenceCode, requirements) {
        const prompt = `
Based on this reference code:
${referenceCode}

Generate similar code that meets these requirements:
${requirements}

Provide clean, production-ready HTML/CSS code with explanations.
        `;

        try {
            const response = await this.makeRequest([
                {
                    role: 'system',
                    content: 'You are a web developer creating reusable HTML/CSS components. Generate clean, semantic code with modern CSS practices.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ]);

            return this.formatResponse(response);
        } catch (error) {
            throw new Error(`Code generation failed: ${error.message}`);
        }
    }

    async makeRequest(messages) {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages: messages,
                max_tokens: this.maxTokens,
                temperature: this.temperature,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
            
            if (response.status === 401) {
                throw new Error('Invalid API key');
            } else if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please try again later.');
            } else if (response.status === 400) {
                throw new Error(`Bad request: ${errorMessage}`);
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        
        if (!data.choices || data.choices.length === 0) {
            throw new Error('No response generated');
        }

        return data.choices[0].message.content;
    }

    getSystemPrompt() {
        return `You are a web development expert specializing in HTML/CSS analysis. Your role is to:

1. Analyze webpage structure and provide specific code snippets
2. Explain how components are built and styled
3. Offer practical, implementable solutions
4. Focus on modern web development best practices
5. Provide clear, detailed explanations with code examples

When analyzing code:
- Extract relevant HTML structure
- Include associated CSS styles
- Explain the purpose and functionality
- Suggest improvements when appropriate
- Use semantic HTML and modern CSS practices

Format your responses with:
- Clear section headers
- Code blocks with proper syntax highlighting
- Step-by-step explanations
- Practical usage examples`;
    }

    buildAnalysisPrompt(query, analysis) {
        let prompt = `Webpage Analysis Request\n\n`;
        
        prompt += `Page Information:\n`;
        prompt += `- URL: ${analysis.url}\n`;
        prompt += `- Title: ${analysis.title}\n`;
        prompt += `- Detected Frameworks: ${analysis.metadata.framework.join(', ') || 'None'}\n\n`;

        prompt += `Page Structure:\n`;
        if (analysis.domStructure.mainSections.length > 0) {
            analysis.domStructure.mainSections.forEach(section => {
                prompt += `- ${section.tag}: ${section.selector}`;
                if (section.text) {
                    prompt += ` ("${section.text.substring(0, 50)}...")`;
                }
                prompt += `\n`;
            });
        }

        prompt += `\nIdentified Components:\n`;
        analysis.components.slice(0, 15).forEach(comp => {
            prompt += `- ${comp.type}: ${comp.selector} (confidence: ${(comp.confidence * 100).toFixed(0)}%)\n`;
        });

        if (analysis.cssRules.internal.length > 0) {
            prompt += `\nSample Internal CSS:\n`;
            const sampleCSS = analysis.cssRules.internal[0].content.substring(0, 800);
            prompt += `\`\`\`css\n${sampleCSS}${sampleCSS.length >= 800 ? '...' : ''}\n\`\`\`\n`;
        }

        if (analysis.cssRules.inline.length > 0) {
            prompt += `\nSample Inline Styles:\n`;
            analysis.cssRules.inline.slice(0, 5).forEach(style => {
                prompt += `- ${style.selector}: ${style.styles}\n`;
            });
        }

        prompt += `\nUser Question: "${query}"\n\n`;
        prompt += `Instructions:\n`;
        prompt += `- Provide specific HTML/CSS code relevant to the user's question\n`;
        prompt += `- Include explanations of how the code works\n`;
        prompt += `- Focus on the specific components or elements requested\n`;
        prompt += `- Offer practical, copy-paste ready code examples\n`;
        prompt += `- Consider the detected frameworks and existing patterns\n`;

        return prompt;
    }

    buildComponentExplanationPrompt(component, analysis) {
        let prompt = `Component Analysis Request\n\n`;
        
        prompt += `Component Details:\n`;
        prompt += `- Type: ${component.type}\n`;
        prompt += `- Selector: ${component.selector}\n`;
        prompt += `- Confidence: ${(component.confidence * 100).toFixed(0)}%\n\n`;

        if (component.element) {
            prompt += `HTML Structure:\n`;
            prompt += `- Tag: ${component.element.tagName}\n`;
            prompt += `- ID: ${component.element.id || 'None'}\n`;
            prompt += `- Classes: ${component.element.classes.join(', ') || 'None'}\n`;
            
            if (component.element.styles && Object.keys(component.element.styles).length > 0) {
                prompt += `\nApplied Styles:\n`;
                Object.entries(component.element.styles).forEach(([prop, value]) => {
                    prompt += `- ${prop}: ${value}\n`;
                });
            }
            
            if (component.element.text) {
                prompt += `\nContent Preview: "${component.element.text.substring(0, 100)}..."\n`;
            }
        }

        prompt += `\nPage Context:\n`;
        prompt += `- Framework: ${analysis.metadata.framework.join(', ') || 'Vanilla HTML/CSS'}\n`;
        prompt += `- Page URL: ${analysis.url}\n\n`;

        prompt += `Please provide:\n`;
        prompt += `1. Complete HTML structure for this component\n`;
        prompt += `2. Associated CSS styles\n`;
        prompt += `3. Explanation of the component's purpose and functionality\n`;
        prompt += `4. Best practices and potential improvements\n`;
        prompt += `5. How this component fits into the overall page structure\n`;

        return prompt;
    }

    findComponentInAnalysis(selector, analysis) {
        return analysis.components.find(comp => 
            comp.selector === selector || 
            comp.element?.selector === selector
        );
    }

    formatResponse(response) {
        if (!response || typeof response !== 'string') {
            throw new Error('Invalid response format');
        }

        return response.trim();
    }

    setModel(model) {
        const supportedModels = [
            'gpt-4o-mini',
            'gpt-4o',
            'gpt-4-turbo-preview',
            'gpt-4',
            'gpt-3.5-turbo',
            'gpt-3.5-turbo-16k'
        ];
        
        if (supportedModels.includes(model)) {
            this.model = model;
        } else {
            throw new Error(`Unsupported model: ${model}`);
        }
    }

    setMaxTokens(maxTokens) {
        if (maxTokens > 0 && maxTokens <= 4096) {
            this.maxTokens = maxTokens;
        } else {
            throw new Error('Max tokens must be between 1 and 4096');
        }
    }

    setTemperature(temperature) {
        if (temperature >= 0 && temperature <= 1) {
            this.temperature = temperature;
        } else {
            throw new Error('Temperature must be between 0 and 1');
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = OpenAIClient;
}