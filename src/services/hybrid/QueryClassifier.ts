// src/services/hybrid/QueryClassifier.ts

import { 
  QueryType, 
  QueryClassification, 
  ExtractedEntity, 
  TemporalFilter 
} from './types';

export class QueryClassifier {
  private static patterns = {
    count: /(?:how many|count|number of)\s+(.+)/i,
    list: /(?:give me|show me|list)\s+(?:all|the)?\s*(.+)/i,
    search: /(?:task|project)s?\s+(?:that|where|with|mentioning|containing)\s+(.+)/i,
    compare: /(?:compare|which|what)\s+(.+?)\s+(?:spent|time|most|better)/i,
    analyze: /(?:analyze|read|categorize|identify)\s+(.+)/i,
    temporal: /(?:last|past|this|in the)\s+(week|month|day|hour|2 weeks?|3 weeks?)/i,
    project: /(?:project|in)\s+([A-Za-z0-9_-]+)/i,
    person: /\b([A-Z][a-z]+)\b/g, // Names like "Khanh"
    incomplete: /(?:incomplete|incompleted|unfinished|pending)/i,
    never_worked: /(?:never worked|did not work|haven't worked|untouched)/i,
    features_bugs: /(?:feature|bug|fix|build)/i
  };

  static classify(query: string): QueryClassification {
    console.log(`🔍 Classifying query: "${query}"`);
    
    const classification: QueryClassification = {
      type: QueryType.PURE_SEMANTIC,
      confidence: 0.5,
      needsFirebase: false,
      needsSupabase: true,
      entities: [],
      temporal: null,
      expectedResultType: 'insight'
    };

    // Extract entities first
    classification.entities = this.extractEntities(query);
    classification.temporal = this.extractTemporal(query);

    // Classify query type with confidence scoring
    if (this.patterns.count.test(query)) {
      classification.type = QueryType.OPERATIONAL_COUNT;
      classification.confidence = 0.95;
      classification.needsFirebase = true;
      classification.expectedResultType = 'count';
      
      console.log(`✅ Classified as OPERATIONAL_COUNT (confidence: ${classification.confidence})`);
      
    } else if (this.patterns.list.test(query) || this.patterns.never_worked.test(query)) {
      classification.type = QueryType.OPERATIONAL_LIST;
      classification.confidence = 0.9;
      classification.needsFirebase = true;
      classification.expectedResultType = 'list';
      
      console.log(`✅ Classified as OPERATIONAL_LIST (confidence: ${classification.confidence})`);
      
    } else if (this.patterns.search.test(query)) {
      classification.type = QueryType.OPERATIONAL_SEARCH;
      classification.confidence = 0.85;
      classification.needsFirebase = true;
      classification.needsSupabase = true; // For context
      classification.expectedResultType = 'list';
      
      console.log(`✅ Classified as OPERATIONAL_SEARCH (confidence: ${classification.confidence})`);
      
    } else if (this.patterns.compare.test(query)) {
      classification.type = QueryType.ANALYTICAL_COMPARISON;
      classification.confidence = 0.8;
      classification.needsFirebase = true;
      classification.needsSupabase = true;
      classification.expectedResultType = 'analysis';
      
      console.log(`✅ Classified as ANALYTICAL_COMPARISON (confidence: ${classification.confidence})`);
      
    } else if (this.patterns.analyze.test(query) || this.patterns.features_bugs.test(query)) {
      classification.type = QueryType.HYBRID_ANALYSIS;
      classification.confidence = 0.9;
      classification.needsFirebase = true;
      classification.needsSupabase = true;
      classification.expectedResultType = 'analysis';
      
      console.log(`✅ Classified as HYBRID_ANALYSIS (confidence: ${classification.confidence})`);
    } else {
      console.log(`✅ Classified as PURE_SEMANTIC (default, confidence: ${classification.confidence})`);
    }

    // Always include Supabase for context unless it's a pure operational query
    classification.needsSupabase = true;

    console.log(`📊 Classification result:`, {
      type: classification.type,
      confidence: classification.confidence,
      needsFirebase: classification.needsFirebase,
      needsSupabase: classification.needsSupabase,
      entities: classification.entities.length,
      temporal: !!classification.temporal
    });

    return classification;
  }

  private static extractEntities(query: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    console.log(`🏷️ Extracting entities from: "${query}"`);
    
    // Extract project names
    const projectMatch = query.match(this.patterns.project);
    if (projectMatch) {
      entities.push({
        type: 'project',
        value: projectMatch[1],
        confidence: 0.9
      });
      console.log(`Found project entity: ${projectMatch[1]}`);
    }

    // Special case for "make10000hours" project
    const make10000Match = query.match(/make10000hours?/i);
    if (make10000Match && !projectMatch) {
      entities.push({
        type: 'project',
        value: 'make10000hours',
        confidence: 0.95
      });
      console.log(`Found make10000hours project entity`);
    }

    // Extract person names
    const personMatches = query.match(this.patterns.person);
    if (personMatches) {
      personMatches.forEach(name => {
        // Filter out common words that aren't names
        const commonWords = ['Project', 'Tasks', 'Give', 'Tell', 'Show', 'Compare', 'How', 'What'];
        if (!commonWords.includes(name)) {
          entities.push({
            type: 'person',
            value: name,
            confidence: 0.7
          });
          console.log(`Found person entity: ${name}`);
        }
      });
    }

    // Extract task-related entities
    if (this.patterns.incomplete.test(query)) {
      entities.push({
        type: 'task',
        value: 'incomplete',
        confidence: 0.8
      });
      console.log(`Found task status entity: incomplete`);
    }

    console.log(`📋 Extracted ${entities.length} entities:`, entities);
    return entities;
  }

  private static extractTemporal(query: string): TemporalFilter | null {
    const match = query.match(this.patterns.temporal);
    if (!match) return null;

    const period = match[1].toLowerCase();
    const now = new Date();
    
    console.log(`⏰ Extracting temporal filter: ${period}`);
    
    switch (period) {
      case 'day':
      case 'today':
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        return {
          start: startOfDay,
          end: now,
          period: 'day'
        };
        
      case 'week':
      case '1 week':
        return {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: now,
          period: 'week'
        };
        
      case '2 weeks':
      case '2 week':
        return {
          start: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
          end: now,
          period: '2_weeks'
        };
        
      case 'month':
        return {
          start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: now,
          period: 'month'
        };
        
      default:
        return null;
    }
  }

  // Helper method to get human-readable classification
  static getClassificationSummary(classification: QueryClassification): string {
    const typeDescriptions = {
      [QueryType.OPERATIONAL_COUNT]: 'Count Query - Returns exact numbers',
      [QueryType.OPERATIONAL_LIST]: 'List Query - Returns specific items',
      [QueryType.OPERATIONAL_SEARCH]: 'Search Query - Finds matching items',
      [QueryType.ANALYTICAL_COMPARISON]: 'Comparison Query - Analyzes relationships',
      [QueryType.HYBRID_ANALYSIS]: 'Analysis Query - Deep content analysis',
      [QueryType.PURE_SEMANTIC]: 'Semantic Query - Pattern recognition'
    };

    return typeDescriptions[classification.type] || 'Unknown query type';
  }

  // Method to validate classification confidence
  static isHighConfidence(classification: QueryClassification): boolean {
    return classification.confidence >= 0.8;
  }

  // Method to determine if query needs exact data
  static needsExactData(classification: QueryClassification): boolean {
    return [
      QueryType.OPERATIONAL_COUNT,
      QueryType.OPERATIONAL_LIST,
      QueryType.OPERATIONAL_SEARCH
    ].includes(classification.type);
  }
}