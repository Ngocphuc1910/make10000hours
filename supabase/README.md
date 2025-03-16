# Supabase Configuration

This directory contains configuration files for Supabase, our backend service.

## Setup Instructions

### Remote Supabase Project (Current Setup)

1. Create a project on [Supabase](https://supabase.com).
2. Copy your project URL and anon key from the project settings.
3. Update the `.env` file at the root of the project with your Supabase credentials:
   ```
   REACT_APP_SUPABASE_URL=your_supabase_url
   REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. Run the SQL migrations in the Supabase SQL editor:
   - Copy the contents of `migrations/20240316_initial_schema.sql`
   - Paste and run in the SQL editor in the Supabase dashboard

### Local Development with Docker (Future Setup)

To set up Supabase locally for development (requires Docker Desktop):

1. Install Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop/).
2. Install the Supabase CLI: `npm install -g supabase`
3. Start Supabase locally: `supabase start`
4. The CLI will output local URLs and keys to use. Update your `.env` file:
   ```
   REACT_APP_SUPABASE_URL=http://localhost:54321
   REACT_APP_SUPABASE_ANON_KEY=your_local_anon_key
   ```
5. Access the local Supabase Studio at: `http://localhost:54323`

## Database Schema

The database schema is defined in `migrations/20240316_initial_schema.sql` and includes the following tables:

- `profiles`: User profile information
- `projects`: User projects
- `tags`: Project tags/categories
- `project_tags`: Junction table for project-tag relationships
- `tasks`: Tasks within projects
- `pomodoro_sessions`: Records of completed pomodoro sessions
- `blocked_sites`: URL patterns for the distraction blocker
- `daily_activity_logs`: Daily summaries for streak tracking

## Authentication

Authentication is handled through Supabase Auth. The app supports:

- Email/password authentication
- Google OAuth login

## Row Level Security (RLS)

Row Level Security is enabled for all tables, ensuring that users can only access their own data. RLS policies are defined in the migration script.

## Functions

The database includes the following functions:

- `handle_new_user()`: Creates a profile record when a new user signs up 