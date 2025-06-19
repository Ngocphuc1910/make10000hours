import { supabase } from './supabase';

export interface DatabaseSetupResult {
  success: boolean;
  steps: string[];
  errors: string[];
  executionTime: number;
}

export class DatabaseSetup {
  /**
   * Complete database initialization and optimization
   */
  static async initializeDatabase(): Promise<DatabaseSetupResult> {
    const startTime = Date.now();
    const steps: string[] = [];
    const errors: string[] = [];

    try {
      console.log('🔧 Starting Supabase database setup...');

      // Step 1: Enable extensions
      await this.enableExtensions(steps, errors);

      // Step 2: Create core tables
      await this.createCoreTables(steps, errors);

      // Step 3: Apply HNSW optimizations
      await this.applyHNSWOptimizations(steps, errors);

      // Step 4: Create advanced functions
      await this.createAdvancedFunctions(steps, errors);

      // Step 5: Set up RLS policies
      await this.setupRLSPolicies(steps, errors);

      // Step 6: Create materialized views
      await this.createMaterializedViews(steps, errors);

      const executionTime = Date.now() - startTime;
      console.log(`✅ Database setup completed in ${executionTime}ms`);

      return {
        success: errors.length === 0,
        steps,
        errors,
        executionTime
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Critical setup failure: ${errorMsg}`);
      console.error('❌ Database setup failed:', errorMsg);

      return {
        success: false,
        steps,
        errors,
        executionTime: Date.now() - startTime
      };
    }
  }

  private static async enableExtensions(steps: string[], errors: string[]): Promise<void> {
    try {
      // Enable pgvector extension
      const { error: vectorError } = await supabase.rpc('exec_sql', {
        sql: 'CREATE EXTENSION IF NOT EXISTS vector;'
      });

      if (vectorError) {
        errors.push(`Failed to enable vector extension: ${vectorError.message}`);
      } else {
        steps.push('✅ Enabled pgvector extension');
      }

      // Enable additional useful extensions
      const extensions = [
        'pg_stat_statements',
        'pg_trgm',
        'btree_gin'
      ];

      for (const ext of extensions) {
        try {
          const { error } = await supabase.rpc('exec_sql', {
            sql: `CREATE EXTENSION IF NOT EXISTS ${ext};`
          });
          
          if (!error) {
            steps.push(`✅ Enabled ${ext} extension`);
          }
        } catch (err) {
          // Non-critical extensions
          console.warn(`⚠️ Could not enable ${ext} extension (non-critical)`);
        }
      }

    } catch (error) {
      errors.push(`Extension setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async createCoreTables(steps: string[], errors: string[]): Promise<void> {
    const tables = [
      {
        name: 'embeddings',
        sql: `
          CREATE TABLE IF NOT EXISTS embeddings (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id text NOT NULL,
            content_type text NOT NULL CHECK (content_type IN ('task_aggregate', 'project_summary', 'session', 'site_usage', 'deep_focus', 'user_insight')),
            content_id text NOT NULL,
            content text NOT NULL,
            embedding vector(1536) NOT NULL,
            metadata jsonb NOT NULL DEFAULT '{}',
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now(),
            UNIQUE(user_id, content_type, content_id)
          );
        `
      },
      {
        name: 'conversations',
        sql: `
          CREATE TABLE IF NOT EXISTS conversations (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id text NOT NULL,
            title text NOT NULL,
            is_active boolean DEFAULT true,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
          );
        `
      },
      {
        name: 'chat_messages',
        sql: `
          CREATE TABLE IF NOT EXISTS chat_messages (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            user_id text NOT NULL,
            role text NOT NULL CHECK (role IN ('user', 'assistant')),
            content text NOT NULL,
            sources jsonb,
            metadata jsonb,
            created_at timestamptz DEFAULT now()
          );
        `
      },
      {
        name: 'embedding_jobs',
        sql: `
          CREATE TABLE IF NOT EXISTS embedding_jobs (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id text NOT NULL,
            content_type text NOT NULL,
            content_ids text[] NOT NULL,
            status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
            progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
            error text,
            created_at timestamptz DEFAULT now(),
            completed_at timestamptz
          );
        `
      }
    ];

    for (const table of tables) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: table.sql });
        
        if (error) {
          errors.push(`Failed to create ${table.name} table: ${error.message}`);
        } else {
          steps.push(`✅ Created ${table.name} table`);
        }
      } catch (error) {
        errors.push(`Table creation error for ${table.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private static async applyHNSWOptimizations(steps: string[], errors: string[]): Promise<void> {
    const optimizations = [
      {
        name: 'Drop old IVFFlat index',
        sql: 'DROP INDEX IF EXISTS embeddings_embedding_idx;'
      },
      {
        name: 'Create HNSW index for embeddings',
        sql: `
          CREATE INDEX IF NOT EXISTS embeddings_embedding_hnsw_idx 
          ON embeddings USING hnsw (embedding vector_cosine_ops) 
          WITH (m = 16, ef_construction = 200);
        `
      },
      {
        name: 'Create partial index for active content',
        sql: `
          CREATE INDEX IF NOT EXISTS embeddings_user_content_active_idx 
          ON embeddings (user_id, content_type, created_at DESC) 
          WHERE metadata->>'status' != 'archived';
        `
      },
      {
        name: 'Create partial index for recent embeddings',
        sql: `
          CREATE INDEX IF NOT EXISTS embeddings_recent_idx 
          ON embeddings (user_id, created_at DESC) 
          WHERE created_at > (now() - interval '30 days');
        `
      },
      {
        name: 'Create GIN index for metadata queries',
        sql: `
          CREATE INDEX IF NOT EXISTS embeddings_metadata_gin_idx 
          ON embeddings USING gin (metadata);
        `
      },
      {
        name: 'Create composite index for user content lookups',
        sql: `
          CREATE INDEX IF NOT EXISTS embeddings_user_content_composite_idx 
          ON embeddings (user_id, content_type, content_id);
        `
      }
    ];

    for (const opt of optimizations) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: opt.sql });
        
        if (error) {
          errors.push(`Failed to apply ${opt.name}: ${error.message}`);
        } else {
          steps.push(`✅ Applied ${opt.name}`);
        }
      } catch (error) {
        errors.push(`Optimization error for ${opt.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private static async createAdvancedFunctions(steps: string[], errors: string[]): Promise<void> {
    const functions = [
      {
        name: 'Enhanced match documents function',
        sql: `
          CREATE OR REPLACE FUNCTION enhanced_match_documents(
            query_embedding vector(1536),
            match_threshold float DEFAULT 0.78,
            match_count int DEFAULT 10,
            filter_user_id text DEFAULT NULL,
            filter_content_type text DEFAULT NULL
          )
          RETURNS TABLE (
            id uuid,
            content text,
            metadata jsonb,
            similarity float
          )
          LANGUAGE plpgsql
          AS $$
          BEGIN
            RETURN QUERY
            SELECT
              e.id,
              e.content,
              e.metadata,
              1 - (e.embedding <=> query_embedding) AS similarity
            FROM embeddings e
            WHERE 
              (filter_user_id IS NULL OR e.user_id = filter_user_id)
              AND (filter_content_type IS NULL OR e.content_type = filter_content_type)
              AND 1 - (e.embedding <=> query_embedding) > match_threshold
            ORDER BY e.embedding <=> query_embedding
            LIMIT match_count;
          END;
          $$;
        `
      },
      {
        name: 'Hybrid search function',
        sql: `
          CREATE OR REPLACE FUNCTION hybrid_search_documents(
            query_embedding vector(1536),
            search_text text DEFAULT NULL,
            match_threshold float DEFAULT 0.78,
            match_count int DEFAULT 10,
            user_id_filter text DEFAULT NULL
          )
          RETURNS TABLE (
            id uuid,
            content text,
            metadata jsonb,
            vector_similarity float,
            text_rank float,
            hybrid_score float
          )
          LANGUAGE plpgsql
          AS $$
          DECLARE
            vector_weight float := 0.7;
            text_weight float := 0.3;
          BEGIN
            RETURN QUERY
            SELECT
              e.id,
              e.content,
              e.metadata,
              (1 - (e.embedding <=> query_embedding)) AS vector_similarity,
              CASE 
                WHEN search_text IS NOT NULL THEN 
                  ts_rank_cd(to_tsvector('english', e.content), plainto_tsquery('english', search_text))
                ELSE 0.0
              END AS text_rank,
              (vector_weight * (1 - (e.embedding <=> query_embedding)) + 
               text_weight * CASE 
                 WHEN search_text IS NOT NULL THEN 
                   ts_rank_cd(to_tsvector('english', e.content), plainto_tsquery('english', search_text))
                 ELSE 0.0
               END) AS hybrid_score
            FROM embeddings e
            WHERE 
              (user_id_filter IS NULL OR e.user_id = user_id_filter)
              AND (1 - (e.embedding <=> query_embedding)) > match_threshold
              AND (search_text IS NULL OR to_tsvector('english', e.content) @@ plainto_tsquery('english', search_text))
            ORDER BY hybrid_score DESC
            LIMIT match_count;
          END;
          $$;
        `
      },
      {
        name: 'Update timestamp trigger function',
        sql: `
          CREATE OR REPLACE FUNCTION update_updated_at_column()
          RETURNS TRIGGER AS $$
          BEGIN
            NEW.updated_at = now();
            RETURN NEW;
          END;
          $$ language 'plpgsql';
        `
      }
    ];

    for (const func of functions) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: func.sql });
        
        if (error) {
          errors.push(`Failed to create ${func.name}: ${error.message}`);
        } else {
          steps.push(`✅ Created ${func.name}`);
        }
      } catch (error) {
        errors.push(`Function creation error for ${func.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private static async setupRLSPolicies(steps: string[], errors: string[]): Promise<void> {
    const policies = [
      {
        name: 'Enable RLS on embeddings',
        sql: 'ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;'
      },
      {
        name: 'Enable RLS on conversations',
        sql: 'ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;'
      },
      {
        name: 'Enable RLS on chat_messages',
        sql: 'ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;'
      },
      {
        name: 'Enable RLS on embedding_jobs',
        sql: 'ALTER TABLE embedding_jobs ENABLE ROW LEVEL SECURITY;'
      },
      {
        name: 'Embeddings RLS policy',
        sql: `
          CREATE POLICY "Users can only access their own embeddings" ON embeddings
          FOR ALL USING (user_id = auth.uid()::text);
        `
      },
      {
        name: 'Conversations RLS policy',
        sql: `
          CREATE POLICY "Users can only access their own conversations" ON conversations
          FOR ALL USING (user_id = auth.uid()::text);
        `
      },
      {
        name: 'Chat messages RLS policy',
        sql: `
          CREATE POLICY "Users can only access their own chat messages" ON chat_messages
          FOR ALL USING (user_id = auth.uid()::text);
        `
      },
      {
        name: 'Embedding jobs RLS policy',
        sql: `
          CREATE POLICY "Users can only access their own embedding jobs" ON embedding_jobs
          FOR ALL USING (user_id = auth.uid()::text);
        `
      }
    ];

    for (const policy of policies) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: policy.sql });
        
        if (error && !error.message.includes('already exists')) {
          errors.push(`Failed to apply ${policy.name}: ${error.message}`);
        } else {
          steps.push(`✅ Applied ${policy.name}`);
        }
      } catch (error) {
        errors.push(`RLS policy error for ${policy.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private static async createMaterializedViews(steps: string[], errors: string[]): Promise<void> {
    const views = [
      {
        name: 'User embedding statistics view',
        sql: `
          CREATE MATERIALIZED VIEW IF NOT EXISTS user_embedding_stats AS
          SELECT 
            user_id,
            content_type,
            COUNT(*) as total_embeddings,
            AVG(length(content)) as avg_content_length,
            MAX(created_at) as last_embedding_created,
            COUNT(CASE WHEN created_at > now() - interval '7 days' THEN 1 END) as recent_embeddings
          FROM embeddings
          GROUP BY user_id, content_type;
        `
      },
      {
        name: 'Create unique index on user embedding stats',
        sql: `
          CREATE UNIQUE INDEX IF NOT EXISTS user_embedding_stats_unique_idx 
          ON user_embedding_stats (user_id, content_type);
        `
      }
    ];

    for (const view of views) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: view.sql });
        
        if (error) {
          errors.push(`Failed to create ${view.name}: ${error.message}`);
        } else {
          steps.push(`✅ Created ${view.name}`);
        }
      } catch (error) {
        errors.push(`View creation error for ${view.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Check if database is properly initialized
   */
  static async checkDatabaseHealth(): Promise<{
    isHealthy: boolean;
    missingComponents: string[];
    recommendations: string[];
  }> {
    const missingComponents: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check core tables
      const tables = ['embeddings', 'conversations', 'chat_messages', 'embedding_jobs'];
      
      for (const table of tables) {
        try {
          const { error } = await supabase.from(table).select('id').limit(1);
          if (error && error.code === '42P01') {
            missingComponents.push(`Table: ${table}`);
          }
        } catch (err) {
          missingComponents.push(`Table: ${table}`);
        }
      }

      // Check extensions
      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql: "SELECT 1 FROM pg_extension WHERE extname = 'vector';"
        });
        if (error) {
          missingComponents.push('Extension: pgvector');
        }
      } catch (err) {
        missingComponents.push('Extension: pgvector');
      }

      // Generate recommendations
      if (missingComponents.length > 0) {
        recommendations.push('Run DatabaseSetup.initializeDatabase() to fix missing components');
      }

      if (missingComponents.some(comp => comp.includes('embeddings'))) {
        recommendations.push('Critical: Embeddings table missing - RAG functionality will not work');
      }

      return {
        isHealthy: missingComponents.length === 0,
        missingComponents,
        recommendations
      };

    } catch (error) {
      return {
        isHealthy: false,
        missingComponents: ['Database connection failed'],
        recommendations: ['Check Supabase connection and credentials']
      };
    }
  }

  /**
   * Apply database migration if needed
   */
  static async applyMigrationIfNeeded(): Promise<DatabaseSetupResult> {
    console.log('🔍 Checking database health...');
    
    const health = await this.checkDatabaseHealth();
    
    if (health.isHealthy) {
      console.log('✅ Database is healthy, no migration needed');
      return {
        success: true,
        steps: ['Database already healthy'],
        errors: [],
        executionTime: 0
      };
    }

    console.log('⚠️ Database needs setup. Missing components:', health.missingComponents);
    return await this.initializeDatabase();
  }

  static async createTables(): Promise<void> {
    try {
      console.log('🔧 Setting up database tables...');

      // Create user_productivity_documents table
      const { error: tableError } = await supabase.rpc('create_user_productivity_documents_table');
      if (tableError && !tableError.message.includes('already exists')) {
        throw tableError;
      }

      // Create sync_trackers table for incremental sync
      const { error: syncTrackerError } = await supabase.rpc('create_sync_trackers_table');
      if (syncTrackerError && !syncTrackerError.message.includes('already exists')) {
        console.log('Creating sync_trackers table manually...');
        await this.createSyncTrackersTable();
      }

      // Create search function
      const { error: functionError } = await supabase.rpc('create_match_documents_function');
      if (functionError && !functionError.message.includes('already exists')) {
        throw functionError;
      }

      console.log('✅ Database setup complete');
    } catch (error) {
      console.error('❌ Database setup failed:', error);
      throw error;
    }
  }

  /**
   * Create sync_trackers table manually
   */
  private static async createSyncTrackersTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS sync_trackers (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        collection TEXT NOT NULL,
        last_sync_time TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, collection)
      );
      
      -- Enable RLS
      ALTER TABLE sync_trackers ENABLE ROW LEVEL SECURITY;
      
      -- Create policy for users to only access their own sync trackers
      CREATE POLICY "Users can only access their own sync trackers" ON sync_trackers
        FOR ALL USING (auth.uid()::text = user_id);
      
      -- Create index for efficient queries
      CREATE INDEX IF NOT EXISTS idx_sync_trackers_user_collection 
        ON sync_trackers(user_id, collection);
    `;

    const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    if (error) {
      console.error('Failed to create sync_trackers table:', error);
      throw error;
    }
    
    console.log('✅ sync_trackers table created successfully');
  }
} 