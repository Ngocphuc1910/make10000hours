# Task Database Integration

This document describes the database integration for storing tasks in the Make10000Hours application.

## Database Schema

The task data is stored in the `tasks` table in the Supabase database with the following schema:

```sql
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
```

## Data Flow

The following diagram shows the data flow for tasks in the application:

```
User Action → React Component → TaskContext → Database Service → Supabase
```

## Key Components

### TaskContext (src/contexts/TaskContext.js)

The TaskContext serves as the central state management for tasks in the application. It provides the following functionality:

- Load tasks from the database when a user logs in
- Add, update, and delete tasks in both the local state and the database
- Handle session tasks that haven't been added to the main task list yet
- Provide fallback to localStorage when offline or when no user is logged in
- Track sync status and pending changes

### Database Service (src/lib/database.js)

The database service provides direct access to the Supabase database:

- `getTasks`: Retrieves all tasks for a user, optionally filtered by project
- `createTask`: Creates a new task in the database
- `updateTask`: Updates an existing task in the database
- `deleteTask`: Deletes a task from the database

### Task Sync Service (src/services/taskSyncService.js)

The task sync service handles synchronization between the local state and the database:

- Provides methods for syncing task creation, updates, and deletion
- Handles error recovery with a retry queue
- Tracks pending operations that need to be synced

## Task Status

Tasks can have the following status values in the database:

- `todo`: A regular task that hasn't been completed yet
- `completed`: A task that has been marked as completed
- `session`: A task that exists in the session list but hasn't been added to the main task list yet

## Session vs. Main Tasks

The application distinguishes between two types of tasks:

1. **Main Tasks**: Regular tasks that appear in the main task list
2. **Session Tasks**: Tasks that are created for a specific pomodoro session but haven't been added to the main task list yet

When a task is moved from the session list to the main list (via `moveToMainTasks`), its status is updated from `session` to `todo` in the database.

## Offline Support

The application supports offline usage with the following features:

- Tasks are always stored in localStorage as a backup
- When a user logs in, tasks from both the database and localStorage are merged
- When offline, operations are queued and synchronized when the application comes back online

## Error Handling

The application handles database errors with the following strategies:

- When an operation fails, it is added to a retry queue
- Operations in the retry queue are retried with exponential backoff
- The UI displays the sync status and number of pending operations


```javascript
import { useTasks } from '../hooks/useTasks';

const MyComponent = () => {
  const { 
    tasks, 
    addTask, 
    updateTask, 
    deleteTask,
    syncStatus 
  } = useTasks();

  const handleAddTask = async () => {
    const newTask = await addTask({
      title: 'New Task',
      description: 'Task description',
      estimatedPomodoros: 2,
      priority: 1
    });
    console.log('Task added:', newTask);
  };

  return (
    <div>
      <button onClick={handleAddTask}>Add Task</button>
      {syncStatus === 'syncing' && <span>Syncing...</span>}
      {syncStatus === 'error' && <span>Sync error</span>}
      <ul>
        {tasks.map(task => (
          <li key={task.id}>
            {task.title}
            {!task.synced && <span> (not synced)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};
``` 