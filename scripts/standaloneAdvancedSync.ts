import { createClient } from '@supabase/supabase-js';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
// Firebase Admin SDK - no need for client SDK imports
import { OpenAI } from 'openai';

// Configuration
const USER_ID = '7Y4oV5qJm4MFo0ZJBXkH0cJNk0z1';
// SECURITY: These must be loaded from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-key-here',
});

// Initialize Firebase Admin
let firestore: any;
let app: any;

function initializeFirebase() {
  try {
    app = initializeApp({
      credential: cert({
        projectId: "hour10000-make",
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || "",
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
      }),
    });
    firestore = getFirestore(app);
    console.log('✅ Firebase Admin initialized');
    return true;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    return false;
  }
}

// Data interfaces
interface SessionData {
  id: string;
  taskId: string;
  projectId: string;
  duration: number;
  sessionType?: string;
  startTime?: Date;
  endTime?: Date;
  notes?: string;
  status?: string;
  userId: string;
  date: string;
}

interface TaskData {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  completed: boolean;
  status?: string;
  timeSpent: number;
  timeEstimated?: number;
  userId: string;
  createdAt: Date;
  updatedAt?: Date;
}

interface ProjectData {
  id: string;
  name: string;
  color?: string;
  description?: string;
  userId: string;
}

// Main execution functions
async function getUserData(userId: string): Promise<{
  sessions: SessionData[];
  tasks: TaskData[];
  projects: ProjectData[];
}> {
  try {
    // Using Firebase Admin SDK
    console.log('📊 Loading user data from Firebase...');
    
    const tasksSnapshot = await firestore.collection('tasks').where('userId', '==', userId).get();
    const tasks: TaskData[] = tasksSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || 'Untitled Task',
        description: data.description || '',
        projectId: data.projectId || '',
        completed: data.completed || false,
        status: data.status || 'active',
        timeSpent: data.timeSpent || 0,
        timeEstimated: data.timeEstimated || 0,
        userId: data.userId,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate()
      };
    });

    const sessionsSnapshot = await firestore.collection('workSessions').where('userId', '==', userId).get();
    const sessions: SessionData[] = sessionsSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        taskId: data.taskId || '',
        projectId: data.projectId || '',
        duration: data.duration || 0,
        sessionType: data.sessionType || 'work',
        startTime: data.startTime?.toDate(),
        endTime: data.endTime?.toDate(),
        notes: data.notes || '',
        status: data.status || 'completed',
        userId: data.userId,
        date: data.date || new Date().toISOString().split('T')[0]
      };
    });

    const projectsSnapshot = await firestore.collection('projects').where('userId', '==', userId).get();
    const projects: ProjectData[] = projectsSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'Untitled Project',
        color: data.color || '#3498db',
        description: data.description || '',
        userId: data.userId
      };
    });

    console.log(`✅ Loaded: ${tasks.length} tasks, ${sessions.length} sessions, ${projects.length} projects`);
    return { sessions, tasks, projects };
  } catch (error) {
    console.error('❌ Error loading user data:', error);
    return { sessions: [], tasks: [], projects: [] };
  }
}

function generateSyntheticText(session: SessionData, task: TaskData, project: ProjectData): string {
  const startTime = session.startTime ? new Date(session.startTime).toLocaleTimeString('en-US', { 
    hour: '2-digit', minute: '2-digit' 
  }) : 'Unknown time';
  const duration = Math.round(session.duration || 0);
  
  let text = `User completed ${duration}-minute work session on '${task.title}' task from '${project.name}' project at ${startTime}.`;
  
  if (task.timeEstimated) {
    const progress = Math.round((task.timeSpent / task.timeEstimated) * 100);
    text += ` Task progress: ${progress}% (${Math.round(task.timeSpent)}/${task.timeEstimated} minutes).`;
  }
  
  if (session.notes) {
    text += ` Session notes: ${session.notes}`;
  }
  
  text += ` Task category: ${task.title.includes('bug') ? 'Bug Fix' : 'Feature Development'}.`;
  
  return text;
}

async function createEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ Embedding error:', error);
    return [];
  }
}

async function executeAdvancedSync() {
  console.log('🚀 Starting Advanced Multi-Level Sync...');
  console.log(`👤 User ID: ${USER_ID}`);
  console.log('');

  // Initialize Firebase
  if (!initializeFirebase()) {
    console.error('❌ Cannot proceed without Firebase connection');
    return;
  }

  const startTime = Date.now();
  
  try {
    // Step 1: Clear existing chunks
    console.log('🧹 Clearing existing chunks...');
    const { error: deleteError } = await supabase
      .from('user_productivity_documents')
      .delete()
      .eq('user_id', USER_ID);

    if (deleteError) {
      throw new Error(`Failed to clear existing chunks: ${deleteError.message}`);
    }

    // Step 2: Load user data
    const { sessions, tasks, projects } = await getUserData(USER_ID);
    
    if (sessions.length === 0) {
      console.log('⚠️ No session data found for user');
      return;
    }

    // Step 3: Generate and store chunks
    console.log('🔄 Generating synthetic chunks...');
    
    let chunksCreated = 0;
    const errors: string[] = [];

    for (const session of sessions) {
      const task = tasks.find(t => t.id === session.taskId);
      const project = projects.find(p => p.id === session.projectId);
      
      if (!task || !project) {
        errors.push(`Skipping session ${session.id}: missing task or project`);
        continue;
      }

      try {
        // Generate synthetic text
        const syntheticText = generateSyntheticText(session, task, project);
        
        // Create embedding
        const embedding = await createEmbedding(syntheticText);
        
        if (embedding.length === 0) {
          errors.push(`Failed to create embedding for session ${session.id}`);
          continue;
        }

        // Store in Supabase with specific content type instead of generic synthetic_chunk
        const documentData = {
          user_id: USER_ID,
          content_type: 'session', // Use specific content type
          content: syntheticText,
          embedding: embedding,
          metadata: {
            chunkType: 'session',
            chunkLevel: 1,
            sourceIds: [session.id],
            entities: {
              taskId: task.id,
              projectId: project.id,
              sessionIds: [session.id],
              userId: USER_ID
            },
            analytics: {
              duration: session.duration,
              sessionCount: 1,
              timeOfDay: session.startTime ? getTimeSlot(session.startTime) : 'unknown'
            },
            isEnhanced: true, // Mark as enhanced synthetic content
            documentId: session.id
          }
        };

        // Check if document already exists
        const { data: existingDoc } = await supabase
          .from('user_productivity_documents')
          .select('id')
          .eq('user_id', USER_ID)
          .eq('content_type', 'session')
          .eq('metadata->>documentId', session.id)
          .single();

        let error;
        if (existingDoc) {
          // Update existing document
          const result = await supabase
            .from('user_productivity_documents')
            .update(documentData)
            .eq('id', existingDoc.id);
          error = result.error;
        } else {
          // Insert new document
          const result = await supabase
            .from('user_productivity_documents')
            .insert(documentData);
          error = result.error;
        }

        if (error) {
          errors.push(`Insert error for session ${session.id}: ${error.message}`);
        } else {
          chunksCreated++;
        }

        // Rate limiting
        if (chunksCreated % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      } catch (error) {
        errors.push(`Processing error for session ${session.id}: ${error}`);
      }
    }

    const processingTime = Date.now() - startTime;

    // Results
    console.log('\n✅ Sync Results:');
    console.log(`   Success: ${chunksCreated > 0}`);
    console.log(`   Total Chunks: ${chunksCreated}`);
    console.log(`   Processing Time: ${processingTime}ms`);
    console.log(`   Data Processed: ${sessions.length} sessions, ${tasks.length} tasks, ${projects.length} projects`);
    
    if (errors.length > 0) {
      console.log(`   ⚠️ Errors (${errors.length}):`);
      errors.slice(0, 5).forEach(error => console.log(`     - ${error}`));
      if (errors.length > 5) {
        console.log(`     ... and ${errors.length - 5} more errors`);
      }
    }

    // Test a simple query
    if (chunksCreated > 0) {
      console.log('\n🧪 Testing simple query...');
      const { data: testDocs, error: queryError } = await supabase
        .from('user_productivity_documents')
        .select('*')
        .eq('user_id', USER_ID)
        .limit(3);

      if (queryError) {
        console.log('❌ Query test failed:', queryError.message);
      } else {
        console.log(`✅ Query test successful: Retrieved ${testDocs?.length || 0} documents`);
        if (testDocs && testDocs.length > 0) {
          console.log(`   Sample content: "${testDocs[0].content.substring(0, 100)}..."`);
        }
      }
    }

    console.log('\n🎉 Advanced Sync Complete!');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('1. Test the chat interface with queries like:');
    console.log('   - "What did I work on today?"');
    console.log('   - "How much time did I spend on tasks?"');
    console.log('   - "Show me my recent work sessions"');

  } catch (error) {
    console.error('❌ Advanced sync failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check Firebase connection and credentials');
    console.log('2. Verify Supabase connection');
    console.log('3. Ensure OpenAI API key is valid');
  }
}

function getTimeSlot(timestamp: Date): string {
  const hour = timestamp.getHours();
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

// Run the script
executeAdvancedSync().catch(console.error); 