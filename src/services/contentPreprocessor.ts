import { ProductivityChunk } from './semanticChunker';

export interface PreprocessingConfig {
  removeStopWords: boolean;
  normalizeWhitespace: boolean;
  expandAbbreviations: boolean;
  addContextualTerms: boolean;
  removeEmptyLines: boolean;
  standardizeFormat: boolean;
}

export interface ProcessedContent {
  originalContent: string;
  processedContent: string;
  enhancements: string[];
  tokenCount: number;
  quality: {
    readability: number;
    completeness: number;
    contextRichness: number;
  };
}

export class ContentPreprocessor {
  private static readonly DEFAULT_CONFIG: PreprocessingConfig = {
    removeStopWords: false, // Keep for semantic richness
    normalizeWhitespace: true,
    expandAbbreviations: true,
    addContextualTerms: true,
    removeEmptyLines: true,
    standardizeFormat: true
  };

  private static readonly PRODUCTIVITY_ABBREVIATIONS = {
    // Time management
    'hrs': 'hours',
    'min': 'minutes',
    'sec': 'seconds',
    'pomo': 'pomodoro',
    'pomos': 'pomodoros',
    
    // Task management
    'wip': 'work in progress',
    'todo': 'to do',
    'done': 'completed',
    'qa': 'quality assurance',
    'pr': 'pull request',
    
    // Priority levels
    'p1': 'high priority',
    'p2': 'medium priority',
    'p3': 'low priority',
    'urgent': 'high priority urgent',
    
    // Project management
    'pm': 'project manager',
    'dev': 'development',
    'prod': 'production',
    'staging': 'staging environment',
    'req': 'requirement',
    'specs': 'specifications'
  };

  private static readonly CONTEXTUAL_TERMS: Record<string, string[]> = {
    task: ['productivity', 'work item', 'assignment'],
    project: ['initiative', 'workstream', 'deliverable'],
    time: ['duration', 'effort', 'investment'],
    completion: ['achievement', 'accomplishment', 'milestone'],
    planning: ['roadmap', 'strategy', 'approach'],
    note: ['documentation', 'reference', 'detail'],
    time_entry: ['tracking', 'measurement', 'duration'],
    project_summary: ['overview', 'summary', 'report']
  };

  /**
   * Preprocesses productivity chunks for optimal embedding
   */
  static async preprocessChunks(
    chunks: ProductivityChunk[],
    config: Partial<PreprocessingConfig> = {}
  ): Promise<ProcessedContent[]> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const processed: ProcessedContent[] = [];

    console.log(`🔄 Preprocessing ${chunks.length} chunks...`);

    for (const chunk of chunks) {
      try {
        const processedContent = await this.preprocessSingleChunk(chunk, finalConfig);
        processed.push(processedContent);
      } catch (error) {
        console.error(`❌ Error preprocessing chunk ${chunk.id}:`, error);
        // Fallback to original content
        processed.push({
          originalContent: chunk.content,
          processedContent: chunk.content,
          enhancements: [],
          tokenCount: chunk.tokenCount,
          quality: { readability: 0.5, completeness: 0.5, contextRichness: 0.5 }
        });
      }
    }

    console.log(`✅ Preprocessed ${processed.length} chunks`);
    return processed;
  }

  /**
   * Preprocesses a single chunk with all optimization steps
   */
  private static async preprocessSingleChunk(
    chunk: ProductivityChunk,
    config: PreprocessingConfig
  ): Promise<ProcessedContent> {
    let content = chunk.content;
    const enhancements: string[] = [];
    const originalContent = content;

    // Step 1: Normalize whitespace
    if (config.normalizeWhitespace) {
      content = this.normalizeWhitespace(content);
      enhancements.push('whitespace_normalized');
    }

    // Step 2: Remove empty lines
    if (config.removeEmptyLines) {
      content = this.removeEmptyLines(content);
      enhancements.push('empty_lines_removed');
    }

    // Step 3: Standardize format
    if (config.standardizeFormat) {
      content = this.standardizeFormat(content);
      enhancements.push('format_standardized');
    }

    // Step 4: Expand abbreviations
    if (config.expandAbbreviations) {
      content = this.expandAbbreviations(content);
      enhancements.push('abbreviations_expanded');
    }

    // Step 5: Add contextual terms
    if (config.addContextualTerms) {
      content = this.addContextualTerms(content, chunk);
      enhancements.push('contextual_terms_added');
    }

    // Step 6: Calculate quality metrics
    const quality = this.calculateQuality(originalContent, content, chunk);

    return {
      originalContent,
      processedContent: content,
      enhancements,
      tokenCount: this.estimateTokens(content),
      quality
    };
  }

  /**
   * Normalizes whitespace and removes extra spacing
   */
  private static normalizeWhitespace(content: string): string {
    return content
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\n\s*\n/g, '\n') // Multiple newlines to single newline
      .replace(/^\s+|\s+$/g, '') // Trim start/end
      .replace(/\s*:\s*/g, ': ') // Standardize colon spacing
      .replace(/\s*,\s*/g, ', '); // Standardize comma spacing
  }

  /**
   * Removes empty lines and excessive breaks
   */
  private static removeEmptyLines(content: string): string {
    return content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .join('\n');
  }

  /**
   * Standardizes content format for consistency
   */
  private static standardizeFormat(content: string): string {
    let formatted = content;

    // Standardize headers
    formatted = formatted.replace(/^(TASK|PROJECT|STATUS|PRIORITY|TIME SPENT|POMODOROS|CREATED|COMPLETED|NOTES|TAGS):\s*/gm, 
      (match, header) => `${header}: `);

    // Standardize status values
    formatted = formatted.replace(/STATUS:\s*(completed|done|finished)/gi, 'STATUS: Completed');
    formatted = formatted.replace(/STATUS:\s*(in progress|ongoing|active|wip)/gi, 'STATUS: In Progress');
    formatted = formatted.replace(/STATUS:\s*(todo|pending|not started)/gi, 'STATUS: To Do');

    // Standardize priority values
    formatted = formatted.replace(/PRIORITY:\s*(high|urgent|p1|important)/gi, 'PRIORITY: High');
    formatted = formatted.replace(/PRIORITY:\s*(medium|normal|p2)/gi, 'PRIORITY: Medium');
    formatted = formatted.replace(/PRIORITY:\s*(low|p3|minor)/gi, 'PRIORITY: Low');

    // Standardize time formats
    formatted = formatted.replace(/(\d+)\s*(hrs?|hours?)/gi, '$1 hours');
    formatted = formatted.replace(/(\d+)\s*(mins?|minutes?)/gi, '$1 minutes');

    return formatted;
  }

  /**
   * Expands productivity-related abbreviations
   */
  private static expandAbbreviations(content: string): string {
    let expanded = content;

    for (const [abbrev, expansion] of Object.entries(this.PRODUCTIVITY_ABBREVIATIONS)) {
      const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
      expanded = expanded.replace(regex, expansion);
    }

    return expanded;
  }

  /**
   * Adds contextual terms to improve semantic understanding
   */
  private static addContextualTerms(content: string, chunk: ProductivityChunk): string {
    let enhanced = content;
    const metadata = chunk.metadata;

    // Add temporal context
    if (metadata.createdAt) {
      const date = new Date(metadata.createdAt);
      const timeContext = this.getTimeContext(date);
      enhanced = `${timeContext}\n${enhanced}`;
    }

    // Add productivity context based on chunk type
    const contextTerms = this.CONTEXTUAL_TERMS[metadata.chunkType] || [];
    if (contextTerms.length > 0 && !enhanced.toLowerCase().includes('productivity')) {
      enhanced = `${enhanced}\nContext: This is a productivity ${metadata.chunkType} related to ${contextTerms[0]}.`;
    }

    // Add completion context
    if (metadata.completionStatus !== undefined) {
      const completionContext = metadata.completionStatus 
        ? 'This task has been successfully completed and accomplished.'
        : 'This task is currently active and requires attention.';
      enhanced = `${enhanced}\n${completionContext}`;
    }

    // Add time investment context
    if (metadata.timeSpent && metadata.timeSpent > 0) {
      const timeContext = metadata.timeSpent > 120 
        ? 'This represents a significant time investment and major work effort.'
        : 'This is a quick task requiring minimal time investment.';
      enhanced = `${enhanced}\n${timeContext}`;
    }

    return enhanced;
  }

  /**
   * Gets temporal context for better time-based understanding
   */
  private static getTimeContext(date: Date): string {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Recent activity from today.';
    if (diffDays === 1) return 'Recent activity from yesterday.';
    if (diffDays <= 7) return 'Recent activity from this week.';
    if (diffDays <= 30) return 'Activity from this month.';
    if (diffDays <= 90) return 'Activity from this quarter.';
    return 'Historical activity from previous periods.';
  }

  /**
   * Calculates content quality metrics
   */
  private static calculateQuality(
    original: string, 
    processed: string, 
    chunk: ProductivityChunk
  ): { readability: number; completeness: number; contextRichness: number } {
    // Readability: based on structure and formatting
    const hasStructure = processed.includes(':') && processed.includes('\n');
    const hasStandardFormat = /TASK:|STATUS:|PROJECT:/.test(processed);
    const readability = (hasStructure ? 0.5 : 0) + (hasStandardFormat ? 0.5 : 0);

    // Completeness: based on metadata coverage
    const metadata = chunk.metadata;
    let completenessScore = 0;
    if (metadata.taskId) completenessScore += 0.2;
    if (metadata.projectName) completenessScore += 0.2;
    if (metadata.completionStatus !== undefined) completenessScore += 0.2;
    if (metadata.timeSpent || metadata.pomodoroCount) completenessScore += 0.2;
    if (metadata.createdAt) completenessScore += 0.2;

    // Context richness: enhancement ratio
    const enhancementRatio = processed.length / original.length;
    const contextRichness = Math.min(1, enhancementRatio - 1 + 0.5);

    return {
      readability: Math.min(1, readability),
      completeness: completenessScore,
      contextRichness: Math.max(0, Math.min(1, contextRichness))
    };
  }

  /**
   * Simple token estimation
   */
  private static estimateTokens(content: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(content.length / 4);
  }

  /**
   * Validates preprocessing results
   */
  static validatePreprocessing(results: ProcessedContent[]): {
    valid: boolean;
    issues: string[];
    stats: {
      totalProcessed: number;
      avgQuality: {
        readability: number;
        completeness: number;
        contextRichness: number;
      };
      enhancementCoverage: Record<string, number>;
    };
  } {
    const issues: string[] = [];

    // Check for processing failures
    const failedProcessing = results.filter(r => r.processedContent === r.originalContent);
    if (failedProcessing.length > results.length * 0.1) {
      issues.push(`High preprocessing failure rate: ${failedProcessing.length}/${results.length}`);
    }

    // Check quality scores
    const lowQuality = results.filter(r => 
      r.quality.readability < 0.3 || 
      r.quality.completeness < 0.3 || 
      r.quality.contextRichness < 0.3
    );
    if (lowQuality.length > results.length * 0.2) {
      issues.push(`High low-quality content ratio: ${lowQuality.length}/${results.length}`);
    }

    // Calculate stats
    const avgQuality = {
      readability: results.reduce((sum, r) => sum + r.quality.readability, 0) / results.length,
      completeness: results.reduce((sum, r) => sum + r.quality.completeness, 0) / results.length,
      contextRichness: results.reduce((sum, r) => sum + r.quality.contextRichness, 0) / results.length
    };

    const enhancementCoverage: Record<string, number> = {};
    for (const result of results) {
      for (const enhancement of result.enhancements) {
        enhancementCoverage[enhancement] = (enhancementCoverage[enhancement] || 0) + 1;
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      stats: {
        totalProcessed: results.length,
        avgQuality,
        enhancementCoverage
      }
    };
  }
} 