import { 
  collection, 
  addDoc, 
  serverTimestamp,
  Timestamp,
  FieldValue
} from 'firebase/firestore';
import { db } from '../api/firebase';

// Complete Override Session Data Schema
interface OverrideSessionSchema {
  // Core identification
  id?: string;
  userId: string;
  
  // Session details
  domain: string;
  url?: string;
  duration: number; // in minutes (default: 5)
  
  // Timestamps
  createdAt: Timestamp | Date | FieldValue;
  updatedAt?: Timestamp | Date | FieldValue;
  
  // Deep Focus integration
  deepFocusSessionId?: string;
  
  // Additional context
  reason?: 'manual_override' | 'emergency' | 'break_time';
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
  };
  
  // Metadata
  metadata?: {
    extensionVersion?: string;
    overrideCount?: number; // How many times user overrode this session
  };
}

// Validation schema
const OverrideSessionValidation = {
  required: ['userId', 'domain', 'duration'],
  types: {
    userId: 'string',
    domain: 'string',
    url: 'string',
    duration: 'number',
    deepFocusSessionId: 'string',
    reason: 'string'
  },
  constraints: {
    duration: { min: 1, max: 120 }, // 1 minute to 2 hours
    domain: { minLength: 3, maxLength: 253 },
    userId: { minLength: 1 }
  }
};

// Default values for new override sessions
const OverrideSessionDefaults = {
  duration: 5, // 5 minutes default
  reason: 'manual_override' as const,
  metadata: {
    overrideCount: 1
  }
};

class OverrideSchemaSetup {
  private readonly collectionName = 'overrideSessions';

  // Validate override session data
  validateOverrideData(data: Partial<OverrideSessionSchema>): {
    isValid: boolean;
    errors: string[];
    sanitizedData?: OverrideSessionSchema;
  } {
    const errors: string[] = [];
    
    // Check required fields
    OverrideSessionValidation.required.forEach(field => {
      if (!data[field as keyof OverrideSessionSchema]) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // Validate data types and constraints
    if (data.userId && typeof data.userId !== 'string') {
      errors.push('userId must be a string');
    }
    
    if (data.domain && typeof data.domain !== 'string') {
      errors.push('domain must be a string');
    }
    
    if (data.duration) {
      if (typeof data.duration !== 'number') {
        errors.push('duration must be a number');
      } else if (data.duration < 1 || data.duration > 120) {
        errors.push('duration must be between 1 and 120 minutes');
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Create sanitized data with defaults - exclude undefined values
    const sanitizedData: any = {
      userId: data.userId!,
      domain: data.domain!,
      duration: data.duration || OverrideSessionDefaults.duration,
      createdAt: serverTimestamp(),
      reason: data.reason || OverrideSessionDefaults.reason,
      metadata: {
        ...OverrideSessionDefaults.metadata,
        ...data.metadata,
        extensionVersion: data.metadata?.extensionVersion || '1.0.0'
      }
    };

    // Only add optional fields if they have values
    if (data.url) {
      sanitizedData.url = data.url;
    }
    
    if (data.deepFocusSessionId) {
      sanitizedData.deepFocusSessionId = data.deepFocusSessionId;
    }
    
    if (data.deviceInfo) {
      sanitizedData.deviceInfo = data.deviceInfo;
    }

    return { isValid: true, errors: [], sanitizedData };
  }

  // Create override session with full validation
  async createValidatedOverrideSession(data: Partial<OverrideSessionSchema>): Promise<{
    success: boolean;
    id?: string;
    errors?: string[];
  }> {
    try {
      console.log('🔄 Validating override session data:', data);
      
      const validation = this.validateOverrideData(data);
      
      if (!validation.isValid) {
        console.error('❌ Validation failed:', validation.errors);
        return { success: false, errors: validation.errors };
      }

      console.log('✅ Validation passed, creating session:', validation.sanitizedData);
      
      const docRef = await addDoc(
        collection(db, this.collectionName), 
        validation.sanitizedData
      );
      
      console.log('✅ Override session created successfully:', {
        id: docRef.id,
        domain: validation.sanitizedData!.domain,
        duration: validation.sanitizedData!.duration + 'min',
        userId: validation.sanitizedData!.userId,
        timestamp: new Date().toISOString()
      });
      
      return { success: true, id: docRef.id };
      
    } catch (error) {
      console.error('❌ Error creating override session:', error);
      return { 
        success: false, 
        errors: [error instanceof Error ? error.message : 'Unknown error'] 
      };
    }
  }

  // Setup collection with sample data for testing
  async setupTestData(userId: string): Promise<void> {
    const testSessions = [
      {
        userId,
        domain: 'facebook.com',
        url: 'https://facebook.com/feed',
        duration: 5,
        reason: 'manual_override' as const,
        deviceInfo: {
          userAgent: 'Test Browser',
          platform: 'Web'
        }
      },
      {
        userId,
        domain: 'instagram.com',
        url: 'https://instagram.com/explore',
        duration: 3,
        reason: 'break_time' as const,
        deviceInfo: {
          userAgent: 'Test Browser',
          platform: 'Web'
        }
      },
      {
        userId,
        domain: 'youtube.com',
        url: 'https://youtube.com/watch',
        duration: 10,
        reason: 'emergency' as const,
        deviceInfo: {
          userAgent: 'Test Browser',
          platform: 'Web'
        }
      }
    ];

    console.log('🔄 Setting up test override sessions...');
    
    for (const session of testSessions) {
      const result = await this.createValidatedOverrideSession(session);
      if (result.success) {
        console.log(`✅ Test session created: ${session.domain} (${session.duration}min)`);
      } else {
        console.error(`❌ Failed to create test session for ${session.domain}:`, result.errors);
      }
    }
  }

  // Get schema information
  getSchemaInfo(): {
    collectionName: string;
    requiredFields: string[];
    optionalFields: string[];
    indexes: string[];
  } {
    return {
      collectionName: this.collectionName,
      requiredFields: OverrideSessionValidation.required,
      optionalFields: [
        'url', 'deepFocusSessionId', 'reason', 'deviceInfo', 'metadata'
      ],
      indexes: [
        'userId + createdAt (composite)',
        'domain (single)',
        'userId (single)'
      ]
    };
  }
}

export const overrideSchemaSetup = new OverrideSchemaSetup();

// Export types and constants for use in other files
export type { OverrideSessionSchema };
export { OverrideSessionDefaults, OverrideSessionValidation }; 