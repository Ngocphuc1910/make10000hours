class DOMAnalyzer {
    constructor() {
        this.analysis = null;
        this.init();
    }

    init() {
        this.setupMessageListener();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.analyzePageStructure());
        } else {
            this.analyzePageStructure();
        }
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'getPageAnalysis') {
                sendResponse({ analysis: this.analysis });
            } else if (request.action === 'reanalyze') {
                this.analyzePageStructure();
                sendResponse({ analysis: this.analysis });
            } else if (request.action === 'scrapeAll') {
                const scrapedData = this.scrapeCompletePageCode();
                sendResponse({ scrapedData });
            }
            return true;
        });
    }

    analyzePageStructure() {
        try {
            this.analysis = {
                url: window.location.href,
                title: document.title,
                timestamp: Date.now(),
                domStructure: this.extractDOMStructure(),
                cssRules: this.extractCSS(),
                components: this.identifyComponents(),
                metadata: this.extractMetadata()
            };

            chrome.runtime.sendMessage({
                action: 'pageAnalyzed',
                analysis: this.analysis
            }).catch(err => console.log('Background script not ready:', err));

        } catch (error) {
            console.error('DOM analysis failed:', error);
        }
    }

    extractDOMStructure() {
        const structure = {
            html: this.getElementInfo(document.documentElement),
            head: this.getElementInfo(document.head),
            body: this.getElementInfo(document.body),
            mainSections: []
        };

        const semanticTags = ['header', 'nav', 'main', 'aside', 'section', 'article', 'footer'];
        semanticTags.forEach(tag => {
            const elements = document.querySelectorAll(tag);
            elements.forEach((el, index) => {
                structure.mainSections.push({
                    tag: tag,
                    index: index,
                    ...this.getElementInfo(el)
                });
            });
        });

        return structure;
    }

    getElementInfo(element) {
        if (!element) return null;

        const rect = element.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(element);

        return {
            tagName: element.tagName.toLowerCase(),
            id: element.id || null,
            classes: Array.from(element.classList),
            attributes: this.getElementAttributes(element),
            text: this.getElementText(element),
            children: Array.from(element.children).map(child => ({
                tagName: child.tagName.toLowerCase(),
                id: child.id || null,
                classes: Array.from(child.classList)
            })),
            styles: this.getRelevantStyles(computedStyle),
            dimensions: {
                width: rect.width,
                height: rect.height,
                top: rect.top,
                left: rect.left
            },
            selector: this.generateSelector(element)
        };
    }

    getElementAttributes(element) {
        const attrs = {};
        for (const attr of element.attributes) {
            if (!['class', 'id', 'style'].includes(attr.name)) {
                attrs[attr.name] = attr.value;
            }
        }
        return attrs;
    }

    getElementText(element) {
        const clone = element.cloneNode(true);
        Array.from(clone.querySelectorAll('script, style')).forEach(el => el.remove());
        return clone.textContent.trim().substring(0, 200);
    }

    getRelevantStyles(computedStyle) {
        const relevantProps = [
            'display', 'position', 'top', 'left', 'right', 'bottom',
            'width', 'height', 'margin', 'padding', 'border',
            'background', 'color', 'font-family', 'font-size', 'font-weight',
            'text-align', 'flex-direction', 'justify-content', 'align-items',
            'grid-template-columns', 'grid-template-rows', 'z-index', 'opacity'
        ];

        const styles = {};
        relevantProps.forEach(prop => {
            const value = computedStyle.getPropertyValue(prop);
            if (value && value !== 'initial' && value !== 'normal') {
                styles[prop] = value;
            }
        });

        return styles;
    }

    generateSelector(element) {
        if (element.id) {
            return `#${element.id}`;
        }

        if (element.className) {
            const classes = Array.from(element.classList)
                .filter(cls => cls && !/\s/.test(cls))
                .slice(0, 3)
                .join('.');
            if (classes) {
                return `${element.tagName.toLowerCase()}.${classes}`;
            }
        }

        const parent = element.parentElement;
        if (parent && parent !== document.body) {
            const index = Array.from(parent.children)
                .filter(child => child.tagName === element.tagName)
                .indexOf(element);
            return `${this.generateSelector(parent)} > ${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
        }

        return element.tagName.toLowerCase();
    }

    extractCSS() {
        const cssRules = {
            inline: this.extractInlineStyles(),
            internal: this.extractInternalStyles(),
            external: this.extractExternalStyles()
        };

        return cssRules;
    }

    extractInlineStyles() {
        const elements = document.querySelectorAll('[style]');
        const inlineStyles = [];

        elements.forEach(element => {
            if (element.style.cssText) {
                inlineStyles.push({
                    selector: this.generateSelector(element),
                    styles: element.style.cssText,
                    element: {
                        tagName: element.tagName.toLowerCase(),
                        id: element.id,
                        classes: Array.from(element.classList)
                    }
                });
            }
        });

        return inlineStyles;
    }

    extractInternalStyles() {
        const styleElements = document.querySelectorAll('style');
        const internalStyles = [];

        styleElements.forEach((styleEl, index) => {
            if (styleEl.textContent) {
                internalStyles.push({
                    index: index,
                    content: styleEl.textContent,
                    media: styleEl.media || 'all'
                });
            }
        });

        return internalStyles;
    }

    extractExternalStyles() {
        const linkElements = document.querySelectorAll('link[rel="stylesheet"]');
        const externalStyles = [];

        linkElements.forEach(link => {
            externalStyles.push({
                href: link.href,
                media: link.media || 'all',
                disabled: link.disabled
            });
        });

        return externalStyles;
    }

    identifyComponents() {
        const components = [];

        const componentSelectors = {
            navigation: 'nav, .nav, .navbar, .navigation, [role="navigation"]',
            header: 'header, .header, .site-header, .page-header',
            footer: 'footer, .footer, .site-footer, .page-footer',
            sidebar: 'aside, .sidebar, .side-nav, [role="complementary"]',
            main: 'main, .main, .content, .main-content, [role="main"]',
            button: 'button, .btn, .button, input[type="button"], input[type="submit"]',
            form: 'form, .form, .contact-form, .search-form',
            card: '.card, .post, .article-card, .product-card',
            modal: '.modal, .popup, .dialog, [role="dialog"]',
            menu: '.menu, .dropdown, .submenu, [role="menu"]',
            breadcrumb: '.breadcrumb, .breadcrumbs, [role="breadcrumb"]',
            carousel: '.carousel, .slider, .slideshow',
            tabs: '.tabs, .tab-container, [role="tablist"]',
            accordion: '.accordion, .collapse, .expandable',
            gallery: '.gallery, .image-grid, .photo-gallery'
        };

        Object.entries(componentSelectors).forEach(([type, selector]) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach((element, index) => {
                if (this.isVisibleElement(element)) {
                    components.push({
                        type: type,
                        index: index,
                        selector: this.generateSelector(element),
                        element: this.getElementInfo(element),
                        confidence: this.calculateComponentConfidence(element, type)
                    });
                }
            });
        });

        return components.filter(comp => comp.confidence > 0.5)
                      .sort((a, b) => b.confidence - a.confidence);
    }

    isVisibleElement(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        return rect.width > 0 && 
               rect.height > 0 && 
               style.display !== 'none' && 
               style.visibility !== 'hidden' &&
               style.opacity !== '0';
    }

    calculateComponentConfidence(element, type) {
        let confidence = 0.5;

        if (element.tagName.toLowerCase() === type) confidence += 0.3;
        if (element.className.toLowerCase().includes(type)) confidence += 0.2;
        if (element.id && element.id.toLowerCase().includes(type)) confidence += 0.2;

        const hasContent = element.textContent.trim().length > 0;
        if (hasContent) confidence += 0.1;

        const hasChildren = element.children.length > 0;
        if (hasChildren) confidence += 0.1;

        const rect = element.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 50) confidence += 0.1;

        return Math.min(confidence, 1.0);
    }

    extractMetadata() {
        const metadata = {
            viewport: this.getViewportInfo(),
            framework: this.detectFramework(),
            charset: document.characterSet,
            language: document.documentElement.lang,
            description: this.getMetaContent('description'),
            keywords: this.getMetaContent('keywords'),
            author: this.getMetaContent('author'),
            generator: this.getMetaContent('generator')
        };

        return metadata;
    }

    getMetaContent(name) {
        const meta = document.querySelector(`meta[name="${name}"]`);
        return meta ? meta.getAttribute('content') : null;
    }

    getViewportInfo() {
        const viewport = document.querySelector('meta[name="viewport"]');
        return viewport ? viewport.getAttribute('content') : null;
    }

    detectFramework() {
        const frameworks = [];

        if (window.React || document.querySelector('[data-reactroot]')) {
            frameworks.push('React');
        }
        if (window.Vue || document.querySelector('[data-v-]')) {
            frameworks.push('Vue.js');
        }
        if (window.angular || document.querySelector('[ng-app], [data-ng-app]')) {
            frameworks.push('Angular');
        }
        if (document.querySelector('.container, .row, .col-')) {
            frameworks.push('Bootstrap');
        }
        if (document.querySelector('[class*="tw-"], [class*="tailwind"]')) {
            frameworks.push('Tailwind CSS');
        }
        if (window.jQuery || window.$) {
            frameworks.push('jQuery');
        }

        return frameworks;
    }

    scrapeCompletePageCode() {
        try {
            console.log('Starting page scraping process...');
            
            // Check if document is ready
            if (!document || !document.documentElement) {
                throw new Error('Document not ready');
            }
            
            console.log('Document ready, extracting data...');
            
            const scrapedData = {
                url: window.location.href,
                title: document.title || 'Untitled',
                timestamp: Date.now(),
                html: this.getCompleteHTML(),
                css: this.getCompleteCSS(),
                metadata: {
                    charset: document.characterSet || 'UTF-8',
                    language: document.documentElement.lang || '',
                    viewport: this.getViewportInfo(),
                    framework: this.detectFramework()
                }
            };
            
            console.log('Scraping completed successfully:', {
                url: scrapedData.url,
                htmlLength: scrapedData.html ? scrapedData.html.length : 0,
                cssInternalCount: scrapedData.css.internal ? scrapedData.css.internal.length : 0,
                cssInlineCount: scrapedData.css.inline ? scrapedData.css.inline.length : 0
            });

            return scrapedData;
        } catch (error) {
            console.error('Error scraping page code:', error);
            return {
                error: 'Failed to scrape page code: ' + error.message
            };
        }
    }

    getCompleteHTML() {
        // Get the complete HTML structure
        const doctype = document.doctype ? 
            `<!DOCTYPE ${document.doctype.name}` +
            (document.doctype.publicId ? ` PUBLIC "${document.doctype.publicId}"` : '') +
            (document.doctype.systemId ? ` "${document.doctype.systemId}"` : '') +
            '>\n' : '';
        
        // Clean up the HTML by removing script tags and cleaning inline event handlers
        const htmlClone = document.documentElement.cloneNode(true);
        
        // Remove script tags
        const scripts = htmlClone.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        // Clean inline event handlers
        const allElements = htmlClone.querySelectorAll('*');
        allElements.forEach(element => {
            // Remove event handler attributes
            const attributes = Array.from(element.attributes);
            attributes.forEach(attr => {
                if (attr.name.startsWith('on')) {
                    element.removeAttribute(attr.name);
                }
            });
        });
        
        return doctype + htmlClone.outerHTML;
    }

    getCompleteCSS() {
        const cssData = {
            inline: [],
            internal: [],
            external: [],
            computed: this.getComputedStylesForElements()
        };

        // Get inline styles
        const elementsWithStyle = document.querySelectorAll('[style]');
        elementsWithStyle.forEach(element => {
            if (element.style.cssText) {
                cssData.inline.push({
                    selector: this.generateSelector(element),
                    styles: element.style.cssText
                });
            }
        });

        // Get internal stylesheets
        const styleElements = document.querySelectorAll('style');
        styleElements.forEach((styleEl, index) => {
            if (styleEl.textContent) {
                cssData.internal.push({
                    index: index,
                    content: styleEl.textContent,
                    media: styleEl.media || 'all'
                });
            }
        });

        // Get external stylesheets (links only, content can't be accessed due to CORS)
        const linkElements = document.querySelectorAll('link[rel="stylesheet"]');
        linkElements.forEach(link => {
            cssData.external.push({
                href: link.href,
                media: link.media || 'all',
                disabled: link.disabled,
                note: 'External CSS content not accessible due to CORS policy'
            });
        });

        return cssData;
    }

    getComputedStylesForElements() {
        // Get computed styles for key elements
        const keyElements = [
            'body', 'header', 'nav', 'main', 'aside', 'footer', 'section', 'article',
            '.container', '.wrapper', '.content', '.sidebar', '.navbar', '.header', '.footer'
        ];

        const computedStyles = [];
        
        keyElements.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach((element, index) => {
                    if (this.isVisibleElement(element)) {
                        const styles = this.getRelevantStyles(window.getComputedStyle(element));
                        if (Object.keys(styles).length > 0) {
                            computedStyles.push({
                                selector: selector + (elements.length > 1 ? `:nth-of-type(${index + 1})` : ''),
                                actualSelector: this.generateSelector(element),
                                styles: styles
                            });
                        }
                    }
                });
            } catch (error) {
                // Skip selectors that cause errors
            }
        });

        return computedStyles;
    }
}

if (typeof window !== 'undefined') {
    new DOMAnalyzer();
}