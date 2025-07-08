import React from 'react';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-12">
      <div className="space-y-12">
        <header className="text-center border-b border-border pb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-4">Privacy Policy</h1>
          <p className="text-text-secondary">
            Effective Date: July 8, 2025 | Last Updated: July 8, 2025
          </p>
        </header>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text-primary">Our Privacy Commitment</h2>
          <p className="text-text-secondary leading-relaxed">
            Make10000hours is built by productivity enthusiasts who understand the importance of privacy. We designed this extension with privacy-first principles: your data stays primarily on your device, we never sell your information, and you maintain complete control over what gets shared and when.
          </p>
        </section>

        <section className="space-y-8">
          <h2 className="text-2xl font-semibold text-text-primary">Data We Collect & Why</h2>
          <p className="text-text-secondary leading-relaxed">
            To provide you with meaningful productivity insights and help you build better focus habits, Make10000hours needs to collect certain data about your computer usage. Here's exactly what we collect and why it's necessary:
          </p>

          <div className="space-y-8">
            <div className="border-l-4 border-text-primary pl-6">
              <h3 className="text-lg font-semibold text-text-primary mb-3">Website Activity & Browsing Data</h3>
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-text-primary mb-2">What we collect:</p>
                  <ul className="space-y-1 text-text-secondary">
                    <li>• URLs and titles of websites you visit while the extension is active</li>
                    <li>• Time spent on each website (precise timestamps and duration)</li>
                    <li>• Tab focus events (when you switch between tabs)</li>
                    <li>• Window focus/blur events (when you switch between applications)</li>
                  </ul>
                </div>
                <p className="text-text-secondary">
                  <strong>Why we need this:</strong> This core data enables us to show you where your time goes, identify productivity patterns, and help you understand your digital habits.
                </p>
              </div>
            </div>

            <div className="border-l-4 border-text-secondary pl-6">
              <h3 className="text-lg font-semibold text-text-primary mb-3">User Activity & Behavior</h3>
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-text-primary mb-2">What we collect:</p>
                  <ul className="space-y-1 text-text-secondary">
                    <li>• Mouse movements and clicks (for activity detection)</li>
                    <li>• Keyboard activity indicators (not keystrokes - just activity presence)</li>
                    <li>• Scroll events and window interactions</li>
                    <li>• System sleep/wake detection</li>
                    <li>• Idle time detection (when you're away from computer)</li>
                  </ul>
                </div>
                <p className="text-text-secondary">
                  <strong>Why we need this:</strong> Activity detection helps us differentiate between active work and idle time, ensuring accurate productivity measurements and automatic session pausing when you're away.
                </p>
              </div>
            </div>

            <div className="border-l-4 border-text-secondary pl-6">
              <h3 className="text-lg font-semibold text-text-primary mb-3">Focus Sessions & Productivity Data</h3>
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-text-primary mb-2">What we collect:</p>
                  <ul className="space-y-1 text-text-secondary">
                    <li>• Pomodoro timer sessions (start/end times, duration, completion status)</li>
                    <li>• Deep focus session data and blocking preferences</li>
                    <li>• Websites you choose to block during focus modes</li>
                    <li>• Task management data (tasks you create, time tracking)</li>
                    <li>• Productivity goals and achievements</li>
                  </ul>
                </div>
                <p className="text-text-secondary">
                  <strong>Why we need this:</strong> This data powers your productivity insights, progress tracking, and helps us provide personalized recommendations for better focus habits.
                </p>
              </div>
            </div>

            <div className="border-l-4 border-text-secondary pl-6">
              <h3 className="text-lg font-semibold text-text-primary mb-3">Account & Authentication Data</h3>
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-text-primary mb-2">What we collect (only when you sign in):</p>
                  <ul className="space-y-1 text-text-secondary">
                    <li>• Google account email address and user ID</li>
                    <li>• Display name and profile picture (if provided)</li>
                    <li>• Authentication tokens for secure access</li>
                    <li>• Sync preferences and device information</li>
                  </ul>
                </div>
                <p className="text-text-secondary">
                  <strong>Why we need this:</strong> Authentication enables secure data sync across your devices and provides backup of your productivity data.
                </p>
              </div>
            </div>

            <div className="border-l-4 border-text-secondary pl-6">
              <h3 className="text-lg font-semibold text-text-primary mb-3">Technical & Usage Data</h3>
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-text-primary mb-2">What we collect:</p>
                  <ul className="space-y-1 text-text-secondary">
                    <li>• Extension version and browser information</li>
                    <li>• Error logs and crash reports (for debugging)</li>
                    <li>• Feature usage statistics (which features you use most)</li>
                    <li>• Performance metrics (loading times, response times)</li>
                    <li>• Extension settings and preferences</li>
                  </ul>
                </div>
                <p className="text-text-secondary">
                  <strong>Why we need this:</strong> Technical data helps us fix bugs, improve performance, and understand which features provide the most value to users.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text-primary">How We Use Your Data</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-4">What We DO</h3>
              <ul className="space-y-2 text-text-secondary">
                <li>✓ Display your personal productivity insights</li>
                <li>✓ Calculate time spent on different websites and categories</li>
                <li>✓ Provide focus session tracking and analytics</li>
                <li>✓ Sync your data securely across your devices</li>
                <li>✓ Generate productivity reports and trends</li>
                <li>✓ Improve extension performance and fix bugs</li>
                <li>✓ Provide customer support when you contact us</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-4">What We NEVER Do</h3>
              <ul className="space-y-2 text-text-secondary">
                <li>✗ Sell your data to anyone, ever</li>
                <li>✗ Use your data for advertising or marketing</li>
                <li>✗ Share your browsing data with advertisers</li>
                <li>✗ Allow human access to your personal data without permission</li>
                <li>✗ Track you across the web outside our extension</li>
                <li>✗ Store passwords or sensitive form data</li>
                <li>✗ Monitor your data for non-productivity purposes</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text-primary">Data Storage & Third Party Services</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-3">Local Storage (Your Device)</h3>
              <p className="text-text-secondary leading-relaxed">
                <strong>Primary storage:</strong> All your data is stored locally on your device using Chrome's secure storage APIs. This data remains on your device and is encrypted by Chrome's built-in security. You can use the extension fully offline without any cloud services.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-3">Cloud Storage (Optional - Only When You Sign In)</h3>
              <p className="text-text-secondary leading-relaxed mb-4">
                When you choose to sign in with Google, we use secure cloud services to sync your data across devices:
              </p>
              <div className="space-y-4 text-text-secondary">
                <div>
                  <p className="font-medium">Google Firebase (Google LLC)</p>
                  <ul className="ml-4 space-y-1">
                    <li>• Secure database hosting for your productivity data</li>
                    <li>• User authentication and identity management</li>
                    <li>• Real-time data synchronization between devices</li>
                    <li>• All data encrypted in transit and at rest</li>
                  </ul>
                </div>
                
                <div>
                  <p className="font-medium">Google APIs & Services</p>
                  <ul className="ml-4 space-y-1">
                    <li>• Google Sign-In for secure authentication</li>
                    <li>• Google Favicon API for website icons (URLs only)</li>
                    <li>• Google Analytics for anonymous usage statistics</li>
                  </ul>
                </div>
              </div>
            </div>

            <p className="text-text-secondary italic">
              Security: All data transmission uses HTTPS encryption. Firebase provides enterprise-grade security with SOC 2 Type II compliance. Your data is never transmitted in plain text.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text-primary">Data Sharing & International Transfers</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-3">Who We Share Data With</h3>
              <div className="space-y-3 text-text-secondary">
                <p><strong>Google/Firebase:</strong> When you enable sync, your encrypted productivity data is stored on Google's secure Firebase servers for synchronization purposes only.</p>
                
                <p><strong>No Other Third Parties:</strong> We do not share your personal data with any other companies, advertisers, or third parties.</p>
                
                <p><strong>Legal Requirements:</strong> We may disclose data only if required by law, court order, or to protect our legal rights, but we will notify you unless legally prohibited.</p>
              </div>
            </div>

            <p className="text-text-secondary">
              <strong>International Transfers:</strong> If you enable sync, your data may be processed on Google's servers located in various countries including the United States. Google complies with international privacy frameworks including GDPR and provides adequate data protection safeguards.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text-primary">Data Retention</h2>
          
          <div className="space-y-3 text-text-secondary">
            <p><strong>Local Data:</strong> Retained on your device until you uninstall the extension, clear browser data, or manually delete through extension settings.</p>
            
            <p><strong>Cloud Data:</strong> Retained while your account is active. Automatically deleted 90 days after account deletion or upon request.</p>
            
            <p><strong>Analytics Data:</strong> Anonymous usage statistics retained for up to 26 months per Google Analytics standards.</p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text-primary">Your Privacy Rights & Controls</h2>
          
          <p className="text-text-secondary mb-6">You have complete control over your data and privacy:</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold text-text-primary mb-3">Data Access & Control</h4>
              <ul className="space-y-1 text-text-secondary">
                <li>• View all collected data in the extension</li>
                <li>• Export your data in JSON format</li>
                <li>• Delete specific data points or entire history</li>
                <li>• Clear all local data instantly</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-text-primary mb-3">Privacy Settings</h4>
              <ul className="space-y-1 text-text-secondary">
                <li>• Enable/disable data collection features</li>
                <li>• Control sync settings independently</li>
                <li>• Opt out of analytics collection</li>
                <li>• Manage website tracking exceptions</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-text-primary mb-3">Account Management</h4>
              <ul className="space-y-1 text-text-secondary">
                <li>• Sign out to stop cloud sync immediately</li>
                <li>• Delete account and all cloud data</li>
                <li>• Revoke extension permissions</li>
                <li>• Use extension without signing in</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-text-primary mb-3">Legal Rights (GDPR/CCPA)</h4>
              <ul className="space-y-1 text-text-secondary">
                <li>• Right to access your data</li>
                <li>• Right to rectification (correction)</li>
                <li>• Right to erasure ("right to be forgotten")</li>
                <li>• Right to data portability</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text-primary">Chrome Extension Permissions</h2>
          
          <p className="text-text-secondary mb-4">
            Chrome extensions require explicit permissions to function. Here's what each permission does:
          </p>
          
          <div className="space-y-4 text-text-secondary">
            <div>
              <p className="font-medium">"Read and change all your data on all websites"</p>
              <p className="ml-4">Required to track time spent on websites and detect user activity for productivity measurement.</p>
            </div>
            
            <div>
              <p className="font-medium">"Read your browsing history"</p>
              <p className="ml-4">Required to identify visited websites for time tracking and productivity categorization.</p>
            </div>
            
            <div>
              <p className="font-medium">"Block content on any page you visit"</p>
              <p className="ml-4">Required for focus mode functionality to block distracting websites during focus sessions.</p>
            </div>
            
            <div>
              <p className="font-medium">"Store unlimited amount of client-side data"</p>
              <p className="ml-4">Required to store your productivity data locally on your device for offline access.</p>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text-primary">Contact & Data Requests</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-3">Get in Touch</h3>
              <div className="space-y-2 text-text-secondary">
                <p><strong>Privacy Officer:</strong> privacy@make10000hours.com</p>
                <p><strong>General Support:</strong> support@make10000hours.com</p>
                <p><strong>Data Requests:</strong> data@make10000hours.com</p>
                <p><strong>Website:</strong> https://make10000hours.com</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-3">Response Times</h3>
              <div className="space-y-2 text-text-secondary">
                <p><strong>Privacy requests:</strong> Within 30 days</p>
                <p><strong>Data deletion:</strong> Immediate (local), 72 hours (cloud)</p>
                <p><strong>Support inquiries:</strong> Within 48 hours</p>
                <p><strong>Urgent requests:</strong> Mark email "URGENT - Privacy"</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text-primary">Policy Updates</h2>
          
          <div className="text-text-secondary space-y-4">
            <p>
              We may update this Privacy Policy to reflect changes in our practices, legal requirements, or new features. When we make changes:
            </p>
            <ul className="space-y-1">
              <li>• Material changes will be notified through the extension interface</li>
              <li>• Minor updates will be posted on this page with updated date</li>
              <li>• Email notifications for significant changes (if you're signed in)</li>
              <li>• Continued use after changes constitutes acceptance</li>
            </ul>
            <p>
              You can always review the current policy at any time through the extension or our website.
            </p>
          </div>
        </section>

        <footer className="border-t border-border pt-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-text-secondary mb-6">
            <div>
              <p><strong>Policy Version:</strong> 3.0</p>
              <p><strong>Effective Date:</strong> July 8, 2025</p>
            </div>
            <div>
              <p><strong>Compliance:</strong> GDPR, CCPA, PIPEDA</p>
              <p><strong>Chrome Web Store:</strong> Compliant</p>
            </div>
            <div>
              <p><strong>Framework:</strong> Privacy by Design</p>
              <p><strong>Audit:</strong> Last reviewed July 2025</p>
            </div>
          </div>

          <div className="text-center text-text-secondary">
            <p className="leading-relaxed">
              By installing and using Make10000hours, you acknowledge that you have read, understood, and agree to this Privacy Policy. 
              Your privacy is important to us, and we're committed to protecting it while helping you achieve your productivity goals.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;