# Webpage Code Analyzer Browser Extension

A powerful browser extension that analyzes webpage HTML/CSS structure and uses OpenAI's API to answer questions about specific components or sections of any webpage.

## Features

- **Intelligent DOM Analysis**: Automatically extracts and analyzes webpage structure, CSS rules, and component hierarchy
- **AI-Powered Code Insights**: Uses OpenAI GPT-4 to provide detailed explanations and code examples
- **Component Detection**: Identifies common UI patterns like navigation bars, headers, cards, modals, and more
- **CSS Extraction**: Captures inline, internal, and external stylesheets with intelligent parsing
- **Framework Recognition**: Detects popular frameworks like React, Vue, Angular, Bootstrap, and Tailwind CSS
- **Query History**: Keeps track of your questions and responses for easy reference
- **Export/Import**: Backup and restore your settings and data
- **Responsive Interface**: Clean, intuitive popup interface with syntax highlighting

## Installation

### From Source (Development)

1. **Clone or Download** this repository to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** by toggling the switch in the top right
4. **Click "Load unpacked"** and select the extension folder
5. **Pin the extension** to your toolbar for easy access

### Setup Requirements

1. **OpenAI API Key**: You'll need an OpenAI API key to use the AI analysis features
   - Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
   - Create a new API key
   - Enter it in the extension popup or settings page

## Usage

### Basic Usage

1. **Navigate to any webpage** you want to analyze
2. **Click the extension icon** in your browser toolbar
3. **Enter your OpenAI API key** (first time only)
4. **Wait for automatic analysis** (or click to manually analyze)
5. **Ask questions** about the page structure in natural language

### Example Queries

- "Show me the CSS for the navigation bar"
- "Get the HTML structure of the main content area"
- "How is the sidebar styled?"
- "What's the code for the login form?"
- "Extract the CSS for all buttons on this page"
- "Explain how the carousel component works"

### Scrape All Feature

**NEW!** Click the green **"Scrape All"** button to extract the complete HTML and CSS code of any webpage:

- **Complete HTML Structure** - Full page HTML with cleaned markup
- **All CSS Styles** - Internal stylesheets, inline styles, and computed styles
- **External References** - Links to external stylesheets (content not accessible due to CORS)
- **Page Metadata** - Charset, language, viewport, detected frameworks
- **Ready to Use** - Formatted code ready for copy/paste

This feature works independently of the AI analysis and doesn't require an API key.

### Advanced Features

#### Component Preview
- View all detected components in the popup
- Click on component tags to auto-generate queries
- See confidence scores for component detection

#### Settings & Customization
- Access settings via the popup or right-click the extension icon
- Customize AI model (GPT-4, GPT-3.5)
- Adjust analysis depth and caching options
- Configure auto-analysis preferences

#### Data Management
- View query history
- Export/import settings and data
- Clear cache and manage storage

## How It Works

### 1. Page Analysis
The extension automatically analyzes webpages when you visit them:
- Extracts DOM structure and hierarchy
- Captures CSS rules from all sources
- Identifies semantic components
- Detects frameworks and design systems

### 2. Component Detection
Uses intelligent pattern matching to identify:
- Navigation elements (nav, navbar, menu)
- Layout components (header, footer, sidebar)
- Interactive elements (buttons, forms, modals)
- Content sections (cards, articles, galleries)

### 3. AI Integration
Sends structured analysis data to OpenAI with:
- Optimized prompts for code-focused responses
- Context about page structure and components
- Framework and styling information
- User query in natural language

### 4. Response Processing
- Formats AI responses with syntax highlighting
- Caches results to reduce API calls
- Provides copy-to-clipboard functionality
- Maintains query history

## Privacy & Security

- **API Key Storage**: Your OpenAI API key is stored locally and encrypted
- **Data Processing**: Page analysis happens locally in your browser
- **No Data Collection**: We don't collect or store your browsing data
- **Optional Features**: All data sharing features are opt-in

## Settings Reference

### API Configuration
- **API Key**: Your OpenAI API key for AI analysis
- **Model**: Choose between GPT-4 (better quality) or GPT-3.5 (faster/cheaper)

### Analysis Settings
- **Auto-analyze**: Automatically analyze pages when you visit them
- **Analysis Depth**: Control how detailed the analysis is
- **Max Components**: Limit the number of components to detect

### Cache & Storage
- **Cache Duration**: How long to keep analysis data
- **Storage Management**: View usage and clear cached data

### Advanced Options
- **Max Tokens**: Control response length (affects cost)
- **Temperature**: Adjust AI creativity (0.1 = focused, 1.0 = creative)
- **Debug Mode**: Enable detailed logging for troubleshooting

## Troubleshooting

### Common Issues

**Extension not loading:**
- Make sure Developer Mode is enabled in Chrome
- Check that all files are in the extension folder
- Look for errors in the Chrome Extensions page

**API key not working:**
- Verify your API key starts with "sk-"
- Check your OpenAI account has available credits
- Try testing the key in the settings page

**Analysis not working:**
- Wait for the page to fully load before analyzing
- Check that JavaScript is enabled on the page
- Some sites may block content scripts

**Empty or incorrect responses:**
- Try rephrasing your question more specifically
- Check if the page has the components you're asking about
- Verify your OpenAI API key is valid and has credits

### Getting Support

1. **Check the Console**: Open browser dev tools and check for error messages
2. **Enable Debug Mode**: Turn on debug mode in settings for detailed logs
3. **Clear Cache**: Try clearing the extension's cache and reloading

## Development

### File Structure
```
webpage-analyzer-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for API calls
├── content/
│   └── content-script.js  # DOM analysis and extraction
├── popup/                 # Main interface
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/               # Settings page
│   ├── options.html
│   ├── options.css
│   └── options.js
└── utils/                 # Utility modules
    ├── dom-analyzer.js
    ├── openai-client.js
    └── storage-manager.js
```

### API Integration

The extension uses OpenAI's Chat Completions API with optimized prompts for web development use cases. It includes:

- Smart prompt engineering for code-focused responses
- Context optimization to fit within token limits
- Response caching to reduce API costs
- Error handling and retry logic

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with various websites
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Changelog

### Version 1.0
- Initial release
- Basic DOM analysis and component detection
- OpenAI API integration
- Popup interface with query functionality
- Settings page with full configuration options
- Query history and data management
- Export/import functionality

## Roadmap

### Future Features
- Support for additional AI providers
- Advanced component templates
- Code generation capabilities
- Integration with design tools
- Performance optimization insights
- Multi-language support

---

Built with ❤️ for web developers who want to understand and learn from any website's code structure.