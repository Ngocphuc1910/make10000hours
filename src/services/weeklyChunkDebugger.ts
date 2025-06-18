import { HierarchicalChunker } from './hierarchicalChunker';
import { SyntheticTextGenerator } from './syntheticTextGenerator';

export class WeeklyChunkDebugger {
  /**
   * Debug the weekly chunk generation process step by step
   */
  static async debugWeeklyChunkGeneration(userId: string): Promise<{
    success: boolean;
    issues: string[];
    recommendations: string[];
    sampleOutput: string;
  }> {
    console.log('🐛 Starting weekly chunk debug process...');
    
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    try {
      // Step 1: Generate chunks and capture the process
      console.log('📊 Step 1: Generating chunks...');
      const chunks = await HierarchicalChunker.createMultiLevelChunks(userId);
      
      // Step 2: Analyze weekly chunks specifically
      const weeklyChunks = chunks.filter(chunk => 
        chunk.content_type === 'weekly_summary' || 
        (chunk.metadata.chunkType === 'temporal_pattern' && chunk.metadata.timeframe?.startsWith('weekly_'))
      );
      
      console.log(`📅 Found ${weeklyChunks.length} weekly chunks`);
      
      if (weeklyChunks.length === 0) {
        issues.push('No weekly chunks generated');
        recommendations.push('Check if sessions have valid dates and are being grouped correctly by week');
      }
      
      // Step 3: Analyze content quality
      for (const chunk of weeklyChunks) {
        console.log(`🔍 Analyzing chunk: ${chunk.id}`);
        
        const content = chunk.content;
        const hasData = this.analyzeContentQuality(content);
        
        if (!hasData.hasTimesData) {
          issues.push(`Chunk ${chunk.id} has no time data`);
          recommendations.push('Check session duration aggregation and date filtering');
        }
        
        if (!hasData.hasProjectData) {
          issues.push(`Chunk ${chunk.id} has no project data`);
          recommendations.push('Verify project-task relationships and session-project mappings');
        }
        
        if (!hasData.hasTaskData) {
          issues.push(`Chunk ${chunk.id} has no task data`);
          recommendations.push('Check task-session relationships and task filtering logic');
        }
        
        console.log(`Content quality for ${chunk.id}:`, hasData);
      }
      
      // Step 4: Return sample output
      const sampleOutput = weeklyChunks.length > 0 ? weeklyChunks[0].content : 'No weekly chunks generated';
      
      return {
        success: issues.length === 0,
        issues,
        recommendations,
        sampleOutput
      };
      
    } catch (error) {
      console.error('❌ Debug process failed:', error);
      issues.push(`Debug process failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      recommendations.push('Check console logs for detailed error information');
      
      return {
        success: false,
        issues,
        recommendations,
        sampleOutput: ''
      };
    }
  }
  
  /**
   * Analyze the quality of generated content
   */
  private static analyzeContentQuality(content: string): {
    hasTimesData: boolean;
    hasProjectData: boolean;
    hasTaskData: boolean;
    hasSessionData: boolean;
  } {
    // Check for time-related patterns
    const hasTimesData = /\d+\s*(hours?|minutes?|mins?|h|m)/.test(content) && 
                         !/0\s*minutes?\s*total/.test(content);
    
    // Check for project mentions
    const hasProjectData = /project/i.test(content) && 
                          !/0\s*projects/.test(content);
    
    // Check for task mentions
    const hasTaskData = /task/i.test(content) && 
                       !/0\s*tasks/.test(content);
    
    // Check for session mentions
    const hasSessionData = /session/i.test(content) && 
                          !/0\s*work\s*sessions/.test(content);
    
    return {
      hasTimesData,
      hasProjectData,
      hasTaskData,
      hasSessionData
    };
  }
  
  /**
   * Test with mock data to verify the fix works
   */
  static async testWithMockData(): Promise<string> {
    console.log('🧪 Testing with mock data...');
    
    const mockSessions = [
      {
        id: 'session1',
        userId: 'test-user',
        taskId: 'task1',
        projectId: 'project1',
        date: '2025-06-16',
        duration: 45,
        sessionType: 'pomodoro' as const,
        status: 'completed' as const,
        startTime: new Date('2025-06-16T09:00:00Z'),
        createdAt: new Date('2025-06-16T09:00:00Z'),
        updatedAt: new Date('2025-06-16T09:45:00Z')
      },
      {
        id: 'session2',
        userId: 'test-user',
        taskId: 'task2',
        projectId: 'project1',
        date: '2025-06-17',
        duration: 30,
        sessionType: 'manual' as const,
        status: 'completed' as const,
        startTime: new Date('2025-06-17T10:00:00Z'),
        createdAt: new Date('2025-06-17T10:00:00Z'),
        updatedAt: new Date('2025-06-17T10:30:00Z')
      }
    ];
    
    const mockTasks = [
      {
        id: 'task1',
        title: 'Test Task 1',
        projectId: 'project1',
        completed: false,
        status: 'pomodoro' as const,
        timeSpent: 45,
        timeEstimated: 60,
        userId: 'test-user',
        createdAt: new Date('2025-06-16T08:00:00Z'),
        updatedAt: new Date('2025-06-16T09:45:00Z'),
        order: 1
      },
      {
        id: 'task2',
        title: 'Test Task 2',
        projectId: 'project1',
        completed: true,
        status: 'completed' as const,
        timeSpent: 30,
        timeEstimated: 30,
        userId: 'test-user',
        createdAt: new Date('2025-06-17T09:00:00Z'),
        updatedAt: new Date('2025-06-17T10:30:00Z'),
        order: 2
      }
    ];
    
    const mockProjects = [
      {
        id: 'project1',
        name: 'Test Project',
        userId: 'test-user',
        createdAt: new Date('2025-06-15T00:00:00Z')
      }
    ];
    
    // Generate weekly summary with mock data
    const weeklyContent = SyntheticTextGenerator.generateTemporalSummaryText(
      'weekly',
      mockSessions,
      '2025-06-16T00:00:00Z', // Monday of the week
      mockTasks,
      mockProjects
    );
    
    console.log('🎯 Mock weekly summary generated:');
    console.log(weeklyContent);
    
    return weeklyContent;
  }
} 