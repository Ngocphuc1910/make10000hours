/**
 * Firebase Index Management Utilities
 * Automates index creation and management for faster development
 */

export class FirebaseIndexManager {
  
  /**
   * Extract index requirements from Firebase error URLs
   */
  static extractIndexFromErrorUrl(errorUrl: string): any {
    try {
      // Parse the Firebase console URL to extract index configuration
      const url = new URL(errorUrl);
      const params = new URLSearchParams(url.search);
      
      // Extract collection and field information from URL parameters
      const collectionId = params.get('collectionId');
      const fields = params.get('fields');
      
      if (collectionId && fields) {
        const fieldArray = fields.split(',').map(field => {
          const [fieldPath, order] = field.split(':');
          return {
            fieldPath: fieldPath.trim(),
            order: order?.toUpperCase() === 'DESC' ? 'DESCENDING' : 'ASCENDING'
          };
        });
        
        return {
          collectionGroup: collectionId,
          queryScope: 'COLLECTION',
          fields: fieldArray
        };
      }
    } catch (error) {
      console.error('Failed to parse Firebase error URL:', error);
    }
    return null;
  }

  /**
   * Generate firestore.indexes.json content with common productivity app indexes
   */
  static generateProductivityIndexes(): any {
    return {
      indexes: [
        // Essential task management indexes
        {
          collectionGroup: "tasks",
          queryScope: "COLLECTION",
          fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "completed", order: "ASCENDING" },
            { fieldPath: "createdAt", order: "DESCENDING" }
          ]
        },
        {
          collectionGroup: "tasks", 
          queryScope: "COLLECTION",
          fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "projectName", order: "ASCENDING" },
            { fieldPath: "completed", order: "ASCENDING" }
          ]
        },
        {
          collectionGroup: "tasks",
          queryScope: "COLLECTION", 
          fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "project", order: "ASCENDING" },
            { fieldPath: "completed", order: "ASCENDING" }
          ]
        },
        {
          collectionGroup: "tasks",
          queryScope: "COLLECTION",
          fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "priority", order: "DESCENDING" },
            { fieldPath: "createdAt", order: "DESCENDING" }
          ]
        },
        {
          collectionGroup: "tasks",
          queryScope: "COLLECTION",
          fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "projectName", order: "ASCENDING" },
            { fieldPath: "timeSpent", order: "DESCENDING" }
          ]
        },
        {
          collectionGroup: "tasks",
          queryScope: "COLLECTION",
          fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "project", order: "ASCENDING" },
            { fieldPath: "timeSpent", order: "DESCENDING" }
          ]
        },

        // Work session indexes
        {
          collectionGroup: "workSessions",
          queryScope: "COLLECTION",
          fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "startTime", order: "DESCENDING" }
          ]
        },
        {
          collectionGroup: "workSessions",
          queryScope: "COLLECTION", 
          fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "projectId", order: "ASCENDING" },
            { fieldPath: "startTime", order: "DESCENDING" }
          ]
        },
        {
          collectionGroup: "workSessions",
          queryScope: "COLLECTION",
          fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "startTime", order: "ASCENDING" },
            { fieldPath: "endTime", order: "ASCENDING" }
          ]
        },

        // Project indexes
        {
          collectionGroup: "projects",
          queryScope: "COLLECTION",
          fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "active", order: "ASCENDING" },
            { fieldPath: "createdAt", order: "DESCENDING" }
          ]
        },
        {
          collectionGroup: "projects",
          queryScope: "COLLECTION",
          fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "createdAt", order: "DESCENDING" }
          ]
        },

        // Analytics indexes
        {
          collectionGroup: "analytics",
          queryScope: "COLLECTION_GROUP",
          fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "date", order: "DESCENDING" }
          ]
        },

        // Deep focus session indexes
        {
          collectionGroup: "deepFocusSessions",
          queryScope: "COLLECTION",
          fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "startTime", order: "DESCENDING" }
          ]
        }
      ],
      fieldOverrides: [
        {
          collectionGroup: "tasks",
          fieldPath: "description",
          indexes: []
        },
        {
          collectionGroup: "tasks",
          fieldPath: "tags",
          indexes: [
            { arrayConfig: "CONTAINS", queryScope: "COLLECTION" }
          ]
        }
      ]
    };
  }

  /**
   * Generate CLI commands for manual index creation
   */
  static generateFirebaseCLICommands(): string[] {
    return [
      '# Step 1: Initialize Firestore rules and indexes (if not done)',
      'firebase init firestore',
      '',
      '# Step 2: Deploy all indexes at once',
      'firebase deploy --only firestore:indexes',
      '',
      '# Step 3: Check index build status', 
      'firebase firestore:indexes',
      '',
      '# Step 4: If you want to deploy rules too',
      'firebase deploy --only firestore',
      '',
      '# Tip: You can also deploy specific indexes by editing firestore.indexes.json'
    ];
  }

  /**
   * Generate a comprehensive firestore.indexes.json file for the project
   */
  static createIndexFile(): void {
    const indexes = this.generateProductivityIndexes();
    const content = JSON.stringify(indexes, null, 2);
    
    console.log('📄 Generated firestore.indexes.json content:');
    console.log(content);
    
    console.log('\n🚀 To deploy these indexes:');
    this.generateFirebaseCLICommands().forEach(cmd => console.log(cmd));
  }

  /**
   * Analyze common query patterns and suggest missing indexes
   */
  static analyzeQueryPatterns(queries: string[]): any[] {
    const suggestions = [];
    
    queries.forEach(query => {
      if (query.includes('userId') && query.includes('projectName')) {
        suggestions.push({
          reason: 'userId + projectName queries detected',
          index: {
            collectionGroup: "tasks",
            fields: [
              { fieldPath: "userId", order: "ASCENDING" },
              { fieldPath: "projectName", order: "ASCENDING" }
            ]
          }
        });
      }
      
      if (query.includes('timeSpent') && query.includes('orderBy')) {
        suggestions.push({
          reason: 'Time-based analytics queries detected',
          index: {
            collectionGroup: "workSessions", 
            fields: [
              { fieldPath: "userId", order: "ASCENDING" },
              { fieldPath: "duration", order: "DESCENDING" }
            ]
          }
        });
      }
    });
    
    return suggestions;
  }
}