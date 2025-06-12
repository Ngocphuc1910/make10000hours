# Focus Time Tracker Chrome Extension

A powerful Chrome extension that tracks website usage time and blocks distracting sites during focus sessions. Built with modern web technologies and designed for seamless integration with Pomodoro productivity apps.

## 🎯 Features

### Phase 1 (Completed) - Foundation & Basic Time Tracking
- ✅ **Automatic Time Tracking** - Tracks active time spent on websites
- ✅ **Real-time Statistics** - View today's browsing habits in a beautiful popup
- ✅ **Activity Detection** - Only counts time when you're actively using a tab
- ✅ **Modern UI** - Clean, responsive interface with smooth animations
- ✅ **Centralized State Management** - Robust data flow across extension components
- ✅ **Mock Data Integration** - Realistic sample data for development and testing

### Phase 2 (Completed) - Website Blocking System
- ✅ **Focus Mode** - Toggle blocking of distracting websites with one click
- ✅ **Dynamic Site Blocking** - Add/remove sites from block list instantly
- ✅ **Smart Blocking Rules** - Uses Chrome's declarativeNetRequest API for efficient blocking
- ✅ **Override Controls** - Temporary 5-minute access to blocked sites when needed
- ✅ **Block Current Site** - Quickly block the website you're currently viewing
- ✅ **Blocked Sites Management** - Comprehensive interface to manage blocked sites with:
  - 📝 Add new sites to block list with domain validation
  - 🗑️ Remove sites from block list with confirmation
  - 🔍 Search and filter blocked sites
  - 📊 Real-time focus mode status and statistics
  - 📤 Export blocked sites list to JSON
  - 📥 Import blocked sites from JSON files
  - 🧹 Clear all blocked sites with bulk action
  - ⚡ Quick actions and intuitive interface
- ✅ **Beautiful Blocked Page** - Custom redirect page with focus session stats
- ✅ **Focus Session Tracking** - Track focus time and blocked attempts during sessions

### Phase 3 (Planned) - Complete User Interface
- 🔄 **Advanced Analytics** - Weekly and monthly statistics
- 🔄 **Settings Management** - Comprehensive configuration options
- 🔄 **Data Export/Import** - JSON and CSV format support
- 🔄 **Visual Improvements** - Charts, graphs, and enhanced UX

### Phase 4 (Planned) - Data Analytics & Export
- 🔄 **Historical Analysis** - Long-term productivity insights
- 🔄 **Performance Optimization** - Enhanced speed and efficiency
- 🔄 **Privacy Controls** - User data protection features

### Phase 5 (Planned) - Integration Preparation
- 🔄 **Pomodoro App Integration** - Seamless connection with existing productivity apps
- 🔄 **API Communication** - Real-time data synchronization
- 🔄 **Chrome Web Store** - Production-ready deployment

## 🚀 Quick Start

### Installation for Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd focus-time-tracker-extension
   ```

2. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked" and select the project folder
   - The extension icon should appear in your browser toolbar

3. **Start tracking**
   - Click the extension icon to open the popup
   - Browse websites normally - time tracking is automatic
   - View your statistics in real-time

### Project Structure

```
focus-time-tracker-extension/
├── manifest.json              # Extension configuration with blocking permissions
├── background.js             # Background service worker with blocking manager
├── content.js               # Content script for activity detection
├── popup/                   # Popup interface with focus controls
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/                 # Settings page (Phase 3)
│   ├── options.html
│   ├── options.js
│   └── options.css
├── utils/                   # Utility modules
│   ├── stateManager.js     # Centralized state management
│   ├── storage.js          # Data persistence with mock data
│   └── timeUtils.js        # Time formatting and calculations
├── icons/                   # Extension icons
├── rules.json              # Dynamic blocking rules for declarativeNetRequest
├── blocked.html            # Beautiful blocked site page with override controls
└── PRD.md                  # Product Requirements Document
```

## 🛠️ Development Guide

### Architecture Overview

The extension follows a modern, modular architecture:

- **Background Service Worker** (`background.js`) - Handles time tracking and tab management
- **Content Script** (`content.js`) - Detects user activity on web pages  
- **Popup Interface** (`popup/`) - Displays statistics and controls
- **State Management** (`utils/stateManager.js`) - Centralized state across components
- **Storage Layer** (`utils/storage.js`) - Data persistence with mock data support

### Key Technologies

- **Manifest V3** - Latest Chrome extension API
- **Modern JavaScript** - ES6+ features and async/await
- **CSS Grid & Flexbox** - Responsive, modern layouts
- **Chrome Storage API** - Local data persistence
- **Chrome Tabs API** - Tab monitoring and management

### Mock Data for Development

The extension includes realistic mock data for development and testing:

- Sample website statistics (GitHub, Stack Overflow, YouTube, etc.)
- Productivity scores and categories
- Multiple days of historical data
- Realistic time distributions and visit counts

To switch between mock data and real storage, modify the `mockMode` flag in `utils/storage.js`.

### Chrome Extension Concepts Explained

**Service Workers** - Background scripts that handle events and manage extension lifecycle

**Content Scripts** - Scripts that run in the context of web pages to detect user activity

**Popup Interface** - The UI that appears when clicking the extension icon

**Options Page** - Dedicated settings page accessible via right-click → Options

**Storage API** - Chrome's local storage system for extension data

**Tabs API** - Provides access to browser tab information and events

## 🧪 Testing

### Manual Testing Checklist

**Basic Functionality:**
- [ ] Extension loads without errors
- [ ] Time tracking starts when visiting websites
- [ ] Popup displays current statistics
- [ ] Activity detection works (mouse movement, keyboard input)
- [ ] Data persists between browser sessions

**UI/UX Testing:**
- [ ] Popup interface is responsive and functional
- [ ] Statistics update in real-time
- [ ] Buttons and interactions work properly
- [ ] Loading states display correctly
- [ ] Error handling works gracefully

**Chrome Extension Testing:**
- [ ] Background script logs show proper functionality
- [ ] Content script communicates with background
- [ ] Extension survives browser restart
- [ ] No memory leaks during extended use

### Debugging Tips

**Background Script Console:**
- Go to `chrome://extensions/`
- Find "Focus Time Tracker" and click "service worker"
- View background script logs and errors

**Content Script Console:**
- Open DevTools on any webpage (F12)
- Check console for content script messages
- Use `chrome.runtime.sendMessage` to test communication

**Storage Inspection:**
- Go to `chrome://extensions/`
- Click "service worker" → Application tab → Storage
- View Chrome extension storage data

## 📊 Phase 1 Accomplishments

### ✅ Completed Features

1. **Project Architecture**
   - Complete Chrome Extension Manifest V3 setup
   - Modular file structure with clear separation of concerns
   - Comprehensive PRD with detailed technical specifications

2. **Time Tracking System**
   - Background service worker for robust tab monitoring
   - Activity detection with user engagement tracking
   - Accurate time calculation with minimum thresholds
   - Domain extraction and URL filtering

3. **State Management**
   - Centralized state management across all components
   - Redux-style action dispatching
   - Cross-component communication via Chrome messaging
   - State persistence and loading

4. **User Interface**
   - Modern, responsive popup interface
   - Real-time statistics display
   - Interactive site cards with progress bars
   - Modal dialogs and notifications
   - Professional design system with CSS variables

5. **Data Management**
   - Comprehensive mock data for development
   - Storage utilities with Chrome Storage API integration
   - Data export functionality (JSON/CSV)
   - Productivity score calculations

6. **Developer Experience**
   - Extensive code documentation
   - Error handling and logging
   - Development-friendly mock data
   - Clear debugging instructions

### 🎨 Design Highlights

- **Modern CSS** - Uses CSS Grid, Flexbox, and CSS Variables
- **Responsive Design** - Works on different screen sizes
- **Visual Hierarchy** - Clear information architecture
- **Smooth Animations** - Engaging micro-interactions
- **Accessibility** - Semantic HTML and keyboard navigation

## 🛡️ Phase 2 Accomplishments

### ✅ Website Blocking System Features

1. **Focus Mode Implementation**
   - One-click toggle to activate/deactivate website blocking
   - Visual focus mode indicator in popup header
   - Focus session timer with real-time updates
   - Automatic session tracking and statistics

2. **Dynamic Site Blocking**
   - Add sites to block list from current tab or manual entry
   - Remove sites from block list with confirmation
   - Real-time rule updates using Chrome's declarativeNetRequest API
   - Support for both www and non-www domains

3. **Beautiful Blocked Page**
   - Custom redirect page with modern design
   - Focus session statistics display
   - Multiple action options (Go Back, View Progress, Override)
   - Real-time session timer and blocked attempts counter

4. **Override Controls**
   - 5-minute temporary override functionality
   - Confirmation dialog to prevent accidental overrides
   - Automatic rule restoration after override expiry
   - Visual feedback for override status

5. **Comprehensive UI Controls**
   - Focus mode toggle button with status indicators
   - Block current site functionality with visual feedback
   - Manage blocked sites modal with search and remove
   - Blocked sites list in popup with quick actions
   - Responsive design for all screen sizes

6. **Advanced State Management**
   - Focus session persistence across browser restarts
   - Blocked attempts tracking and statistics
   - Temporary overrides management
   - Integration with existing time tracking system

### 🔧 Technical Implementation

1. **Chrome Extension APIs**
   - declarativeNetRequest for efficient rule-based blocking
   - Dynamic rule updates without extension restart
   - Host permissions for comprehensive site blocking
   - Web accessible resources for blocked page

2. **Background Script Enhancement**
   - BlockingManager class for centralized blocking logic
   - Rule generation for both domain and subdomain patterns
   - Temporary override system with automatic cleanup
   - Integration with existing state management

3. **UI/UX Improvements**
   - Focus mode controls in popup interface
   - Blocked sites management with intuitive design
   - Visual status indicators and progress tracking
   - Modal dialogs for complex interactions

4. **Data Persistence**
   - Focus session state storage
   - Blocked sites list persistence
   - Blocking statistics tracking
   - Settings synchronization

### 🎯 Phase 2 Success Metrics Met

- ✅ **Sites get blocked when focus mode is active** - Full implementation
- ✅ **Users can manage block lists** - Comprehensive UI provided
- ✅ **Blocking works across all tabs** - declarativeNetRequest ensures coverage
- ✅ **Performance remains acceptable** - Efficient rule-based blocking

## 🔮 Future Development

### Phase 3: Complete User Interface  
Build comprehensive settings management and advanced analytics views.

### Phase 4: Data Analytics & Export
Implement historical analysis, performance optimization, and privacy features.

### Phase 5: Integration Preparation
Prepare for Pomodoro app integration and Chrome Web Store deployment.

## 🤝 Contributing

This project is built incrementally following the detailed PRD. Each phase builds upon the previous one with clear success criteria and deliverables.

### Development Workflow
1. Review the PRD for current phase requirements
2. Implement features following the established architecture
3. Test thoroughly with both mock and real data
4. Document any changes or improvements
5. Prepare for next phase implementation

### Code Style
- Use modern JavaScript (ES6+)
- Follow established naming conventions
- Add comprehensive comments and documentation
- Maintain separation of concerns
- Use the existing utility functions and components

## 📄 License

This project is developed as a standalone Chrome extension with future integration capabilities for Pomodoro productivity applications.

## 📞 Support

For development questions or issues:
1. Check the debugging section in this README
2. Review Chrome extension documentation
3. Examine the PRD for detailed specifications
4. Test with mock data to isolate issues

---

**Focus Time Tracker v1.0.0 - Phase 1 Complete** 🎉

*A modern, extensible Chrome extension for productivity tracking and website blocking.* 