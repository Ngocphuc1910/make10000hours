-- Create pomodoro_sessions table for tracking time spent
CREATE TABLE IF NOT EXISTS public.pomodoro_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE,
  duration INTEGER NOT NULL DEFAULT 0, -- Duration in seconds
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Set up Row Level Security policies
ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own pomodoro sessions
CREATE POLICY pomodoro_sessions_select_policy ON public.pomodoro_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can only insert their own pomodoro sessions
CREATE POLICY pomodoro_sessions_insert_policy ON public.pomodoro_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own pomodoro sessions
CREATE POLICY pomodoro_sessions_update_policy ON public.pomodoro_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can only delete their own pomodoro sessions
CREATE POLICY pomodoro_sessions_delete_policy ON public.pomodoro_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions for authenticated users
GRANT ALL ON public.pomodoro_sessions TO authenticated; 