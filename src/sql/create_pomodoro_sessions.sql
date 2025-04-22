-- SQL function to create the pomodoro_sessions table
CREATE OR REPLACE FUNCTION create_pomodoro_sessions_table()
RETURNS void AS $$
BEGIN
  -- Check if the table exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'pomodoro_sessions'
  ) THEN
    -- Create the table if it doesn't exist
    CREATE TABLE public.pomodoro_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES auth.users(id),
      task_id TEXT, -- Can be null for sessions not associated with a task
      start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      end_time TIMESTAMP WITH TIME ZONE,
      duration INTEGER DEFAULT 0, -- Duration in seconds
      completed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Add RLS policies
    ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;
    
    -- Create policy to allow users to select their own sessions
    CREATE POLICY select_own_sessions ON public.pomodoro_sessions
      FOR SELECT USING (auth.uid() = user_id);
    
    -- Create policy to allow users to insert their own sessions
    CREATE POLICY insert_own_sessions ON public.pomodoro_sessions
      FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    -- Create policy to allow users to update their own sessions
    CREATE POLICY update_own_sessions ON public.pomodoro_sessions
      FOR UPDATE USING (auth.uid() = user_id);
    
    -- Create policy to allow users to delete their own sessions
    CREATE POLICY delete_own_sessions ON public.pomodoro_sessions
      FOR DELETE USING (auth.uid() = user_id);
    
    -- Add indexes
    CREATE INDEX pomodoro_sessions_user_id_idx ON public.pomodoro_sessions(user_id);
    CREATE INDEX pomodoro_sessions_task_id_idx ON public.pomodoro_sessions(task_id);
    
    -- Add trigger for updated_at
    CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.pomodoro_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$ LANGUAGE plpgsql; 