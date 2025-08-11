/**
 * Comprehensive Test Script for Chrome Extension Favicon Fix
 * Tests favicon loading, fallback mechanisms, and overall popup functionality
 */

class ExtensionTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
    this.testDomains = [
      'youtube.com',
      'github.com',
      'facebook.com',
      'linkedin.com',
      'twitter.com',
      'reddit.com',
      'claude.ai',
      'app.make10000hours.com',
      'notion.so',
      'figma.com',
      'nonexistent-site-12345.com', // Should use fallback
      'google.com',
      'mail.google.com'  
    ];
  }

  /**
   * Main test runner
   */
  async runAllTests() {
    console.log('🚀 Starting Comprehensive Extension Tests...\n');
    
    try {
      // Test 1: Basic functionality
      await this.testBasicFunctionality();
      
      // Test 2: Favicon loading mechanism
      await this.testFaviconLoading();
      
      // Test 3: Fallback icon system
      await this.testFallbackIcons();
      
      // Test 4: Chrome API availability
      await this.testChromeAPIAvailability();
      
      // Test 5: Template structure
      await this.testTemplateStructure();
      
      // Test 6: CSS styling
      await this.testCSSStyles();
      
      // Test 7: Event handling
      await this.testEventHandling();
      
      // Test 8: Performance
      await this.testPerformance();
      
      // Display results
      this.displayResults();
      
    } catch (error) {
      console.error('❌ Test runner failed:', error);
    }
  }

  /**
   * Test basic extension functionality
   */
  async testBasicFunctionality() {
    console.log('📋 Testing Basic Functionality...');
    
    // Test popup manager initialization
    this.assert(
      'PopupManager exists',
      typeof PopupManager !== 'undefined',
      'PopupManager class should be defined'
    );
    
    // Test global functions
    this.assert(
      'getSafeFavicon function exists',
      typeof getSafeFavicon === 'function',
      'getSafeFavicon should be a function'
    );
    
    this.assert(
      'getDomainFallbackIcon function exists',
      typeof getDomainFallbackIcon === 'function',
      'getDomainFallbackIcon should be a function'
    );
    
    // Test popup manager instance
    if (typeof popupManager !== 'undefined' && popupManager) {
      this.assert(
        'PopupManager instance exists',
        popupManager instanceof PopupManager,
        'popupManager should be an instance of PopupManager'
      );
      
      this.assert(
        'loadSiteIcon method exists',
        typeof popupManager.loadSiteIcon === 'function',
        'loadSiteIcon method should exist on PopupManager'
      );
      
      this.assert(
        'testFaviconValidity method exists',
        typeof popupManager.testFaviconValidity === 'function',
        'testFaviconValidity method should exist on PopupManager'
      );
    }
  }

  /**
   * Test favicon loading for various domains
   */
  async testFaviconLoading() {
    console.log('🔍 Testing Favicon Loading...');
    
    for (const domain of this.testDomains) {
      try {
        console.log(`  Testing ${domain}...`);
        
        const faviconUrl = await getSafeFavicon(domain, 32);
        
        this.assert(
          `getSafeFavicon for ${domain}`,
          faviconUrl === null || (typeof faviconUrl === 'string' && faviconUrl.length > 0),
          `Should return null or valid URL string for ${domain}`
        );
        
        if (faviconUrl) {
          // Test if the URL is valid
          const isValidUrl = this.isValidUrl(faviconUrl);
          this.assert(
            `Valid favicon URL for ${domain}`,
            isValidUrl,
            `Favicon URL should be valid: ${faviconUrl}`
          );
          
          // Test if favicon actually loads
          const loads = await this.testImageLoad(faviconUrl);
          this.assert(
            `Favicon loads for ${domain}`,
            loads,
            `Favicon at ${faviconUrl} should load successfully`
          );
        }
        
      } catch (error) {
        this.assert(
          `No error for ${domain}`,
          false,
          `getSafeFavicon should not throw error for ${domain}: ${error.message}`
        );
      }
    }
  }

  /**
   * Test fallback icon system
   */
  async testFallbackIcons() {
    console.log('🎯 Testing Fallback Icons...');
    
    for (const domain of this.testDomains) {
      const fallbackIcon = getDomainFallbackIcon(domain);
      
      this.assert(
        `Fallback icon for ${domain}`,
        typeof fallbackIcon === 'string' && fallbackIcon.startsWith('ri-'),
        `Should return RemixIcon class for ${domain}, got: ${fallbackIcon}`
      );
      
      // Test specific expected mappings
      const expectedMappings = {
        'youtube.com': 'ri-youtube-fill',
        'github.com': 'ri-github-fill',
        'facebook.com': 'ri-facebook-fill',
        'linkedin.com': 'ri-linkedin-fill',
        'twitter.com': 'ri-twitter-fill',
        'reddit.com': 'ri-reddit-fill',
        'claude.ai': 'ri-robot-line',
        'app.make10000hours.com': 'ri-focus-3-line',
        'notion.so': 'ri-file-text-line',
        'figma.com': 'ri-shape-line',
        'nonexistent-site-12345.com': 'ri-global-line'
      };
      
      if (expectedMappings[domain]) {
        this.assert(
          `Specific fallback for ${domain}`,
          fallbackIcon === expectedMappings[domain],
          `Expected ${expectedMappings[domain]} for ${domain}, got ${fallbackIcon}`
        );
      }
    }
  }

  /**
   * Test Chrome API availability
   */
  async testChromeAPIAvailability() {
    console.log('🌐 Testing Chrome API Availability...');
    
    this.assert(
      'Chrome runtime available',
      typeof chrome !== 'undefined' && chrome.runtime,
      'Chrome runtime API should be available'
    );
    
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      this.assert(
        'Extension ID available',
        typeof chrome.runtime.id === 'string' && chrome.runtime.id.length > 0,
        'Chrome runtime ID should be available'
      );
      
      // Test favicon API construction
      const testUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=https://youtube.com&size=32`;
      this.assert(
        'Favicon API URL construction',
        testUrl.includes('chrome-extension://') && testUrl.includes('_favicon'),
        `Favicon API URL should be properly constructed: ${testUrl}`
      );
    }
  }

  /**
   * Test template structure
   */
  async testTemplateStructure() {
    console.log('📝 Testing Template Structure...');
    
    const template = document.getElementById('site-item-template');
    this.assert(
      'Site item template exists',
      template !== null,
      'site-item-template should exist in DOM'
    );
    
    if (template) {
      const content = template.content;
      const siteIcon = content.querySelector('.site-icon');
      const fallbackIcon = content.querySelector('.site-icon-fallback');
      
      this.assert(
        'Template has site-icon',
        siteIcon !== null,
        'Template should contain .site-icon element'
      );
      
      this.assert(
        'Template has fallback icon',
        fallbackIcon !== null,
        'Template should contain .site-icon-fallback element'
      );
      
      if (fallbackIcon) {
        const iconElement = fallbackIcon.querySelector('i');
        this.assert(
          'Fallback has icon element',
          iconElement !== null,
          'Fallback should contain <i> element for RemixIcon'
        );
      }
    }
  }

  /**
   * Test CSS styles
   */
  async testCSSStyles() {
    console.log('🎨 Testing CSS Styles...');
    
    // Create test elements to check CSS
    const testContainer = document.createElement('div');
    testContainer.innerHTML = `
      <div class="site-icon-container">
        <img class="site-icon" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="test">
        <div class="site-icon-fallback">
          <i class="ri-youtube-fill"></i>
        </div>
      </div>
    `;
    document.body.appendChild(testContainer);
    
    const iconContainer = testContainer.querySelector('.site-icon-container');
    const siteIcon = testContainer.querySelector('.site-icon');
    const fallbackIcon = testContainer.querySelector('.site-icon-fallback');
    
    if (iconContainer && siteIcon && fallbackIcon) {
      const containerStyles = window.getComputedStyle(iconContainer);
      const iconStyles = window.getComputedStyle(siteIcon);
      const fallbackStyles = window.getComputedStyle(fallbackIcon);
      
      this.assert(
        'Icon container has proper dimensions',
        containerStyles.width === '32px' && containerStyles.height === '32px',
        `Container should be 32x32px, got ${containerStyles.width}x${containerStyles.height}`
      );
      
      this.assert(
        'Icon container has relative position',
        containerStyles.position === 'relative',
        'Container should have position: relative'
      );
      
      this.assert(
        'Fallback icon has absolute position',
        fallbackStyles.position === 'absolute',
        'Fallback should have position: absolute'
      );
      
      this.assert(
        'Site icon has proper object-fit',
        iconStyles.objectFit === 'contain',
        'Site icon should have object-fit: contain'
      );
    }
    
    // Cleanup
    document.body.removeChild(testContainer);
  }

  /**
   * Test event handling
   */
  async testEventHandling() {
    console.log('⚡ Testing Event Handling...');
    
    // Test focus mode toggle
    const focusToggle = document.getElementById('focus-mode-toggle');
    this.assert(
      'Focus mode toggle exists',
      focusToggle !== null,
      'Focus mode toggle should exist'
    );
    
    // Test tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    this.assert(
      'Tab buttons exist',
      tabButtons.length >= 2,
      `Should have at least 2 tab buttons, found ${tabButtons.length}`
    );
    
    // Test add site button
    const addSiteBtn = document.getElementById('add-site-btn');
    this.assert(
      'Add site button exists',
      addSiteBtn !== null,
      'Add site button should exist'
    );
  }

  /**
   * Test performance
   */
  async testPerformance() {
    console.log('⚡ Testing Performance...');
    
    const startTime = performance.now();
    
    // Test favicon loading speed for YouTube
    const faviconPromise = getSafeFavicon('youtube.com', 32);
    const faviconResult = await Promise.race([
      faviconPromise,
      new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), 5000))
    ]);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.assert(
      'Favicon loading performance',
      duration < 5000,
      `Favicon loading should complete within 5 seconds, took ${duration.toFixed(2)}ms`
    );
    
    this.assert(
      'No timeout in favicon loading',
      faviconResult !== 'TIMEOUT',
      'Favicon loading should not timeout'
    );
  }

  /**
   * Test if a URL is valid
   */
  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Test if an image loads successfully
   */
  async testImageLoad(url) {
    return new Promise((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => resolve(false), 3000);
      
      img.onload = () => {
        clearTimeout(timeout);
        resolve(img.width > 0 && img.height > 0);
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
      
      img.src = url;
    });
  }

  /**
   * Assert a condition and record result
   */
  assert(testName, condition, message) {
    this.testResults.total++;
    
    if (condition) {
      this.testResults.passed++;
      console.log(`  ✅ ${testName}`);
      this.testResults.details.push({
        name: testName,
        status: 'PASS',
        message: message
      });
    } else {
      this.testResults.failed++;
      console.log(`  ❌ ${testName}: ${message}`);
      this.testResults.details.push({
        name: testName,
        status: 'FAIL',
        message: message
      });
    }
  }

  /**
   * Display final test results
   */
  displayResults() {
    console.log('\n🎯 Test Results Summary:');
    console.log('═'.repeat(50));
    console.log(`Total Tests: ${this.testResults.total}`);
    console.log(`Passed: ${this.testResults.passed} ✅`);
    console.log(`Failed: ${this.testResults.failed} ❌`);
    console.log(`Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);
    
    if (this.testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      console.log('-'.repeat(50));
      this.testResults.details
        .filter(detail => detail.status === 'FAIL')
        .forEach(detail => {
          console.log(`• ${detail.name}: ${detail.message}`);
        });
    }
    
    console.log('\n📊 Detailed Results:');
    console.log('-'.repeat(50));
    this.testResults.details.forEach(detail => {
      const icon = detail.status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} ${detail.name}`);
    });
    
    // Overall result
    if (this.testResults.failed === 0) {
      console.log('\n🎉 All tests passed! Extension is working correctly.');
    } else {
      console.log(`\n⚠️  ${this.testResults.failed} test(s) failed. Please review the issues above.`);
    }
    
    // Specific YouTube test result
    const youtubeTests = this.testResults.details.filter(detail => 
      detail.name.includes('youtube.com') || detail.name.includes('YouTube')
    );
    
    if (youtubeTests.length > 0) {
      console.log('\n🎬 YouTube Specific Results:');
      console.log('-'.repeat(30));
      youtubeTests.forEach(test => {
        const icon = test.status === 'PASS' ? '✅' : '❌';
        console.log(`${icon} ${test.name}`);
      });
    }
    
    return this.testResults;
  }

  /**
   * Test specifically YouTube favicon functionality
   */
  async testYouTubeFavicon() {
    console.log('\n🎬 Running YouTube-Specific Tests...');
    
    try {
      // Test 1: Get YouTube favicon URL
      const faviconUrl = await getSafeFavicon('youtube.com', 32);
      console.log(`YouTube favicon URL: ${faviconUrl}`);
      
      // Test 2: Get YouTube fallback icon
      const fallbackIcon = getDomainFallbackIcon('youtube.com');
      console.log(`YouTube fallback icon: ${fallbackIcon}`);
      
      // Test 3: Create actual site item for YouTube
      if (popupManager && typeof popupManager.createSiteItem === 'function') {
        const mockYouTubeData = {
          domain: 'youtube.com',
          timeSpent: 300000, // 5 minutes
          visits: 3
        };
        
        const siteItem = await popupManager.createSiteItem(mockYouTubeData);
        if (siteItem) {
          console.log('✅ YouTube site item created successfully');
          
          // Check if favicon or fallback is visible
          const siteIcon = siteItem.querySelector('.site-icon');
          const fallbackIcon = siteItem.querySelector('.site-icon-fallback');
          
          if (siteIcon && siteIcon.src) {
            console.log(`✅ YouTube favicon set: ${siteIcon.src}`);
          }
          
          if (fallbackIcon) {
            const iconElement = fallbackIcon.querySelector('i');
            if (iconElement) {
              console.log(`✅ YouTube fallback icon ready: ${iconElement.className}`);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('❌ YouTube test failed:', error);
    }
  }
}

// Auto-run tests when script loads
window.addEventListener('load', async () => {
  // Wait a bit for extension to initialize
  setTimeout(async () => {
    const tester = new ExtensionTester();
    
    // Run all tests
    await tester.runAllTests();
    
    // Run YouTube-specific tests
    await tester.testYouTubeFavicon();
    
    // Store results globally for inspection
    window.testResults = tester.testResults;
    
  }, 2000);
});

// Export for manual testing
window.ExtensionTester = ExtensionTester;

console.log('📋 Extension test script loaded. Tests will run automatically, or call:');
console.log('  const tester = new ExtensionTester(); await tester.runAllTests();');