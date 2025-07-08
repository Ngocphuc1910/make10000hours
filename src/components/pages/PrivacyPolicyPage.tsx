import React, { useEffect } from 'react';
import MainLayout from '../layout/MainLayout';

const PrivacyPolicyPage: React.FC = () => {
  useEffect(() => {
    // Set the effective date to today's date
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const effectiveDateElement = document.getElementById('effective-date');
    const lastUpdatedElement = document.getElementById('last-updated');
    
    if (effectiveDateElement) {
      effectiveDateElement.textContent = today.toLocaleDateString('en-US', options);
    }
    if (lastUpdatedElement) {
      lastUpdatedElement.textContent = today.toLocaleDateString('en-US', options);
    }
  }, []);

  return (
    <MainLayout>
      <div className="w-full max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-lg p-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Privacy Policy</h1>
            <p className="text-lg text-gray-600">Focus Time Tracker Chrome Extension</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <p className="text-gray-700">
              <strong>Effective Date:</strong> <span id="effective-date">July 8, 2025</span>
            </p>
          </div>

          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Introduction</h2>
              <p className="text-gray-700 mb-4">
                Focus Time Tracker ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how our Chrome browser extension collects, uses, and protects your information when you use our productivity and focus tracking service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Information We Collect</h2>
              
              <div className="bg-blue-50 rounded-lg p-6 mb-6">
                <h3 className="text-xl font-semibold text-blue-900 mb-3">Data Collected Locally</h3>
                <p className="text-blue-800 mb-3">Our extension collects and stores the following information locally on your device:</p>
                <ul className="list-disc list-inside text-blue-800 space-y-2">
                  <li><strong>Website URLs:</strong> The web addresses of sites you visit for time tracking purposes</li>
                  <li><strong>Time Data:</strong> Duration spent on each website and total browsing time</li>
                  <li><strong>User Activity:</strong> Active/inactive status to ensure accurate time tracking</li>
                  <li><strong>Settings and Preferences:</strong> Your configuration choices within the extension</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Your Information</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Track and display your website usage time</li>
                <li>Provide productivity insights and analytics</li>
                <li>Enable focus session management</li>
                <li>Improve extension functionality and user experience</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Storage and Security</h2>
              <p className="text-gray-700 mb-4">
                All data collected by our extension is stored locally on your device using Chrome's storage APIs. We implement industry-standard security measures to protect your information from unauthorized access, alteration, or disclosure.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Rights</h2>
              <p className="text-gray-700 mb-4">You have the right to:</p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Access, modify, or delete your data through the extension settings</li>
                <li>Disable or uninstall the extension at any time</li>
                <li>Request information about your data usage</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Information</h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-700 mb-2">
                  <strong>Email:</strong> support@make10000hours.com
                </p>
                <p className="text-gray-700 mb-2">
                  <strong>Website:</strong> https://make10000hours.com/privacy-policy
                </p>
                <p className="text-gray-700">
                  <strong>Last Updated:</strong> <span id="last-updated">July 8, 2025</span>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to This Policy</h2>
              <p className="text-gray-700">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center">
              This privacy policy is specific to the Focus Time Tracker Chrome extension and governs the collection and use of information through our browser extension only.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default PrivacyPolicyPage;