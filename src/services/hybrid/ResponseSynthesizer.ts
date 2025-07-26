// src/services/hybrid/ResponseSynthesizer.ts

import { 
  HybridQueryResult,
  QueryClassification,
  QueryType,
  OperationalResult,
  SemanticResult,
  HybridSource,
  ExecutionMetadata
} from './types';
import { OpenAIService } from '../openai';

export class ResponseSynthesizer {
  private static readonly MAX_CONTEXT_LENGTH = 8000; // Characters
  private static readonly MAX_AI_RESPONSE_LENGTH = 2000; // Characters

  static async synthesizeResponse(
    originalQuery: string,
    classification: QueryClassification,
    firebaseResult: OperationalResult | null,
    supabaseResult: SemanticResult | null,
    executionMetadata: ExecutionMetadata
  ): Promise<HybridQueryResult> {
    
    console.log(`🔧 Synthesizing response for query type: ${classification.type}`);
    
    // Build comprehensive context
    const context = this.buildHybridContext(
      originalQuery,
      classification,
      firebaseResult,
      supabaseResult
    );

    // Generate AI response using combined data
    const aiResponse = await this.generateAIResponse(
      originalQuery,
      context,
      classification
    );

    // Combine sources from both databases
    const combinedSources = this.combineSources(firebaseResult, supabaseResult);
    
    // Calculate confidence score
    const confidence = this.calculateConfidence(
      classification,
      firebaseResult,
      supabaseResult,
      executionMetadata
    );

    const result: HybridQueryResult = {
      response: aiResponse,
      sources: combinedSources,
      confidence,
      metadata: {
        queryType: classification.type,
        executionTime: executionMetadata.totalQueryTime,
        dataSourcesUsed: this.getDataSourcesUsed(firebaseResult, supabaseResult),
        firebaseAccuracy: firebaseResult?.metadata.accuracy || 0,
        supabaseRelevance: supabaseResult?.metadata.avgSimilarity || 0,
        cacheHit: false,
        ...executionMetadata,
        contextLength: context.length,
        responseLength: aiResponse.length
      }
    };

    console.log(`✅ Response synthesis completed:`, {
      confidence: result.confidence,
      sourcesCount: result.sources.length,
      responseLength: aiResponse.length,
      dataSourcesUsed: result.metadata.dataSourcesUsed
    });

    return result;
  }

  private static buildHybridContext(
    query: string,
    classification: QueryClassification,
    firebaseResult: OperationalResult | null,
    supabaseResult: SemanticResult | null
  ): string {
    
    console.log(`📝 Building hybrid context...`);
    
    const contextSections: string[] = [];

    // Add current date/time context
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const currentTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
    
    contextSections.push(`CURRENT DATE & TIME: ${currentDate} at ${currentTime}`);

    // Add exact data from Firebase first (highest priority)
    if (firebaseResult) {
      contextSections.push("\n📊 EXACT CURRENT DATA:");
      contextSections.push(this.formatFirebaseContext(firebaseResult, classification));
    }

    // Add semantic insights from Supabase
    if (supabaseResult && supabaseResult.insights.length > 0) {
      contextSections.push("\n🧠 CONTEXTUAL INSIGHTS:");
      contextSections.push(supabaseResult.insights.join('\n'));
      
      // Add high-relevance source snippets
      const highRelevanceSources = supabaseResult.sources
        .filter(source => source.relevanceScore > 0.8)
        .slice(0, 3);
      
      if (highRelevanceSources.length > 0) {
        contextSections.push("\n🎯 HIGH-RELEVANCE CONTEXT:");
        highRelevanceSources.forEach((source, index) => {
          contextSections.push(`[${index + 1}] ${source.snippet}`);
        });
      }
    }

    // Add query context for clarity
    contextSections.push(`\n📝 USER QUERY: "${query}"`);
    contextSections.push(`🎯 QUERY TYPE: ${classification.type}`);
    
    // Add entity information if present
    if (classification.entities.length > 0) {
      const entityInfo = classification.entities
        .map(e => `${e.type}:${e.value} (${Math.round(e.confidence * 100)}%)`)
        .join(', ');
      contextSections.push(`🏷️ ENTITIES: ${entityInfo}`);
    }

    // Add temporal information if present
    if (classification.temporal) {
      contextSections.push(`⏰ TIME FILTER: ${classification.temporal.period} (${classification.temporal.start.toLocaleDateString()} to ${classification.temporal.end.toLocaleDateString()})`);
    }

    const fullContext = contextSections.join('\n');
    
    // Truncate if too long
    if (fullContext.length > this.MAX_CONTEXT_LENGTH) {
      console.log(`⚠️ Context truncated from ${fullContext.length} to ${this.MAX_CONTEXT_LENGTH} characters`);
      return fullContext.substring(0, this.MAX_CONTEXT_LENGTH) + '\n\n[Context truncated for length...]';
    }
    
    console.log(`📋 Context built: ${fullContext.length} characters, ${contextSections.length} sections`);
    
    return fullContext;
  }

  private static formatFirebaseContext(
    result: OperationalResult,
    classification: QueryClassification
  ): string {
    
    console.log(`🔥 Formatting Firebase context for type: ${result.type}`);
    
    switch (result.type) {
      case 'count':
        return this.formatCountResult(result);
      case 'list':
        return this.formatListResult(result);
      case 'analysis':
        return this.formatAnalysisResult(result);
      default:
        return `Result: ${JSON.stringify(result.value, null, 2)}`;
    }
  }

  private static formatCountResult(result: OperationalResult): string {
    const breakdown = result.details.breakdown || {};
    const sections = [
      `EXACT COUNT: ${result.value}`,
      `PROJECT: ${result.details.projectName || 'Not specified'}`,
    ];

    if (breakdown.todo || breakdown.inProgress || breakdown.completed) {
      sections.push(`STATUS BREAKDOWN:`);
      if (breakdown.todo) sections.push(`  • To-do: ${breakdown.todo} tasks`);
      if (breakdown.inProgress) sections.push(`  • In Progress: ${breakdown.inProgress} tasks`);
      if (breakdown.completed) sections.push(`  • Completed: ${breakdown.completed} tasks`);
    }

    if (result.details.temporal) {
      sections.push(`TIME PERIOD: ${result.details.temporal.period}`);
    }

    if (result.details.includesOnlyIncomplete) {
      sections.push(`FILTER: Only incomplete tasks included`);
    }

    return sections.join('\n');
  }

  private static formatListResult(result: OperationalResult): string {
    const items = Array.isArray(result.value) ? result.value : [];
    const details = result.details || {};
    
    const sections = [
      `TOTAL ITEMS: ${details.count || items.length}`,
    ];

    if (details.avgDaysUntouched) {
      sections.push(`AVERAGE AGE: ${details.avgDaysUntouched} days untouched`);
    }

    if (details.avgRelevance) {
      sections.push(`AVERAGE RELEVANCE: ${details.avgRelevance}%`);
    }

    if (details.projectBreakdown) {
      sections.push(`PROJECT BREAKDOWN:`);
      Object.entries(details.projectBreakdown).forEach(([project, count]) => {
        sections.push(`  • ${project}: ${count} tasks`);
      });
    }

    if (details.searchTerm) {
      sections.push(`SEARCH TERM: "${details.searchTerm}"`);
      sections.push(`TOTAL SCANNED: ${details.totalScanned} tasks`);
    }

    // Add sample items (limit to first 5 for context)
    if (items.length > 0) {
      sections.push(`\nSAMPLE ITEMS:`);
      items.slice(0, 5).forEach((item, index) => {
        const title = item.text || item.title || 'Untitled';
        const project = item.projectName ? ` (${item.projectName})` : '';
        const age = item.daysUntouched ? ` - ${item.daysUntouched} days old` : '';
        const relevance = item.relevanceScore ? ` - ${item.relevanceScore}% relevance` : '';
        sections.push(`  ${index + 1}. ${title}${project}${age}${relevance}`);
      });
      
      if (items.length > 5) {
        sections.push(`  ... and ${items.length - 5} more items`);
      }
    }

    return sections.join('\n');
  }

  private static formatAnalysisResult(result: OperationalResult): string {
    const value = result.value;
    const details = result.details || {};
    
    if (Array.isArray(value)) {
      // Project comparison analysis
      const sections = [
        `ANALYSIS TYPE: Project Time Comparison`,
        `TIME PERIOD: ${details.period || 'Not specified'}`,
        `TOTAL TIME: ${Math.round((details.totalTime || 0) / 60 * 10) / 10} hours`,
        `TOTAL SESSIONS: ${details.totalSessions || 0}`,
        `PROJECT RANKINGS:`
      ];

      value.slice(0, 5).forEach((project, index) => {
        sections.push(`  ${index + 1}. ${project.project}: ${project.timeHours}h (${project.percentage}%) - ${project.sessions} sessions`);
      });

      if (details.diversityScore !== undefined) {
        sections.push(`WORK DIVERSITY SCORE: ${details.diversityScore} (higher = more balanced)`);
      }

      if (details.topProject) {
        sections.push(`TOP PROJECT: ${details.topProject}`);
      }

      return sections.join('\n');
    } else {
      // Task analysis for features/bugs
      const tasks = Array.isArray(value) ? value : (details.totalTasks ? [value] : []);
      const sections = [
        `ANALYSIS TYPE: Task Content Analysis`,
        `PROJECT: ${details.projectName || 'Not specified'}`,
        `TOTAL TASKS: ${details.totalTasks || 0}`,
        `COMPLETED: ${details.completedTasks || 0}`,
        `PENDING: ${details.pendingTasks || 0}`,
        `AVERAGE CONTENT LENGTH: ${details.avgContentLength || 0} characters`,
      ];

      if (details.tasksByStatus) {
        sections.push(`STATUS BREAKDOWN:`);
        sections.push(`  • With descriptions: ${details.tasksByStatus.withDescription || 0}`);
        sections.push(`  • With notes: ${details.tasksByStatus.withNotes || 0}`);
      }

      sections.push(`\nREADY FOR AI ANALYSIS: ${details.requiresAIAnalysis ? 'Yes' : 'No'}`);

      return sections.join('\n');
    }
  }

  private static async generateAIResponse(
    query: string,
    context: string,
    classification: QueryClassification
  ): Promise<string> {
    
    console.log(`🤖 Generating AI response for query type: ${classification.type}`);
    
    const systemPrompt = this.buildSystemPrompt(classification);
    
    try {
      const response = await OpenAIService.generateChatResponse({
        query,
        context: `${systemPrompt}\n\n${context}`,
        conversationHistory: []
      });

      // Ensure response isn't too long
      if (response.length > this.MAX_AI_RESPONSE_LENGTH) {
        console.log(`⚠️ AI response truncated from ${response.length} to ${this.MAX_AI_RESPONSE_LENGTH} characters`);
        return response.substring(0, this.MAX_AI_RESPONSE_LENGTH) + '...\n\n[Response truncated for length]';
      }

      return response;
    } catch (error) {
      console.error('AI response generation failed:', error);
      return this.generateFallbackResponse(query, classification, context);
    }
  }

  private static buildSystemPrompt(classification: QueryClassification): string {
    const basePrompt = `You are a productivity AI assistant with access to exact operational data and contextual insights.

CRITICAL FORMATTING REQUIREMENTS:
• Start with emoji header: 🎯 **Key Results**
• Use **bold** formatting for project names, numbers, and key metrics
• Use bullet points (•) for lists and key information
• Keep responses concise and actionable
• Provide specific data when available
• End with practical next steps when appropriate`;

    switch (classification.type) {
      case QueryType.OPERATIONAL_COUNT:
        return `${basePrompt}

RESPONSE REQUIREMENTS FOR COUNT QUERIES:
• Start with the EXACT count: "You have **X tasks** in project Y"
• Use breakdown data to provide context
• Include status distribution if available
• Keep response factual and precise
• Format numbers with **bold** emphasis`;

      case QueryType.OPERATIONAL_LIST:
        return `${basePrompt}

RESPONSE REQUIREMENTS FOR LIST QUERIES:
• Start with "Here are your [items]:" or "Found **X items**:"
• List specific items with key details
• Use **bold** for project names and important metrics
• Show age/relevance scores when available
• Limit display to most relevant 8-10 items
• Include summary statistics`;

      case QueryType.OPERATIONAL_SEARCH:
        return `${basePrompt}

RESPONSE REQUIREMENTS FOR SEARCH QUERIES:
• Start with "Found **X tasks** mentioning [search term]:"
• Show which fields contained matches
• Order by relevance score
• Use **bold** for task titles and search terms
• Include context about search scope
• Highlight exact matches when possible`;

      case QueryType.ANALYTICAL_COMPARISON:
        return `${basePrompt}

RESPONSE REQUIREMENTS FOR COMPARISON QUERIES:
• Start with clear conclusion: "Your top project is **Project Name**"
• Provide ranked list with **bold** project names and percentages
• Include time periods and session counts
• Use metrics like hours, percentages, sessions
• Suggest actionable insights about work patterns
• Include diversity/balance analysis if available`;

      case QueryType.HYBRID_ANALYSIS:
        return `${basePrompt}

RESPONSE REQUIREMENTS FOR ANALYSIS QUERIES:
• Analyze the complete task data provided
• Categorize tasks clearly with **bold** headings
• Use specific task titles and IDs for reference
• Provide actionable recommendations
• Format with clear sections:
  - **Features to Build** (pending features)
  - **Bugs to Fix** (pending bug fixes)  
  - **Completed Items** (summary count)
• Include project progress assessment`;

      default:
        return `${basePrompt}

RESPONSE REQUIREMENTS:
• Use **bold** for key insights and project names
• Provide specific, actionable information
• Keep response focused and helpful
• Include relevant metrics when available`;
    }
  }

  private static generateFallbackResponse(
    query: string,
    classification: QueryClassification,
    context: string
  ): string {
    
    console.log(`🛡️ Generating fallback response for failed AI call`);
    
    // Extract key information from context for basic response
    const hasFirebaseData = context.includes('📊 EXACT CURRENT DATA:');
    const hasSupabaseData = context.includes('🧠 CONTEXTUAL INSIGHTS:');
    
    switch (classification.type) {
      case QueryType.OPERATIONAL_COUNT:
        if (hasFirebaseData) {
          const countMatch = context.match(/EXACT COUNT: (\d+)/);
          const projectMatch = context.match(/PROJECT: ([^\n]+)/);
          const count = countMatch ? countMatch[1] : 'unknown';
          const project = projectMatch ? projectMatch[1] : 'your project';
          return `🎯 **Count Result**\n\nYou have **${count} tasks** in ${project}. The exact data is available above, but I'm having trouble generating a detailed analysis right now. Please try again in a moment.`;
        }
        break;
        
      case QueryType.OPERATIONAL_LIST:
        if (hasFirebaseData) {
          const itemsMatch = context.match(/TOTAL ITEMS: (\d+)/);
          const items = itemsMatch ? itemsMatch[1] : 'several';
          return `🎯 **List Results**\n\nFound **${items} items** matching your criteria. The detailed list is available in the exact data above. Please try again for a more detailed analysis.`;
        }
        break;
        
      default:
        return `🎯 **Results Available**\n\nI found relevant information for your query "${query}" but am having trouble generating a detailed response right now. ${hasFirebaseData ? 'Exact data is available above.' : ''} ${hasSupabaseData ? 'Contextual insights are also available.' : ''} Please try again in a moment.`;
    }
    
    return `🎯 **Processing Issue**\n\nI encountered an issue analyzing your query "${query}". Please try rephrasing your question or try again in a moment.`;
  }

  private static combineSources(
    firebaseResult: OperationalResult | null,
    supabaseResult: SemanticResult | null
  ): HybridSource[] {
    
    console.log(`🔗 Combining sources from databases...`);
    
    const sources: HybridSource[] = [];

    // Add Firebase sources
    if (firebaseResult) {
      sources.push({
        id: 'firebase_operational',
        type: 'operational_data',
        title: `${firebaseResult.type.charAt(0).toUpperCase() + firebaseResult.type.slice(1)} Data`,
        snippet: this.createFirebaseSnippet(firebaseResult),
        confidence: firebaseResult.metadata.accuracy || 1.0,
        source: 'firebase'
      });
    }

    // Add Supabase sources
    if (supabaseResult && supabaseResult.sources) {
      supabaseResult.sources.forEach((source, index) => {
        sources.push({
          id: `supabase_${index}`,
          type: 'semantic_context',
          title: `${source.type.charAt(0).toUpperCase() + source.type.slice(1)} Context`,
          snippet: source.snippet,
          confidence: source.relevanceScore,
          source: 'supabase'
        });
      });
    }

    console.log(`📚 Combined ${sources.length} sources (${firebaseResult ? 1 : 0} Firebase + ${supabaseResult?.sources.length || 0} Supabase)`);
    
    return sources;
  }

  private static createFirebaseSnippet(result: OperationalResult): string {
    switch (result.type) {
      case 'count':
        const breakdown = result.details.breakdown || {};
        const statusInfo = Object.entries(breakdown)
          .map(([status, count]) => `${status}: ${count}`)
          .join(', ');
        return `Exact count: ${result.value} items${statusInfo ? ` (${statusInfo})` : ''}`;
        
      case 'list':
        const count = Array.isArray(result.value) ? result.value.length : 0;
        const avgAge = result.details.avgDaysUntouched ? ` avg ${result.details.avgDaysUntouched} days old` : '';
        return `Complete list of ${count} items${avgAge} with full details`;
        
      case 'analysis':
        const dataSize = JSON.stringify(result.details).length;
        return `Comprehensive analysis with ${dataSize} characters of detailed data`;
        
      default:
        return 'Operational data available';
    }
  }

  private static calculateConfidence(
    classification: QueryClassification,
    firebaseResult: OperationalResult | null,
    supabaseResult: SemanticResult | null,
    executionMetadata: ExecutionMetadata
  ): number {
    
    console.log(`📊 Calculating confidence score...`);
    
    let confidence = classification.confidence; // Base confidence from classification

    // Boost confidence if we have exact Firebase data
    if (firebaseResult && firebaseResult.metadata.accuracy > 0.9) {
      confidence = Math.min(1.0, confidence + 0.2);
      console.log(`📈 Confidence boosted by Firebase accuracy: +0.2`);
    }

    // Boost confidence if we have high-relevance Supabase data
    if (supabaseResult && supabaseResult.metadata.avgSimilarity > 0.8) {
      confidence = Math.min(1.0, confidence + 0.1);
      console.log(`📈 Confidence boosted by Supabase relevance: +0.1`);
    }

    // Reduce confidence if queries failed
    if (classification.needsFirebase && !executionMetadata.firebaseSuccess) {
      confidence -= 0.3;
      console.log(`📉 Confidence reduced by Firebase failure: -0.3`);
    }
    if (classification.needsSupabase && !executionMetadata.supabaseSuccess) {
      confidence -= 0.2;
      console.log(`📉 Confidence reduced by Supabase failure: -0.2`);
    }

    // Reduce confidence for slow queries (might indicate issues)
    if (executionMetadata.totalQueryTime > 8000) {
      confidence -= 0.1;
      console.log(`📉 Confidence reduced by slow query: -0.1`);
    }

    const finalConfidence = Math.max(0.1, Math.min(1.0, confidence));
    console.log(`🎯 Final confidence score: ${Math.round(finalConfidence * 100)}%`);
    
    return finalConfidence;
  }

  private static getDataSourcesUsed(
    firebaseResult: OperationalResult | null,
    supabaseResult: SemanticResult | null
  ): string[] {
    
    const sources: string[] = [];
    if (firebaseResult) sources.push('firebase');
    if (supabaseResult) sources.push('supabase');
    return sources;
  }

  // Public utility method for testing response synthesis
  static async testSynthesis(
    query: string,
    classification: QueryClassification
  ): Promise<{ success: boolean; responseLength: number; error?: string }> {
    try {
      const mockFirebaseResult: OperationalResult = {
        type: 'count',
        value: 42,
        details: { projectName: 'test', breakdown: { todo: 20, completed: 22 } },
        metadata: { totalScanned: 42, accuracy: 1.0 }
      };

      const mockSupabaseResult: SemanticResult = {
        type: 'semantic',
        insights: ['Test insight'],
        sources: [],
        relevanceScores: [0.8],
        metadata: {
          queryTime: 100,
          source: 'test',
          embeddingDimensions: 1536,
          resultsCount: 1,
          avgSimilarity: 0.8
        }
      };

      const result = await this.synthesizeResponse(
        query,
        classification,
        mockFirebaseResult,
        mockSupabaseResult,
        { totalQueryTime: 200, firebaseSuccess: true, supabaseSuccess: true }
      );

      return {
        success: true,
        responseLength: result.response.length
      };
    } catch (error) {
      return {
        success: false,
        responseLength: 0,
        error: error.message
      };
    }
  }
}