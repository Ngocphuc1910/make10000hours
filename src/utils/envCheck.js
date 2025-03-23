/**
 * Environment variable checker utility
 * Helps identify issues with environment configuration
 */

/**
 * Checks if environment variables exist and have valid values
 * @returns {Object} Status of environment variables
 */
export const checkEnvironmentVariables = () => {
  const variables = {
    REACT_APP_SUPABASE_URL: process.env.REACT_APP_SUPABASE_URL,
    REACT_APP_SUPABASE_ANON_KEY: process.env.REACT_APP_SUPABASE_ANON_KEY
  };
  
  const results = {
    allValid: true,
    variables: {},
    summary: ''
  };
  
  // Check each variable
  Object.entries(variables).forEach(([name, value]) => {
    const exists = !!value;
    const isPlaceholder = 
      value && (
        value.includes('YOUR_') || 
        value.includes('PLACEHOLDER') || 
        value.includes('EXAMPLE') ||
        value === 'xxxx' ||
        value === '[PLACEHOLDER]'
      );
      
    const hasValidFormat = name === 'REACT_APP_SUPABASE_URL' 
      ? (value && value.startsWith('https://') && value.includes('.supabase.co'))
      : (value && value.includes('.') && value.length > 30);
    
    const isValid = exists && !isPlaceholder && hasValidFormat;
    
    results.variables[name] = {
      exists,
      isPlaceholder,
      hasValidFormat,
      isValid,
      // Only include truncated values for security
      truncatedValue: value 
        ? `${value.substring(0, 8)}...${value.substring(value.length - 5)}`
        : null
    };
    
    if (!isValid) {
      results.allValid = false;
    }
  });
  
  // Create summary
  if (results.allValid) {
    results.summary = 'All environment variables are valid';
  } else {
    const issues = [];
    
    if (!results.variables.REACT_APP_SUPABASE_URL.exists) {
      issues.push('Supabase URL is missing');
    } else if (results.variables.REACT_APP_SUPABASE_URL.isPlaceholder) {
      issues.push('Supabase URL contains placeholder text');
    } else if (!results.variables.REACT_APP_SUPABASE_URL.hasValidFormat) {
      issues.push('Supabase URL has invalid format');
    }
    
    if (!results.variables.REACT_APP_SUPABASE_ANON_KEY.exists) {
      issues.push('Supabase API key is missing');
    } else if (results.variables.REACT_APP_SUPABASE_ANON_KEY.isPlaceholder) {
      issues.push('Supabase API key contains placeholder text');
    } else if (!results.variables.REACT_APP_SUPABASE_ANON_KEY.hasValidFormat) {
      issues.push('Supabase API key has invalid format');
    }
    
    results.summary = `Environment issues found: ${issues.join(', ')}`;
  }
  
  return results;
};

/**
 * Provides instructions to fix environment issues
 * @returns {string} Instructions on how to fix environment issues
 */
export const getEnvironmentFixInstructions = () => {
  return `
To fix environment variable issues:

1. Create a file named '.env' in the root of your project
2. Add these lines with your actual Supabase values:

REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-from-supabase-dashboard

3. Restart your development server

You can find these values in your Supabase dashboard under Project Settings > API.
`;
}; 