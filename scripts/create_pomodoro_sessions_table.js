/**
 * Script to create the pomodoro_sessions table
 * 
 * Run with: node --input-type=module scripts/create_pomodoro_sessions_table.js
 */

async function main() {
  try {
    // Dynamically import the Supabase client
    const { default: supabase } = await import('../src/lib/supabase.js');
    
    console.log('Checking if pomodoro_sessions table exists...');
    
    // Check if the table exists
    const { error: checkError } = await supabase
      .from('pomodoro_sessions')
      .select('id')
      .limit(1);
      
    // If no error, table exists
    if (!checkError) {
      console.log('✅ pomodoro_sessions table already exists');
      return true;
    }
    
    // If error indicates table doesn't exist, create it
    if (checkError.code === '42P01' || checkError.message?.includes('relation "pomodoro_sessions" does not exist')) {
      console.log('🔧 pomodoro_sessions table does not exist, creating...');
      
      // Direct SQL approach 
      const { error: sqlError } = await supabase.query(`
        CREATE TABLE IF NOT EXISTS public.pomodoro_sessions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL,
          task_id UUID,
          start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          end_time TIMESTAMP WITH TIME ZONE,
          duration INTEGER NOT NULL DEFAULT 0,
          completed BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        );
        
        -- Enable RLS
        ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;
        
        -- Create basic policies
        CREATE POLICY IF NOT EXISTS pomodoro_sessions_select_policy ON public.pomodoro_sessions
          FOR SELECT USING (auth.uid() = user_id);
        
        CREATE POLICY IF NOT EXISTS pomodoro_sessions_insert_policy ON public.pomodoro_sessions
          FOR INSERT WITH CHECK (auth.uid() = user_id);
          
        CREATE POLICY IF NOT EXISTS pomodoro_sessions_update_policy ON public.pomodoro_sessions
          FOR UPDATE USING (auth.uid() = user_id);
          
        CREATE POLICY IF NOT EXISTS pomodoro_sessions_delete_policy ON public.pomodoro_sessions
          FOR DELETE USING (auth.uid() = user_id);
          
        -- Grant permissions
        GRANT ALL ON public.pomodoro_sessions TO authenticated;
      `);
      
      if (sqlError) {
        console.error('❌ Error creating pomodoro_sessions table:', sqlError);
        return false;
      } else {
        console.log('✅ Successfully created pomodoro_sessions table');
        
        // Verify the table was created
        const { error: verifyError } = await supabase
          .from('pomodoro_sessions')
          .select('id')
          .limit(1);
          
        if (verifyError) {
          console.error('❌ Table creation verification failed:', verifyError);
          return false;
        }
        
        console.log('✅ Table creation verified successfully');
        return true;
      }
    }
    
    console.error('❌ Unexpected error checking pomodoro_sessions table:', checkError);
    return false;
  } catch (error) {
    console.error('❌ Exception in script:', error);
    return false;
  }
}

// Run the function
main()
  .then(result => {
    console.log(`Table creation ${result ? 'succeeded' : 'failed'}`);
    process.exit(result ? 0 : 1);
  })
  .catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  }); 