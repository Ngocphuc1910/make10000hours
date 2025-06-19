import { QueryClassification } from './intelligentQueryClassifier';

export interface PersonaProfile {
  name: string;
  expertise: string;
  systemPrompt: string;
  responseStyle: string;
  specializations: string[];
  complexityLevel: 'basic' | 'intermediate' | 'expert';
}

export interface PersonaAssignment {
  selectedPersona: PersonaProfile;
  reasoning: string;
  confidence: number;
  adaptations: string[];
}

export class PersonaService {
  
  private static readonly EXPERT_PERSONAS: Record<string, PersonaProfile> = {
    productivity_coach: {
      name: 'Senior Productivity Coach',
      expertise: 'Workflow optimization and behavioral change',
      systemPrompt: `You are a senior productivity coach with 10+ years of experience helping professionals optimize their workflows. You specialize in time management, habit formation, and sustainable productivity practices. Your approach is practical, evidence-based, and personally tailored.`,
      responseStyle: 'Encouraging, actionable, with specific recommendations',
      specializations: ['Time management', 'Habit formation', 'Focus techniques', 'Workflow design'],
      complexityLevel: 'expert'
    },
    
    data_analyst: {
      name: 'Senior Data Analyst',
      expertise: 'Productivity metrics and pattern analysis',
      systemPrompt: `You are a senior data analyst specializing in productivity metrics and behavioral patterns. You excel at extracting insights from complex datasets, identifying trends, and providing data-driven recommendations. Your analysis is thorough, objective, and statistically sound.`,
      responseStyle: 'Analytical, precise, with quantitative insights',
      specializations: ['Statistical analysis', 'Trend identification', 'Performance metrics', 'Data visualization'],
      complexityLevel: 'expert'
    },
    
    project_manager: {
      name: 'Agile Project Manager',
      expertise: 'Project planning and resource allocation',
      systemPrompt: `You are an experienced Agile project manager with expertise in resource allocation, timeline optimization, and team productivity. You understand both strategic planning and tactical execution. Your guidance is practical and results-oriented.`,
      responseStyle: 'Strategic, organized, with clear action items',
      specializations: ['Project planning', 'Resource management', 'Timeline optimization', 'Risk assessment'],
      complexityLevel: 'expert'
    },
    
    time_management_expert: {
      name: 'Time Management Specialist',
      expertise: 'Schedule optimization and priority management',
      systemPrompt: `You are a time management specialist with deep expertise in schedule optimization, priority frameworks, and attention management. You help people maximize their productive hours while maintaining work-life balance.`,
      responseStyle: 'Systematic, practical, with time-saving techniques',
      specializations: ['Schedule design', 'Priority frameworks', 'Attention management', 'Calendar optimization'],
      complexityLevel: 'intermediate'
    },
    
    productivity_assistant: {
      name: 'Productivity Assistant',
      expertise: 'General productivity support and guidance',
      systemPrompt: `You are a helpful productivity assistant with broad knowledge of productivity techniques and tools. You provide clear, practical advice while being encouraging and supportive. Your responses are accessible and actionable.`,
      responseStyle: 'Friendly, helpful, with simple explanations',
      specializations: ['General productivity', 'Task management', 'Basic analytics', 'Tool recommendations'],
      complexityLevel: 'basic'
    }
  };
  
  /**
   * Select optimal persona based on query analysis
   */
  static selectPersona(
    query: string,
    classification: QueryClassification,
    queryComplexity: number = 0.5
  ): PersonaAssignment {
    
    const complexity = this.assessComplexityLevel(query, classification, queryComplexity);
    const domain = this.identifyDomain(query, classification);
    const selectedPersona = this.matchPersonaToRequirements(domain, complexity);
    
    const adaptations = this.generatePersonaAdaptations(query, selectedPersona, classification);
    
    return {
      selectedPersona,
      reasoning: this.generateSelectionReasoning(domain, complexity, selectedPersona.name),
      confidence: this.calculatePersonaConfidence(query, selectedPersona, classification),
      adaptations
    };
  }
  
  /**
   * Generate enhanced system prompt with persona context
   */
  static generateEnhancedSystemPrompt(
    assignment: PersonaAssignment,
    query: string,
    context: string
  ): string {
    const { selectedPersona, adaptations } = assignment;
    
    let enhancedPrompt = selectedPersona.systemPrompt;
    
    // Add specific adaptations
    if (adaptations.length > 0) {
      enhancedPrompt += `\n\nFor this specific query, focus on: ${adaptations.join(', ')}.`;
    }
    
    // Add response style guidance
    enhancedPrompt += `\n\nResponse Style: ${selectedPersona.responseStyle}`;
    
    // Add specialization context
    enhancedPrompt += `\n\nApply your expertise in: ${selectedPersona.specializations.join(', ')}.`;
    
    // Add current context
    enhancedPrompt += `\n\nUser's productivity context: ${context.substring(0, 200)}...`;
    
    return enhancedPrompt;
  }
  
  /**
   * Assess query complexity level
   */
  private static assessComplexityLevel(
    query: string,
    classification: QueryClassification,
    queryComplexity: number
  ): 'basic' | 'intermediate' | 'expert' {
    const wordCount = query.split(' ').length;
    const hasAnalyticalTerms = /analyz|insight|pattern|trend|optimiz|strateg/i.test(query);
    const hasMultipleConcepts = /\band\b|\bor\b/g.test(query);
    
    let complexityScore = queryComplexity;
    
    // Adjust based on query characteristics
    if (wordCount > 15) complexityScore += 0.2;
    if (hasAnalyticalTerms) complexityScore += 0.3;
    if (hasMultipleConcepts) complexityScore += 0.2;
    if (classification.confidence < 0.7) complexityScore += 0.2;
    
    if (complexityScore > 0.8) return 'expert';
    if (complexityScore > 0.5) return 'intermediate';
    return 'basic';
  }
  
  /**
   * Identify primary domain for persona selection
   */
  private static identifyDomain(query: string, classification: QueryClassification): string {
    const queryLower = query.toLowerCase();
    
    // Data analysis patterns
    if (/analyz|metric|statistic|trend|pattern|insight/i.test(query)) {
      return 'data_analysis';
    }
    
    // Project management patterns
    if (/project|planning|resource|timeline|deadline|milestone/i.test(query)) {
      return 'project_management';
    }
    
    // Time management patterns  
    if (/time|schedule|calendar|priority|urgent|deadline/i.test(query)) {
      return 'time_management';
    }
    
    // Productivity coaching patterns
    if (/productiv|habit|focus|workflow|optimiz|improve/i.test(query)) {
      return 'productivity_coaching';
    }
    
    return 'general_productivity';
  }
  
  /**
   * Match persona to requirements
   */
  private static matchPersonaToRequirements(
    domain: string,
    complexity: 'basic' | 'intermediate' | 'expert'
  ): PersonaProfile {
    
    // Domain-specific persona mapping
    const domainMapping: Record<string, string> = {
      data_analysis: 'data_analyst',
      project_management: 'project_manager', 
      time_management: 'time_management_expert',
      productivity_coaching: 'productivity_coach',
      general_productivity: 'productivity_assistant'
    };
    
    let selectedKey = domainMapping[domain] || 'productivity_assistant';
    
    // Adjust based on complexity if needed
    if (complexity === 'basic' && selectedKey !== 'productivity_assistant') {
      // For basic queries, consider using simpler persona
      if (Math.random() > 0.7) { // 30% chance to use basic persona
        selectedKey = 'productivity_assistant';
      }
    }
    
    return this.EXPERT_PERSONAS[selectedKey];
  }
  
  /**
   * Generate specific adaptations for the persona
   */
  private static generatePersonaAdaptations(
    query: string,
    persona: PersonaProfile,
    classification: QueryClassification
  ): string[] {
    const adaptations: string[] = [];
    
    const queryLower = query.toLowerCase();
    
    // Add domain-specific adaptations
    if (queryLower.includes('today') || queryLower.includes('now')) {
      adaptations.push('real-time analysis');
    }
    
    if (queryLower.includes('improve') || queryLower.includes('better')) {
      adaptations.push('improvement recommendations');
    }
    
    if (queryLower.includes('why') || queryLower.includes('reason')) {
      adaptations.push('causal analysis');
    }
    
    if (classification.primaryIntent === 'task_priority') {
      adaptations.push('priority frameworks');
    }
    
    return adaptations;
  }
  
  /**
   * Calculate confidence in persona selection
   */
  private static calculatePersonaConfidence(
    query: string,
    persona: PersonaProfile,
    classification: QueryClassification
  ): number {
    let confidence = 0.7; // Base confidence
    
    // Boost confidence for clear domain matches
    const queryLower = query.toLowerCase();
    const hasSpecializationMatch = persona.specializations.some(spec => 
      queryLower.includes(spec.toLowerCase().split(' ')[0])
    );
    
    if (hasSpecializationMatch) confidence += 0.2;
    if (classification.confidence > 0.8) confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }
  
  /**
   * Generate reasoning for persona selection
   */
  private static generateSelectionReasoning(
    domain: string,
    complexity: string,
    personaName: string
  ): string {
    return `Selected ${personaName} based on ${domain} domain requirements and ${complexity} complexity level. This persona provides optimal expertise for the query type and user needs.`;
  }
} 