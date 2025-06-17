import { OpenAIService } from './openai';

export interface ProductivityChunk {
  id: string;
  content: string;
  originalContent: string;
  metadata: {
    taskId?: string;
    projectName?: string;
    completionStatus?: boolean;
    timeSpent?: number;
    pomodoroCount?: number;
    createdAt: string;
    chunkType: 'task' | 'note' | 'time_entry' | 'project_summary';
    priority?: 'high' | 'medium' | 'low';a
    tags?: string[];
  };
  parentChunkId?: string;
  chunkIndex: number;
  tokenCount: number;
}

export interface ChunkingConfig {
  maxTokens: number;
  overlapTokens: number;
  preserveContext: boolean;
  enhanceWithMetadata: boolean;
}

export class SemanticChunker {
  private static readonly DEFAULT_CONFIG: ChunkingConfig = {
    maxTokens: 300,
    overlapTokens: 50,
    preserveContext: true,
    enhanceWithMetadata: true
  };

  /**
   * Chunks productivity data with semantic boundaries and context preservation
   */
  static async chunkProductivityData(
    tasks: any[],
    config: Partial<ChunkingConfig> = {}
  ): Promise<ProductivityChunk[]> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const chunks: ProductivityChunk[] = [];

    console.log(`🔄 Starting semantic chunking for ${tasks.length} tasks...`);

    for (const task of tasks) {
      try {
        const taskChunks = await this.chunkSingleTask(task, finalConfig);
        chunks.push(...taskChunks);
      } catch (error) {
        console.error(`❌ Error chunking task ${task.id}:`, error);
      }
    }

    console.log(`✅ Generated ${chunks.length} semantic chunks`);
    return chunks;
  }

  /**
   * Chunks a single task with intelligent boundary detection
   */
  private static async chunkSingleTask(
    task: any,
    config: ChunkingConfig
  ): Promise<ProductivityChunk[]> {
    const chunks: ProductivityChunk[] = [];
    
    // 1. Create enhanced content with context
    const enhancedContent = this.enhanceTaskContent(task);
    
    // 2. Estimate tokens
    const totalTokens = OpenAIService.estimateTokens(enhancedContent);
    
    // 3. If content fits in one chunk, return single chunk
    if (totalTokens <= config.maxTokens) {
      chunks.push(this.createChunk(enhancedContent, task, 0, totalTokens));
      return chunks;
    }

    // 4. Split content intelligently at semantic boundaries
    const contentSections = this.splitAtSemanticBoundaries(enhancedContent);
    
    // 5. Create chunks with overlap
    let chunkIndex = 0;
    let previousChunk = '';
    
    for (let i = 0; i < contentSections.length; i++) {
      const section = contentSections[i];
      let chunkContent = section;
      
      // Add overlap from previous chunk
      if (config.overlapTokens > 0 && previousChunk) {
        const overlapContent = this.extractOverlap(previousChunk, config.overlapTokens);
        chunkContent = `${overlapContent}\n\n${section}`;
      }
      
      const chunkTokens = OpenAIService.estimateTokens(chunkContent);
      
      // If chunk is still too large, split further
      if (chunkTokens > config.maxTokens) {
        const subChunks = this.splitLargeChunk(chunkContent, config.maxTokens);
        for (const subChunk of subChunks) {
          chunks.push(this.createChunk(subChunk, task, chunkIndex++, OpenAIService.estimateTokens(subChunk)));
        }
      } else {
        chunks.push(this.createChunk(chunkContent, task, chunkIndex++, chunkTokens));
      }
      
      previousChunk = chunkContent;
    }

    return chunks;
  }

  /**
   * Enhances task content with contextual metadata
   */
  private static enhanceTaskContent(task: any): string {
    const sections: string[] = [];

    // Add task header with key metadata
    sections.push(`TASK: ${task.text}`);
    
    if (task.project?.name) {
      sections.push(`PROJECT: ${task.project.name}`);
    }
    
    sections.push(`STATUS: ${task.completed ? 'Completed' : 'In Progress'}`);
    
    if (task.priority) {
      sections.push(`PRIORITY: ${task.priority.toUpperCase()}`);
    }

    // Add time tracking information
    if (task.timeSpent > 0) {
      sections.push(`TIME SPENT: ${task.timeSpent} minutes`);
    }
    
    if (task.pomodoro_count > 0) {
      sections.push(`POMODOROS: ${task.pomodoro_count}`);
    }

    // Add temporal context
    const createdDate = new Date(task.created_at).toLocaleDateString();
    sections.push(`CREATED: ${createdDate}`);
    
    if (task.completed && task.completed_at) {
      const completedDate = new Date(task.completed_at).toLocaleDateString();
      sections.push(`COMPLETED: ${completedDate}`);
    }

    // Add detailed content
    if (task.notes && task.notes.trim()) {
      sections.push(`NOTES: ${task.notes}`);
    }

    // Add tags if available
    if (task.tags && task.tags.length > 0) {
      sections.push(`TAGS: ${task.tags.join(', ')}`);
    }

    return sections.join('\n');
  }

  /**
   * Splits content at natural semantic boundaries
   */
  private static splitAtSemanticBoundaries(content: string): string[] {
    const sections: string[] = [];
    
    // Split on major sections first
    const majorSections = content.split(/\n(?=(?:TASK|PROJECT|NOTES|TIME SPENT):|===)/);
    
    for (const section of majorSections) {
      if (section.trim()) {
        // Further split long sections on sentence boundaries
        const sentences = section.split(/(?<=\.)\s+(?=[A-Z])/);
        
        let currentSection = '';
        for (const sentence of sentences) {
          const combined = currentSection ? `${currentSection} ${sentence}` : sentence;
          
          if (OpenAIService.estimateTokens(combined) > 250) {
            if (currentSection) {
              sections.push(currentSection.trim());
              currentSection = sentence;
            } else {
              sections.push(sentence.trim());
            }
          } else {
            currentSection = combined;
          }
        }
        
        if (currentSection.trim()) {
          sections.push(currentSection.trim());
        }
      }
    }

    return sections.filter(section => section.trim().length > 0);
  }

  /**
   * Extracts overlap content from previous chunk
   */
  private static extractOverlap(content: string, maxTokens: number): string {
    const sentences = content.split(/(?<=\.)\s+/);
    let overlap = '';
    
    // Start from the end and work backwards
    for (let i = sentences.length - 1; i >= 0; i--) {
      const candidate = sentences.slice(i).join(' ');
      if (OpenAIService.estimateTokens(candidate) <= maxTokens) {
        overlap = candidate;
      } else {
        break;
      }
    }
    
    return overlap;
  }

  /**
   * Splits chunks that are still too large
   */
  private static splitLargeChunk(content: string, maxTokens: number): string[] {
    const chunks: string[] = [];
    const words = content.split(' ');
    
    let currentChunk = '';
    for (const word of words) {
      const candidate = currentChunk ? `${currentChunk} ${word}` : word;
      
      if (OpenAIService.estimateTokens(candidate) > maxTokens) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = word;
        } else {
          // Single word too long, just add it
          chunks.push(word);
        }
      } else {
        currentChunk = candidate;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  /**
   * Creates a productivity chunk with metadata
   */
  private static createChunk(
    content: string,
    task: any,
    chunkIndex: number,
    tokenCount: number
  ): ProductivityChunk {
    return {
      id: `${task.id}_chunk_${chunkIndex}`,
      content,
      originalContent: task.text,
      metadata: {
        taskId: task.id,
        projectName: task.project?.name,
        completionStatus: task.completed,
        timeSpent: task.timeSpent || 0,
        pomodoroCount: task.pomodoro_count || 0,
        createdAt: task.created_at,
        chunkType: this.determineChunkType(content),
        priority: task.priority,
        tags: task.tags || []
      },
      chunkIndex,
      tokenCount
    };
  }

  /**
   * Determines the type of chunk based on content
   */
  private static determineChunkType(content: string): 'task' | 'note' | 'time_entry' | 'project_summary' {
    if (content.includes('NOTES:')) return 'note';
    if (content.includes('TIME SPENT:') || content.includes('POMODOROS:')) return 'time_entry';
    if (content.includes('PROJECT:')) return 'project_summary';
    return 'task';
  }

  /**
   * Validates chunk quality
   */
  static validateChunks(chunks: ProductivityChunk[]): {
    valid: boolean;
    issues: string[];
    stats: {
      totalChunks: number;
      avgTokens: number;
      minTokens: number;
      maxTokens: number;
    };
  } {
    const issues: string[] = [];
    const tokenCounts = chunks.map(c => c.tokenCount);
    
    // Check for empty chunks
    const emptyChunks = chunks.filter(c => c.content.trim().length === 0);
    if (emptyChunks.length > 0) {
      issues.push(`Found ${emptyChunks.length} empty chunks`);
    }
    
    // Check for oversized chunks
    const oversizedChunks = chunks.filter(c => c.tokenCount > 400);
    if (oversizedChunks.length > 0) {
      issues.push(`Found ${oversizedChunks.length} oversized chunks (>400 tokens)`);
    }
    
    // Check for duplicate content
    const contentSet = new Set(chunks.map(c => c.content));
    if (contentSet.size !== chunks.length) {
      issues.push(`Found duplicate chunk content`);
    }

    return {
      valid: issues.length === 0,
      issues,
      stats: {
        totalChunks: chunks.length,
        avgTokens: tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length,
        minTokens: Math.min(...tokenCounts),
        maxTokens: Math.max(...tokenCounts)
      }
    };
  }
} 