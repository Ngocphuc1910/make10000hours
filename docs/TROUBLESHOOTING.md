# Troubleshooting Guide: Supabase Connection Issues

This guide helps diagnose and fix common connection issues with Supabase.

## Common Connection Issues

### "Failed to fetch" Errors

If you see "Failed to fetch" errors when logging in or interacting with Supabase, follow these troubleshooting steps:

1. **Check your internet connection**
   - Make sure you have a stable internet connection
   - Try accessing other websites to verify your connectivity
   - Disable any VPNs temporarily to see if that resolves the issue

2. **Check Supabase service status**
   - Visit [Supabase Status Page](https://status.supabase.com/) to check if there are any reported outages
   - Check if any Supabase maintenance is scheduled or in progress

3. **Verify environment variables**
   - Make sure your `.env` file exists and contains the correct values
   - The format should be:
     ```
     REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
     REACT_APP_SUPABASE_ANON_KEY=your-actual-anon-key
     ```
   - Do not use placeholder values
   - Ensure there are no extra spaces
   - After updating environment variables, restart your development server

4. **Check CORS settings**
   - In your Supabase dashboard, go to Project Settings > API
   - Add your application domain to the allowed domains list
   - For local development, ensure `http://localhost:3000` is included

5. **Browser issues**
   - Clear your browser cache and cookies
   - Try a different browser to see if the issue persists
   - Disable any browser extensions that might be interfering with network requests

## Using the Diagnostic Tools

This application includes built-in diagnostic tools to help identify connection issues:

1. **Run the diagnostics from the login screen**
   - If you see a "Run Connection Diagnostics" button on the login screen, click it
   - This will run a series of tests and display results
   - Look for specific errors and follow the recommended actions

2. **Use the browser console tool**
   - Open your browser developer tools (F12 or right-click > Inspect)
   - Go to the Console tab
   - Type `debugSupabase()` and press Enter
   - Review the diagnostic results for specific issues

## Fixing Specific Issues

### Environment Variable Problems

If the diagnostics show environment variable issues:

1. Create or update your `.env` file in the project root
2. Add your Supabase URL and key from the Supabase dashboard
3. Make sure the values are not placeholders
4. Restart your development server

### Network Connectivity Issues

If the diagnostics show network connectivity issues:

1. Check if your network blocks certain outgoing connections
2. Try using a different network (e.g., switch from WiFi to mobile hotspot)
3. Temporarily disable any firewalls or security software
4. Check if your browser has permission to make network requests

### API Key Issues

If your API key is incorrect or expired:

1. Go to your Supabase project dashboard
2. Navigate to Project Settings > API
3. Copy the "anon public" key (not the secret key)
4. Update your `.env` file with the new key
5. Restart your development server

## Still Having Issues?

If you've tried all the steps above and are still experiencing connection problems:

1. Check the browser console for detailed error messages
2. Ensure you're using a supported browser (latest Chrome, Firefox, Safari, or Edge)
3. Verify that your Supabase project is active and not paused
4. Check if your Supabase project has reached usage limits
5. Contact Supabase support with specific error details

## Contact Support

If you need additional help, please provide the following information:

1. Error messages from the console
2. Screenshots of the issue
3. Diagnostic tool results
4. Steps you've already tried
5. Browser and operating system information

Send these details to the support team for faster resolution. 