-- Create tables for the pomodoro application

-- Create profiles table (extends the auth.users table)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  daily_goal_hours NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  target_hours NUMERIC(8,2) DEFAULT 0,
  completed_hours NUMERIC(8,2) DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tags table
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project_tags junction table
CREATE TABLE IF NOT EXISTS public.project_tags (
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, tag_id)
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  priority INTEGER DEFAULT 0,
  estimated_pomodoros INTEGER DEFAULT 0,
  completed_pomodoros INTEGER DEFAULT 0,
  due_date TIMESTAMP WITH TIME ZONE,
  is_archived BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create pomodoro_sessions table
CREATE TABLE IF NOT EXISTS public.pomodoro_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  duration INTEGER NOT NULL, -- in seconds
  session_type TEXT NOT NULL, -- 'pomodoro', 'short_break', 'long_break'
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_completed BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create blocked_sites table for distraction blocking
CREATE TABLE IF NOT EXISTS public.blocked_sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url_pattern TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create daily_activity_logs for streak tracking and analytics
CREATE TABLE IF NOT EXISTS public.daily_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  total_pomodoros INTEGER DEFAULT 0,
  total_time_seconds INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_activity_logs ENABLE ROW LEVEL SECURITY;

-- Create Row Level Security Policies
-- Profiles: Users can only see and update their own profiles
CREATE POLICY profiles_select_policy ON public.profiles 
  FOR SELECT USING (auth.uid() = id);
  
CREATE POLICY profiles_insert_policy ON public.profiles 
  FOR INSERT WITH CHECK (auth.uid() = id);
  
CREATE POLICY profiles_update_policy ON public.profiles 
  FOR UPDATE USING (auth.uid() = id);

-- Projects: Users can only access their own projects
CREATE POLICY projects_select_policy ON public.projects 
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY projects_insert_policy ON public.projects 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY projects_update_policy ON public.projects 
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY projects_delete_policy ON public.projects 
  FOR DELETE USING (auth.uid() = user_id);

-- Similar policies for other tables...
-- Tags
CREATE POLICY tags_select_policy ON public.tags
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY tags_insert_policy ON public.tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY tags_update_policy ON public.tags
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY tags_delete_policy ON public.tags
  FOR DELETE USING (auth.uid() = user_id);

-- Project Tags: Allow users to manage tags for their own projects
CREATE POLICY project_tags_select_policy ON public.project_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE public.projects.id = project_id
      AND public.projects.user_id = auth.uid()
    )
  );
  
CREATE POLICY project_tags_insert_policy ON public.project_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE public.projects.id = project_id
      AND public.projects.user_id = auth.uid()
    )
  );
  
CREATE POLICY project_tags_delete_policy ON public.project_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE public.projects.id = project_id
      AND public.projects.user_id = auth.uid()
    )
  );

-- Tasks
CREATE POLICY tasks_select_policy ON public.tasks
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY tasks_insert_policy ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY tasks_update_policy ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY tasks_delete_policy ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);

-- Pomodoro Sessions
CREATE POLICY pomodoro_sessions_select_policy ON public.pomodoro_sessions
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY pomodoro_sessions_insert_policy ON public.pomodoro_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY pomodoro_sessions_update_policy ON public.pomodoro_sessions
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY pomodoro_sessions_delete_policy ON public.pomodoro_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Blocked Sites
CREATE POLICY blocked_sites_select_policy ON public.blocked_sites
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY blocked_sites_insert_policy ON public.blocked_sites
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY blocked_sites_update_policy ON public.blocked_sites
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY blocked_sites_delete_policy ON public.blocked_sites
  FOR DELETE USING (auth.uid() = user_id);

-- Daily Activity Logs
CREATE POLICY daily_activity_logs_select_policy ON public.daily_activity_logs
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY daily_activity_logs_insert_policy ON public.daily_activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY daily_activity_logs_update_policy ON public.daily_activity_logs
  FOR UPDATE USING (auth.uid() = user_id);

-- Create or update function for profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user(); 