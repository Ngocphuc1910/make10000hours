/**
 * Environment Variable Validator
 * Ensures all required environment variables are properly configured
 */

interface RequiredEnvVar {
  key: string;
  description: string;
  required: boolean;
  validator?: (value: string) => boolean;
}

const requiredEnvVars: RequiredEnvVar[] = [
  {
    key: 'VITE_FIREBASE_API_KEY',
    description: 'Firebase API Key',
    required: true,
    validator: (value) => value.startsWith('AIza') && value.length > 30
  },
  {
    key: 'VITE_FIREBASE_APP_ID',
    description: 'Firebase App ID',
    required: true,
    validator: (value) => value.includes(':') && value.includes('web')
  },
  {
    key: 'VITE_OPENAI_API_KEY',
    description: 'OpenAI API Key',
    required: true,
    validator: (value) => /^sk-[a-zA-Z0-9\-_]{40,}$/.test(value)
  },
  {
    key: 'VITE_GOOGLE_OAUTH_CLIENT_ID',
    description: 'Google OAuth Client ID',
    required: false, // Optional for basic functionality
    validator: (value) => value.endsWith('.apps.googleusercontent.com')
  }
];

export class EnvironmentValidator {
  static validate(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    requiredEnvVars.forEach(({ key, description, required, validator }) => {
      const value = import.meta.env[key];

      if (!value) {
        if (required) {
          errors.push(`Missing required environment variable: ${key} (${description})`);
        } else {
          warnings.push(`Optional environment variable not set: ${key} (${description})`);
        }
        return;
      }

      if (validator && !validator(value)) {
        errors.push(`Invalid format for ${key} (${description})`);
        return;
      }

      // Security check: warn if using placeholder values
      const placeholderPatterns = [
        'your-', 'placeholder', 'example', 'test-key', 'demo-'
      ];
      
      if (placeholderPatterns.some(pattern => value.toLowerCase().includes(pattern))) {
        warnings.push(`${key} appears to be using a placeholder value`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static logValidationResults(): boolean {
    const { isValid, errors, warnings } = this.validate();

    if (process.env.NODE_ENV === 'development') {
      console.group('🔧 Environment Validation');
      
      if (isValid) {
        console.log('✅ All required environment variables are configured');
      } else {
        console.error('❌ Environment validation failed');
        errors.forEach(error => console.error(`  • ${error}`));
      }

      if (warnings.length > 0) {
        console.warn('⚠️ Environment warnings:');
        warnings.forEach(warning => console.warn(`  • ${warning}`));
      }

      console.groupEnd();
    }

    return isValid;
  }

  static getSecurityInfo(): { 
    hasAllKeys: boolean; 
    keyStatus: Record<string, 'configured' | 'missing' | 'invalid'>; 
  } {
    const keyStatus: Record<string, 'configured' | 'missing' | 'invalid'> = {};
    
    requiredEnvVars.forEach(({ key, validator }) => {
      const value = import.meta.env[key];
      
      if (!value) {
        keyStatus[key] = 'missing';
      } else if (validator && !validator(value)) {
        keyStatus[key] = 'invalid';
      } else {
        keyStatus[key] = 'configured';
      }
    });

    const hasAllKeys = Object.values(keyStatus).every(status => status === 'configured');

    return { hasAllKeys, keyStatus };
  }
}

// Auto-validate on import in development
if (process.env.NODE_ENV === 'development') {
  EnvironmentValidator.logValidationResults();
}