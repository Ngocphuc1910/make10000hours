import React from 'react';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <div style={{ 
      maxWidth: '900px', 
      margin: '0 auto', 
      padding: '48px 24px', 
      backgroundColor: '#ffffff', 
      color: '#333333',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      lineHeight: '1.6'
    }}>
      <div style={{ 
        backgroundColor: '#ffffff', 
        borderRadius: '16px', 
        border: '1px solid #e1e5e9', 
        padding: '64px 48px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{ 
            fontSize: '42px', 
            fontWeight: '700', 
            color: '#1f2937', 
            marginBottom: '16px',
            letterSpacing: '-0.025em'
          }}>Privacy Policy</h1>
          <p style={{ 
            fontSize: '18px', 
            color: '#6b7280', 
            marginBottom: '0',
            fontWeight: '400'
          }}>
            Focus Time Tracker Chrome Extension
          </p>
        </div>
        
        <div style={{ maxWidth: 'none' }}>
          <div style={{ 
            backgroundColor: '#f8fafc', 
            borderRadius: '12px', 
            padding: '24px',
            marginBottom: '48px',
            border: '1px solid #e2e8f0'
          }}>
            <p style={{ 
              fontSize: '16px', 
              color: '#475569', 
              marginBottom: '0',
              fontWeight: '500'
            }}>
              <strong style={{ color: '#1f2937' }}>Effective Date:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <section style={{ marginBottom: '48px' }}>
            <h2 style={{ 
              fontSize: '28px', 
              fontWeight: '600', 
              color: '#1f2937', 
              marginBottom: '20px',
              borderBottom: '2px solid #e5e7eb',
              paddingBottom: '12px'
            }}>Introduction</h2>
            <p style={{ 
              color: '#4b5563', 
              marginBottom: '0',
              fontSize: '16px',
              lineHeight: '1.7'
            }}>
              Focus Time Tracker ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how our Chrome browser extension collects, uses, and protects your information when you use our productivity and focus tracking service.
            </p>
          </section>

          <section style={{ marginBottom: '48px' }}>
            <h2 style={{ 
              fontSize: '28px', 
              fontWeight: '600', 
              color: '#1f2937', 
              marginBottom: '20px',
              borderBottom: '2px solid #e5e7eb',
              paddingBottom: '12px'
            }}>Information We Collect</h2>
            
            <div style={{ 
              backgroundColor: '#f0f9ff', 
              borderRadius: '12px', 
              padding: '24px',
              marginBottom: '32px',
              border: '1px solid #bae6fd'
            }}>
              <h3 style={{ 
                fontSize: '22px', 
                fontWeight: '600', 
                color: '#0c4a6e', 
                marginBottom: '16px'
              }}>Data Collected Locally</h3>
              <p style={{ 
                color: '#0369a1', 
                marginBottom: '20px',
                fontSize: '16px',
                lineHeight: '1.7'
              }}>
                Our extension collects and stores the following information locally on your device:
              </p>
              <ul style={{ 
                listStyleType: 'none', 
                paddingLeft: '0', 
                color: '#0c4a6e', 
                marginBottom: '0', 
                lineHeight: '1.8'
              }}>
                <li style={{ marginBottom: '12px', position: 'relative', paddingLeft: '24px' }}>
                  <span style={{ position: 'absolute', left: '0', top: '0', color: '#0ea5e9' }}>•</span>
                  <strong>Website URLs:</strong> The web addresses of sites you visit for time tracking purposes
                </li>
                <li style={{ marginBottom: '12px', position: 'relative', paddingLeft: '24px' }}>
                  <span style={{ position: 'absolute', left: '0', top: '0', color: '#0ea5e9' }}>•</span>
                  <strong>Time Data:</strong> Duration spent on each website and total browsing time
                </li>
                <li style={{ marginBottom: '12px', position: 'relative', paddingLeft: '24px' }}>
                  <span style={{ position: 'absolute', left: '0', top: '0', color: '#0ea5e9' }}>•</span>
                  <strong>User Activity:</strong> Active/inactive status to ensure accurate time tracking
                </li>
                <li style={{ marginBottom: '12px', position: 'relative', paddingLeft: '24px' }}>
                  <span style={{ position: 'absolute', left: '0', top: '0', color: '#0ea5e9' }}>•</span>
                  <strong>Blocked Sites List:</strong> Websites you choose to block during focus sessions
                </li>
                <li style={{ marginBottom: '12px', position: 'relative', paddingLeft: '24px' }}>
                  <span style={{ position: 'absolute', left: '0', top: '0', color: '#0ea5e9' }}>•</span>
                  <strong>Focus Session Data:</strong> Duration and statistics of your focus mode sessions
                </li>
                <li style={{ marginBottom: '0', position: 'relative', paddingLeft: '24px' }}>
                  <span style={{ position: 'absolute', left: '0', top: '0', color: '#0ea5e9' }}>•</span>
                  <strong>User Preferences:</strong> Your settings and configuration choices
                </li>
              </ul>
            </div>

            <div style={{ 
              backgroundColor: '#f0fdf4', 
              borderRadius: '12px', 
              padding: '24px',
              border: '1px solid #bbf7d0'
            }}>
              <h3 style={{ 
                fontSize: '22px', 
                fontWeight: '600', 
                color: '#14532d', 
                marginBottom: '16px'
              }}>Data We Do NOT Collect</h3>
              <ul style={{ 
                listStyleType: 'none', 
                paddingLeft: '0', 
                color: '#15803d', 
                marginBottom: '0', 
                lineHeight: '1.8'
              }}>
                <li style={{ marginBottom: '12px', position: 'relative', paddingLeft: '24px' }}>
                  <span style={{ position: 'absolute', left: '0', top: '0', color: '#22c55e' }}>✓</span>
                  Personal identifying information (name, email, address, phone number)
                </li>
                <li style={{ marginBottom: '12px', position: 'relative', paddingLeft: '24px' }}>
                  <span style={{ position: 'absolute', left: '0', top: '0', color: '#22c55e' }}>✓</span>
                  Website content, page text, or form data
                </li>
                <li style={{ marginBottom: '12px', position: 'relative', paddingLeft: '24px' }}>
                  <span style={{ position: 'absolute', left: '0', top: '0', color: '#22c55e' }}>✓</span>
                  Passwords or authentication information
                </li>
                <li style={{ marginBottom: '12px', position: 'relative', paddingLeft: '24px' }}>
                  <span style={{ position: 'absolute', left: '0', top: '0', color: '#22c55e' }}>✓</span>
                  Financial or payment information
                </li>
                <li style={{ marginBottom: '12px', position: 'relative', paddingLeft: '24px' }}>
                  <span style={{ position: 'absolute', left: '0', top: '0', color: '#22c55e' }}>✓</span>
                  Health information
                </li>
                <li style={{ marginBottom: '12px', position: 'relative', paddingLeft: '24px' }}>
                  <span style={{ position: 'absolute', left: '0', top: '0', color: '#22c55e' }}>✓</span>
                  Location data
                </li>
                <li style={{ marginBottom: '0', position: 'relative', paddingLeft: '24px' }}>
                  <span style={{ position: 'absolute', left: '0', top: '0', color: '#22c55e' }}>✓</span>
                  Personal communications
                </li>
              </ul>
            </div>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#212529', marginBottom: '16px' }}>How We Use Your Information</h2>
            <p style={{ color: '#6c757d', marginBottom: '16px' }}>
              The data we collect is used solely for the following purposes:
            </p>
            <ul style={{ listStyleType: 'disc', paddingLeft: '20px', color: '#6c757d', marginBottom: '16px', lineHeight: '1.6' }}>
              <li style={{ marginBottom: '8px' }}>Tracking time spent on websites to provide productivity insights</li>
              <li style={{ marginBottom: '8px' }}>Enabling focus mode by blocking distracting websites</li>
              <li style={{ marginBottom: '8px' }}>Displaying usage statistics and productivity metrics</li>
              <li style={{ marginBottom: '8px' }}>Maintaining your preferences and settings</li>
              <li style={{ marginBottom: '8px' }}>Providing the core functionality of our time tracking and focus features</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#212529', marginBottom: '16px' }}>Data Storage and Security</h2>
            
            <h3 style={{ fontSize: '20px', fontWeight: '500', color: '#212529', marginBottom: '12px' }}>Local Storage</h3>
            <p style={{ color: '#6c757d', marginBottom: '16px' }}>
              All data is stored locally on your device using Chrome's secure storage APIs. No data is transmitted to external servers or third parties.
            </p>
            
            <h3 style={{ fontSize: '20px', fontWeight: '500', color: '#212529', marginBottom: '12px' }}>Data Security</h3>
            <p style={{ color: '#6c757d', marginBottom: '16px' }}>
              We implement appropriate security measures to protect your data:
            </p>
            <ul style={{ listStyleType: 'disc', paddingLeft: '20px', color: '#6c757d', marginBottom: '16px', lineHeight: '1.6' }}>
              <li style={{ marginBottom: '8px' }}>Data is stored using Chrome's secure local storage mechanisms</li>
              <li style={{ marginBottom: '8px' }}>No data transmission over networks</li>
              <li style={{ marginBottom: '8px' }}>Extension operates with minimal required permissions</li>
              <li style={{ marginBottom: '8px' }}>Regular security updates and maintenance</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#212529', marginBottom: '16px' }}>Data Sharing and Third Parties</h2>
            <p style={{ color: '#6c757d', marginBottom: '16px' }}>
              <strong>We do not sell, trade, or transfer your data to third parties.</strong> Your information remains on your device and is not shared with:
            </p>
            <ul style={{ listStyleType: 'disc', paddingLeft: '20px', color: '#6c757d', marginBottom: '16px', lineHeight: '1.6' }}>
              <li style={{ marginBottom: '8px' }}>Advertising companies</li>
              <li style={{ marginBottom: '8px' }}>Analytics services</li>
              <li style={{ marginBottom: '8px' }}>Data brokers</li>
              <li style={{ marginBottom: '8px' }}>Marketing companies</li>
              <li style={{ marginBottom: '8px' }}>Any external parties</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#212529', marginBottom: '16px' }}>Your Rights and Control</h2>
            <p style={{ color: '#6c757d', marginBottom: '16px' }}>
              You have complete control over your data:
            </p>
            <ul style={{ listStyleType: 'disc', paddingLeft: '20px', color: '#6c757d', marginBottom: '16px', lineHeight: '1.6' }}>
              <li style={{ marginBottom: '8px' }}><strong>Access:</strong> View all stored data through the extension interface</li>
              <li style={{ marginBottom: '8px' }}><strong>Modify:</strong> Change or update your preferences and blocked sites</li>
              <li style={{ marginBottom: '8px' }}><strong>Delete:</strong> Clear all stored data through Chrome's extension settings</li>
              <li style={{ marginBottom: '8px' }}><strong>Export:</strong> Export your data for backup purposes</li>
              <li style={{ marginBottom: '8px' }}><strong>Uninstall:</strong> Remove the extension to delete all associated data</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#212529', marginBottom: '16px' }}>Chrome Extension Permissions</h2>
            <p style={{ color: '#6c757d', marginBottom: '16px' }}>
              Our extension requests the following permissions:
            </p>
            <ul style={{ listStyleType: 'disc', paddingLeft: '20px', color: '#6c757d', marginBottom: '16px', lineHeight: '1.6' }}>
              <li style={{ marginBottom: '8px' }}><strong>activeTab:</strong> To track the currently active tab for time measurement</li>
              <li style={{ marginBottom: '8px' }}><strong>storage:</strong> To save your preferences and tracking data locally</li>
              <li style={{ marginBottom: '8px' }}><strong>tabs:</strong> To monitor tab changes for accurate time tracking</li>
              <li style={{ marginBottom: '8px' }}><strong>declarativeNetRequest:</strong> To block distracting websites during focus mode</li>
              <li style={{ marginBottom: '8px' }}><strong>webNavigation:</strong> To detect page changes within tabs</li>
              <li style={{ marginBottom: '8px' }}><strong>host permissions:</strong> To track time across all websites you choose to monitor</li>
            </ul>
            <p style={{ color: '#6c757d', marginBottom: '16px' }}>
              These permissions are used exclusively for the extension's core functionality and are not used to collect unnecessary data.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#212529', marginBottom: '16px' }}>Updates to This Policy</h2>
            <p style={{ color: '#6c757d', marginBottom: '16px' }}>
              We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date. We encourage you to review this policy periodically to stay informed about how we protect your information.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#212529', marginBottom: '16px' }}>Contact Information</h2>
            <p style={{ color: '#6c757d', marginBottom: '16px' }}>
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div style={{ backgroundColor: '#e9ecef', borderRadius: '8px', padding: '16px', border: '1px solid #dee2e6' }}>
              <p style={{ color: '#6c757d' }}>
                <strong>Email:</strong> privacy@make10000hours.com<br />
                <strong>Website:</strong> https://make10000hours.com/privacy-policy
              </p>
            </div>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#212529', marginBottom: '16px' }}>Compliance</h2>
            <p style={{ color: '#6c757d', marginBottom: '16px' }}>
              This extension operates in compliance with:
            </p>
            <ul style={{ listStyleType: 'disc', paddingLeft: '20px', color: '#6c757d', marginBottom: '16px', lineHeight: '1.6' }}>
              <li style={{ marginBottom: '8px' }}>Chrome Web Store Developer Program Policies</li>
              <li style={{ marginBottom: '8px' }}>General Data Protection Regulation (GDPR) principles</li>
              <li style={{ marginBottom: '8px' }}>California Consumer Privacy Act (CCPA) requirements</li>
              <li style={{ marginBottom: '8px' }}>Privacy best practices for browser extensions</li>
            </ul>
          </section>

          <div style={{ marginTop: '48px', paddingTop: '32px', borderTop: '1px solid #dee2e6' }}>
            <p style={{ fontSize: '14px', color: '#868e96' }}>
              This privacy policy is specific to the Focus Time Tracker Chrome extension and governs the collection and use of information through our browser extension only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage; 