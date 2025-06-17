import { supabase } from './supabase';
import { OpenAIService } from './openai';

/**
 * Direct embedding generator - minimal code, maximum efficiency
 */
export class DirectEmbeddingGenerator {
  
  /**
   * Generate embeddings for all documents missing them
   */
  static async generateMissingEmbeddings(userId: string): Promise<{
    success: boolean;
    processed: number;
    errors: string[];
  }> {
    console.log(`🔧 Generating missing embeddings for user: ${userId}`);
    console.log(`🔍 Debug: User ID length: ${userId.length}, User ID type: ${typeof userId}`);
    
          try {
        // For now, let's use a direct SQL approach to bypass RLS issues
        console.log(`🔍 Debug: Using direct SQL approach to get documents`);

        // Get documents using SQL to bypass RLS
        const { data: allUserDocs, error: countError } = await supabase.rpc('get_user_documents_for_embedding', {
          target_user_id: userId
        });
      
      console.log(`🔍 Debug: Found ${allUserDocs?.length || 0} total documents for user ${userId}`);
      if (countError) {
        console.log(`🔍 Debug: Count query error:`, countError);
      }

              // Get documents using the same RPC function
        const { data: docs, error } = await supabase.rpc('get_user_documents_for_embedding', {
          target_user_id: userId
        });

              console.log(`🔍 Debug: Raw query returned ${docs?.length || 0} documents`);
        if (docs && docs.length > 0) {
          docs.forEach((doc: any, i: number) => {
            console.log(`  ${i + 1}. ${doc.content_type} (${doc.id.substring(0, 8)}...): embedding=${doc.embedding === null ? 'NULL' : doc.embedding === undefined ? 'UNDEFINED' : 'HAS_VALUE'}`);
          });
        }

        // Filter out documents that already have embeddings
        const docsNeedingEmbeddings = docs?.filter((doc: any) => 
          doc.embedding === null || doc.embedding === undefined
        ) || [];

      console.log(`🔍 Debug: After filtering, ${docsNeedingEmbeddings.length} documents need embeddings`);

      if (error || !docs) {
        throw new Error(`Failed to fetch documents: ${error?.message}`);
      }

      console.log(`📋 Found ${docsNeedingEmbeddings.length} documents needing embeddings`);
      
      const errors: string[] = [];
      let processed = 0;

      // Process each document
      for (const doc of docsNeedingEmbeddings) {
        try {
          console.log(`🔄 Processing: ${doc.content_type} (${doc.id.substring(0, 8)}...)`);
          
          // Generate embedding
          const embedding = await OpenAIService.generateEmbedding({
            content: doc.content,
            contentType: doc.content_type as any
          });

          // Update document with embedding
          const { error: updateError } = await supabase
            .from('user_productivity_documents')
            .update({ embedding })
            .eq('id', doc.id);

          if (updateError) {
            errors.push(`Failed to update ${doc.id}: ${updateError.message}`);
          } else {
            processed++;
            console.log(`✅ Generated embedding for ${doc.content_type}`);
          }

        } catch (error) {
          const errorMsg = `Failed to process ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`🎯 Complete: ${processed}/${docsNeedingEmbeddings.length} embeddings generated`);
      
      return {
        success: errors.length === 0,
        processed,
        errors
      };

    } catch (error) {
      console.error('❌ Embedding generation failed:', error);
      return {
        success: false,
        processed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Test vector search after embedding generation
   */
  static async testVectorSearch(userId: string, query: string = "productivity summary"): Promise<boolean> {
    try {
      console.log(`🧪 Testing vector search for: "${query}"`);
      
      // Generate query embedding
      const queryEmbedding = await OpenAIService.generateEmbedding({
        content: query,
        contentType: 'note'
      });

      // Search for similar documents
      const { data, error } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.1,
        match_count: 5,
        p_user_id: userId
      });

      if (error) {
        console.error('❌ Vector search failed:', error);
        return false;
      }

      console.log(`✅ Vector search successful: ${data?.length || 0} results`);
      data?.forEach((result: any, i: number) => {
        console.log(`  ${i + 1}. ${result.content_type}: ${result.content.substring(0, 100)}... (similarity: ${result.similarity?.toFixed(3)})`);
      });

      return true;

    } catch (error) {
      console.error('❌ Vector search test failed:', error);
      return false;
    }
  }
} 