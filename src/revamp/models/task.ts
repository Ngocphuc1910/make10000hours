export interface Task {
  id: string;
  user_id: string;
  project_id?: string;
  title: string;
  note: string;
  status: string;
  updated_at: string;
  created_at: string;
  time_estimated: number;
  time_spent: number;
}