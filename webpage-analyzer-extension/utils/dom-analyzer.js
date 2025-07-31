class DOMAnalyzerUtils {
    static generateUniqueSelector(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) {
            return null;
        }

        if (element.id) {
            return `#${element.id}`;
        }

        if (element === document.body) {
            return 'body';
        }

        if (element === document.documentElement) {
            return 'html';
        }

        let path = [];
        let current = element;

        while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
            let selector = current.nodeName.toLowerCase();
            
            if (current.id) {
                selector += `#${current.id}`;
                path.unshift(selector);
                break;
            }

            if (current.className) {
                const classes = Array.from(current.classList)
                    .filter(cls => cls && !/\s/.test(cls) && cls.length < 50)
                    .slice(0, 3);
                if (classes.length > 0) {
                    selector += `.${classes.join('.')}`;
                }
            }

            const parent = current.parentElement;
            if (parent) {
                const siblings = Array.from(parent.children).filter(
                    child => child.nodeName === current.nodeName
                );
                if (siblings.length > 1) {
                    const index = siblings.indexOf(current) + 1;
                    selector += `:nth-of-type(${index})`;
                }
            }

            path.unshift(selector);
            current = parent;
        }

        return path.join(' > ');
    }

    static extractElementStyles(element, computedOnly = false) {
        if (!element) return {};

        const styles = {};
        const computedStyle = window.getComputedStyle(element);
        
        const relevantProperties = [
            'display', 'position', 'top', 'right', 'bottom', 'left',
            'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
            'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
            'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
            'border', 'border-width', 'border-style', 'border-color', 'border-radius',
            'background', 'background-color', 'background-image', 'background-size',
            'color', 'font-family', 'font-size', 'font-weight', 'font-style',
            'text-align', 'text-decoration', 'text-transform', 'line-height',
            'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items',
            'grid', 'grid-template-columns', 'grid-template-rows', 'grid-gap',
            'z-index', 'opacity', 'transform', 'transition', 'animation',
            'box-shadow', 'text-shadow', 'overflow', 'white-space'
        ];

        relevantProperties.forEach(prop => {
            const value = computedStyle.getPropertyValue(prop);
            if (value && value !== 'initial' && value !== 'normal' && value !== 'auto') {
                styles[prop] = value;
            }
        });

        if (!computedOnly && element.style && element.style.cssText) {
            styles._inline = element.style.cssText;
        }

        return styles;
    }

    static identifyComponentType(element) {
        if (!element) return 'unknown';

        const tagName = element.tagName.toLowerCase();
        const className = element.className.toLowerCase();
        const id = element.id.toLowerCase();
        const role = element.getAttribute('role');

        const patterns = {
            navigation: {
                tags: ['nav'],
                classes: ['nav', 'navbar', 'navigation', 'menu', 'breadcrumb'],
                roles: ['navigation', 'menubar']
            },
            header: {
                tags: ['header'],
                classes: ['header', 'site-header', 'page-header', 'masthead', 'banner']
            },
            footer: {
                tags: ['footer'],
                classes: ['footer', 'site-footer', 'page-footer']
            },
            sidebar: {
                tags: ['aside'],
                classes: ['sidebar', 'side-nav', 'aside'],
                roles: ['complementary']
            },
            main: {
                tags: ['main'],
                classes: ['main', 'content', 'main-content', 'primary'],
                roles: ['main']
            },
            button: {
                tags: ['button'],
                classes: ['btn', 'button', 'cta'],
                types: ['button', 'submit', 'reset']
            },
            form: {
                tags: ['form'],
                classes: ['form', 'contact-form', 'search-form', 'login-form']
            },
            card: {
                classes: ['card', 'post', 'article', 'product', 'item', 'tile']
            },
            modal: {
                classes: ['modal', 'popup', 'dialog', 'overlay'],
                roles: ['dialog']
            },
            carousel: {
                classes: ['carousel', 'slider', 'slideshow', 'gallery']
            },
            tabs: {
                classes: ['tabs', 'tab-container'],
                roles: ['tablist']
            },
            accordion: {
                classes: ['accordion', 'collapse', 'expandable', 'toggle']
            }
        };

        for (const [type, pattern] of Object.entries(patterns)) {
            let score = 0;

            if (pattern.tags && pattern.tags.includes(tagName)) score += 3;
            if (pattern.roles && role && pattern.roles.includes(role)) score += 3;
            
            if (pattern.classes) {
                for (const cls of pattern.classes) {
                    if (className.includes(cls) || id.includes(cls)) {
                        score += 2;
                        break;
                    }
                }
            }

            if (pattern.types && element.type && pattern.types.includes(element.type)) {
                score += 2;
            }

            if (score >= 2) {
                return type;
            }
        }

        if (tagName === 'section') return 'section';
        if (tagName === 'article') return 'article';
        if (tagName === 'div' && className.includes('container')) return 'container';
        if (tagName === 'ul' || tagName === 'ol') return 'list';
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) return 'heading';
        if (tagName === 'img') return 'image';
        if (tagName === 'video') return 'video';
        if (tagName === 'iframe') return 'iframe';
        if (tagName === 'table') return 'table';

        return 'generic';
    }

    static calculateElementVisibility(element) {
        if (!element) return { visible: false, reason: 'Element not found' };

        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);

        if (style.display === 'none') {
            return { visible: false, reason: 'display: none' };
        }

        if (style.visibility === 'hidden') {
            return { visible: false, reason: 'visibility: hidden' };
        }

        if (style.opacity === '0') {
            return { visible: false, reason: 'opacity: 0' };
        }

        if (rect.width === 0 && rect.height === 0) {
            return { visible: false, reason: 'Zero dimensions' };
        }

        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        const inViewport = !(
            rect.bottom < 0 ||
            rect.right < 0 ||
            rect.left > viewport.width ||
            rect.top > viewport.height
        );

        return {
            visible: true,
            inViewport,
            dimensions: {
                width: rect.width,
                height: rect.height,
                top: rect.top,
                left: rect.left
            }
        };
    }

    static extractTextContent(element, maxLength = 200) {
        if (!element) return '';

        const clone = element.cloneNode(true);
        
        Array.from(clone.querySelectorAll('script, style, noscript')).forEach(el => {
            el.remove();
        });

        let text = clone.textContent || '';
        text = text.replace(/\s+/g, ' ').trim();
        
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    static getElementHierarchy(element, maxDepth = 5) {
        if (!element || maxDepth <= 0) return [];

        const hierarchy = [];
        let current = element;
        let depth = 0;

        while (current && current !== document.documentElement && depth < maxDepth) {
            hierarchy.unshift({
                tagName: current.tagName.toLowerCase(),
                id: current.id || null,
                classes: Array.from(current.classList),
                selector: this.generateUniqueSelector(current)
            });
            
            current = current.parentElement;
            depth++;
        }

        return hierarchy;
    }

    static analyzeLayoutStructure(element) {
        if (!element) return {};

        const style = window.getComputedStyle(element);
        const children = Array.from(element.children);

        const layout = {
            display: style.display,
            position: style.position,
            childCount: children.length,
            layoutType: 'unknown'
        };

        if (style.display === 'flex') {
            layout.layoutType = 'flexbox';
            layout.flexDirection = style.flexDirection;
            layout.justifyContent = style.justifyContent;
            layout.alignItems = style.alignItems;
            layout.flexWrap = style.flexWrap;
        } else if (style.display === 'grid') {
            layout.layoutType = 'grid';
            layout.gridTemplateColumns = style.gridTemplateColumns;
            layout.gridTemplateRows = style.gridTemplateRows;
            layout.gridGap = style.gridGap;
        } else if (style.display === 'block') {
            layout.layoutType = 'block';
        } else if (style.display === 'inline-block') {
            layout.layoutType = 'inline-block';
        }

        if (style.position !== 'static') {
            layout.positioned = true;
            layout.zIndex = style.zIndex;
        }

        return layout;
    }

    static detectFrameworks(document = window.document) {
        const frameworks = new Set();

        if (window.React || document.querySelector('[data-reactroot], [data-react-class]')) {
            frameworks.add('React');
        }

        if (window.Vue || document.querySelector('[data-v-]')) {
            frameworks.add('Vue.js');
        }

        if (window.angular || document.querySelector('[ng-app], [data-ng-app], [ng-controller]')) {
            frameworks.add('Angular');
        }

        if (window.jQuery || window.$) {
            frameworks.add('jQuery');
        }

        if (document.querySelector('.container, .row, .col-, [class*="col-"]')) {
            frameworks.add('Bootstrap');
        }

        const tailwindPatterns = [
            '[class*="tw-"]',
            '[class*="bg-"]',
            '[class*="text-"]',
            '[class*="p-"]',
            '[class*="m-"]',
            '[class*="flex"]',
            '[class*="grid"]'
        ];

        if (tailwindPatterns.some(pattern => document.querySelector(pattern))) {
            frameworks.add('Tailwind CSS');
        }

        if (document.querySelector('[class*="MuiButton"], [class*="MuiTextField"]')) {
            frameworks.add('Material-UI');
        }

        if (document.querySelector('[class*="ant-"]')) {
            frameworks.add('Ant Design');
        }

        if (window.Ember || document.querySelector('[class*="ember-"]')) {
            frameworks.add('Ember.js');
        }

        if (window.Backbone || document.querySelector('[data-backbone]')) {
            frameworks.add('Backbone.js');
        }

        return Array.from(frameworks);
    }

    static generateComponentCode(element, includeStyles = true) {
        if (!element) return { html: '', css: '' };

        const html = this.generateHTMLStructure(element);
        const css = includeStyles ? this.generateCSSRules(element) : '';

        return { html, css };
    }

    static generateHTMLStructure(element, depth = 0, maxDepth = 3) {
        if (!element || depth > maxDepth) return '';

        const tagName = element.tagName.toLowerCase();
        const attributes = [];

        if (element.id) attributes.push(`id="${element.id}"`);
        if (element.className) attributes.push(`class="${element.className}"`);

        Array.from(element.attributes).forEach(attr => {
            if (!['id', 'class', 'style'].includes(attr.name)) {
                attributes.push(`${attr.name}="${attr.value}"`);
            }
        });

        const attrString = attributes.length > 0 ? ' ' + attributes.join(' ') : '';
        const indent = '  '.repeat(depth);

        if (['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tagName)) {
            return `${indent}<${tagName}${attrString}>`;
        }

        const children = Array.from(element.children);
        const textContent = this.extractTextContent(element, 50);

        if (children.length === 0 && textContent) {
            return `${indent}<${tagName}${attrString}>${textContent}</${tagName}>`;
        }

        let html = `${indent}<${tagName}${attrString}>`;
        
        if (textContent && children.length === 0) {
            html += textContent;
        } else {
            html += '\n';
            children.forEach(child => {
                html += this.generateHTMLStructure(child, depth + 1, maxDepth) + '\n';
            });
            html += indent;
        }

        html += `</${tagName}>`;
        return html;
    }

    static generateCSSRules(element) {
        if (!element) return '';

        const selector = this.generateUniqueSelector(element);
        const styles = this.extractElementStyles(element, true);
        
        if (Object.keys(styles).length === 0) return '';

        let css = `${selector} {\n`;
        Object.entries(styles).forEach(([prop, value]) => {
            if (prop !== '_inline') {
                css += `  ${prop}: ${value};\n`;
            }
        });
        css += '}\n';

        return css;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DOMAnalyzerUtils;
}