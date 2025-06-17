import { OpenAIService } from './openai';
import { supabase } from './supabase';
import { ProductivityChunk } from './semanticChunker';
import { ProcessedContent } from './contentPreprocessor';

export interface BatchConfig {
  batchSize: number;
  rateLimitDelay: number;
  maxRetries: number;
  qualityThreshold: number;
  enableProgressTracking: boolean;
}

export interface EmbeddingResult {
  chunkId: string;
  embedding: number[];
  tokenCount: number;
  processingTime: number;
  quality: number;
  retryCount: number;
}

export interface BatchProgress {
  totalChunks: number;
  processedChunks: number;
  successfulChunks: number;
  failedChunks: number;
  averageProcessingTime: number;
  estimatedTimeRemaining: number;
}

export class EmbeddingBatchProcessor {
  private static readonly DEFAULT_CONFIG: BatchConfig = {
    batchSize: 100,
    rateLimitDelay: 100,
    maxRetries: 3,
    qualityThreshold: 0.7,
    enableProgressTracking: true
  };

  /**
   * Processes multiple chunks in optimized batches
   */
  static async processChunksBatch(
    chunks: ProductivityChunk[],
    processedContent: ProcessedContent[],
    userId: string,
    config: Partial<BatchConfig> = {},
    onProgress?: (progress: BatchProgress) => void
  ): Promise<EmbeddingResult[]> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

    console.log(`🚀 Starting batch embedding generation for ${chunks.length} chunks...`);

    const results: EmbeddingResult[] = [];
    const startTime = Date.now();

    // Create batches
    const batches = this.createBatches(processedContent, finalConfig.batchSize);
    console.log(`📦 Created ${batches.length} batches`);

    // Process batches
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      try {
        console.log(`🔄 Processing batch ${i + 1}/${batches.length}...`);

        const batchResults = await this.processSingleBatch(
          batch,
          chunks,
          userId,
          finalConfig
        );

        results.push(...batchResults);

        // Update progress
        if (finalConfig.enableProgressTracking && onProgress) {
          this.updateProgress(results, chunks.length, startTime, onProgress);
        }

        // Rate limiting delay
        if (i < batches.length - 1) {
          await this.delay(finalConfig.rateLimitDelay);
        }

      } catch (error) {
        console.error(`❌ Error processing batch ${i + 1}:`, error);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`🎉 Batch processing completed in ${totalTime}ms`);

    return results;
  }

  private static async processSingleBatch(
    batch: ProcessedContent[],
    originalChunks: ProductivityChunk[],
    userId: string,
    config: BatchConfig
  ): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    for (const content of batch) {
      const originalChunk = originalChunks.find(c => c.content === content.originalContent);
      if (!originalChunk) continue;

      try {
        const result = await this.processSingleContent(content, originalChunk, userId, config);
        results.push(result);
      } catch (error) {
        console.error('Processing error:', error);
      }
    }

    return results;
  }

  private static async processSingleContent(
    content: ProcessedContent,
    originalChunk: ProductivityChunk,
    userId: string,
    config: BatchConfig
  ): Promise<EmbeddingResult> {
    const startTime = Date.now();

    // Generate embedding
    const embedding = await OpenAIService.generateEmbedding({
      content: content.processedContent,
      contentType: originalChunk.metadata.chunkType || 'task'
    });

    // Store in database
    await this.storeEmbedding(content, originalChunk, embedding, userId);

    const processingTime = Date.now() - startTime;

    return {
      chunkId: originalChunk.id,
      embedding,
      tokenCount: content.tokenCount,
      processingTime,
      quality: 0.8, // Simplified for now
      retryCount: 0
    };
  }

  private static async storeEmbedding(
    content: ProcessedContent,
    chunk: ProductivityChunk,
    embedding: number[],
    userId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('embeddings')
      .insert({
        user_id: userId,
        content_type: chunk.metadata.chunkType,
        content_id: chunk.metadata.taskId || chunk.id,
        content: content.processedContent,
        embedding,
        metadata: {
          ...chunk.metadata,
          processing: {
            originalLength: content.originalContent.length,
            processedLength: content.processedContent.length,
            enhancements: content.enhancements,
            quality: content.quality
          }
        }
      });

    if (error) throw error;
  }

  private static createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  private static updateProgress(
    results: EmbeddingResult[],
    totalChunks: number,
    startTime: number,
    callback: (progress: BatchProgress) => void
  ): void {
    const processedChunks = results.length;
    const successfulChunks = results.filter(r => r.embedding.length > 0).length;
    const failedChunks = processedChunks - successfulChunks;
    
    const elapsedTime = Date.now() - startTime;
    const averageProcessingTime = processedChunks > 0 ? elapsedTime / processedChunks : 0;
    const remainingChunks = totalChunks - processedChunks;
    const estimatedTimeRemaining = remainingChunks * averageProcessingTime;

    callback({
      totalChunks,
      processedChunks,
      successfulChunks,
      failedChunks,
      averageProcessingTime,
      estimatedTimeRemaining
    });
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 