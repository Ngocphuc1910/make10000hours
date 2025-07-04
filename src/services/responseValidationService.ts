import { OpenAIService } from './openai';

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  issues: ValidationIssue[];
  corrections: string[];
  overall_score: number;
}

export interface ValidationIssue {
  type: 'accuracy' | 'relevance' | 'completeness' | 'clarity' | 'factual';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
}

export interface SelfCorrectionResult {
  original_response: string;
  corrected_response: string;
  improvements: string[];
  validation_score: number;
  processing_time: number;
}

export class ResponseValidationService {
  
  /**
   * Validate AI response quality across multiple dimensions
   */
  static async validateResponse(
    query: string,
    response: string,
    context: string,
    sources: any[]
  ): Promise<ValidationResult> {
    
    const validationPrompt = this.buildValidationPrompt(query, response, context, sources);
    
    try {
      const validationResponse = await OpenAIService.generateChatResponse({
        query: validationPrompt,
        context: context,
        conversationHistory: []
      });
      
      return this.parseValidationResponse(validationResponse);
      
    } catch (error) {
      console.error('Response validation failed:', error);
      return this.generateFallbackValidation();
    }
  }
  
  /**
   * Self-correct response based on validation feedback
   */
  static async performSelfCorrection(
    query: string,
    response: string,
    context: string,
    validationResult: ValidationResult
  ): Promise<SelfCorrectionResult> {
    const startTime = Date.now();
    
    if (validationResult.overall_score > 0.8) {
      // Response is already high quality, no correction needed
      return {
        original_response: response,
        corrected_response: response,
        improvements: ['No corrections needed - response quality is excellent'],
        validation_score: validationResult.overall_score,
        processing_time: Date.now() - startTime
      };
    }
    
    const correctionPrompt = this.buildCorrectionPrompt(query, response, context, validationResult);
    
    try {
      const correctedResponse = await OpenAIService.generateChatResponse({
        query: correctionPrompt,
        context: context,
        conversationHistory: []
      });
      
      // Re-validate the corrected response
      const newValidation = await this.validateResponse(query, correctedResponse, context, []);
      
      return {
        original_response: response,
        corrected_response: correctedResponse,
        improvements: this.identifyImprovements(validationResult),
        validation_score: newValidation.overall_score,
        processing_time: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('Self-correction failed:', error);
      return {
        original_response: response,
        corrected_response: response,
        improvements: ['Correction process failed - using original response'],
        validation_score: validationResult.overall_score,
        processing_time: Date.now() - startTime
      };
    }
  }
  
  /**
   * Build validation prompt for quality assessment
   */
  private static buildValidationPrompt(
    query: string,
    response: string,
    context: string,
    sources: any[]
  ): string {
    return `Evaluate this AI response for quality and directness:

USER QUERY: "${query}"

AI RESPONSE TO EVALUATE:
${response}

VALIDATION CRITERIA:
1. DIRECTNESS: Does it answer exactly what was asked without extra information?
2. BREVITY: Is it concise and to the point?
3. RELEVANCE: Is all information directly related to the question?
4. COMPLETENESS: Are essential details included (but not more)?

Rate each criterion 0.0-1.0 and provide overall score.

SCORE: [0.0-1.0]
ISSUES:
- [issue type]: [brief description]
CORRECTIONS NEEDED:
- [specific correction to make it more direct]

VALIDATION: [PASS/FAIL]`;
  }
  
  /**
   * Build correction prompt for self-improvement
   */
  private static buildCorrectionPrompt(
    query: string,
    response: string,
    context: string,
    validationResult: ValidationResult
  ): string {
    const issueDescriptions = validationResult.issues
      .map(issue => `${issue.type}: ${issue.description}`)
      .join('\n');
    
    const suggestions = validationResult.corrections.join('\n');
    
    return `Make this response more direct and focused:

ORIGINAL QUERY: "${query}"

ORIGINAL RESPONSE:
${response}

ISSUES TO FIX:
${issueDescriptions}

IMPROVEMENTS NEEDED:
${suggestions}

CONTEXT:
${context.substring(0, 300)}...

Provide a more direct, focused response that:
1. Answers exactly what was asked
2. Removes unnecessary information
3. Keeps only essential details
4. Is brief and scannable

IMPROVED RESPONSE:`;
  }
  
  /**
   * Parse validation response into structured result
   */
  private static parseValidationResponse(validationResponse: string): ValidationResult {
    const lines = validationResponse.split('\n');
    let overallScore = 0.7;
    let confidence = 0.7;
    let isValid = true;
    const issues: ValidationIssue[] = [];
    const corrections: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('OVERALL SCORE:')) {
        const match = trimmed.match(/OVERALL SCORE:\s*([\d.]+)/);
        if (match) {
          overallScore = Math.min(1.0, Math.max(0.0, parseFloat(match[1])));
        }
      } else if (trimmed.startsWith('CONFIDENCE:')) {
        const match = trimmed.match(/CONFIDENCE:\s*([\d.]+)/);
        if (match) {
          confidence = Math.min(1.0, Math.max(0.0, parseFloat(match[1])));
        }
      } else if (trimmed.startsWith('VALIDATION:')) {
        isValid = trimmed.includes('PASS');
      } else if (trimmed.startsWith('- Type:')) {
        const issue = this.parseValidationIssue(trimmed);
        if (issue) issues.push(issue);
      } else if (trimmed.startsWith('- ') && !trimmed.includes('Type:')) {
        corrections.push(trimmed.substring(2));
      }
    }
    
    return {
      isValid: isValid && overallScore > 0.6,
      confidence,
      issues,
      corrections,
      overall_score: overallScore
    };
  }
  
  /**
   * Parse individual validation issue
   */
  private static parseValidationIssue(line: string): ValidationIssue | null {
    const typeMatch = line.match(/Type:\s*(\w+)/);
    const severityMatch = line.match(/Severity:\s*(\w+)/);
    const descMatch = line.match(/Description:\s*(.+?)(?:Suggestion:|$)/);
    const suggMatch = line.match(/Suggestion:\s*(.+)/);
    
    if (!typeMatch || !severityMatch) return null;
    
    return {
      type: typeMatch[1] as ValidationIssue['type'],
      severity: severityMatch[1] as ValidationIssue['severity'],
      description: descMatch?.[1]?.trim() || 'Issue identified',
      suggestion: suggMatch?.[1]?.trim() || 'Review and improve'
    };
  }
  
  /**
   * Identify improvements made during correction
   */
  private static identifyImprovements(validationResult: ValidationResult): string[] {
    return validationResult.issues.map(issue => 
      `Addressed ${issue.type} issue: ${issue.suggestion}`
    );
  }
  
  /**
   * Generate fallback validation when process fails
   */
  private static generateFallbackValidation(): ValidationResult {
    return {
      isValid: true,
      confidence: 0.6,
      issues: [],
      corrections: [],
      overall_score: 0.7
    };
  }
  
  /**
   * Quick quality check without full validation
   */
  static quickQualityCheck(response: string, query: string): {
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 1.0;
    
    // Check response length appropriateness
    if (response.length < 50) {
      issues.push('Response too short');
      score -= 0.3;
    } else if (response.length > 2000) {
      issues.push('Response too long');
      score -= 0.1;
    }
    
    // Check for generic responses
    if (/I don't have|I cannot|I'm unable/i.test(response)) {
      issues.push('Generic negative response');
      score -= 0.2;
    }
    
    // Check for query relevance
    const queryWords = query.toLowerCase().split(' ').filter(w => w.length > 3);
    const responseWords = response.toLowerCase();
    const relevanceCount = queryWords.filter(word => responseWords.includes(word)).length;
    const relevanceRatio = relevanceCount / Math.max(1, queryWords.length);
    
    if (relevanceRatio < 0.3) {
      issues.push('Low query relevance');
      score -= 0.2;
    }
    
    return {
      score: Math.max(0.0, score),
      issues
    };
  }
} 