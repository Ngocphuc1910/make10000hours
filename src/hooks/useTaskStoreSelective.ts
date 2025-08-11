import { useTaskStore } from '../store/taskStore';
import { shallow } from 'zustand/shallow';

// Hook that excludes timeSpent from subscriptions to prevent TaskForm rerenders
// when timer boundary updates occur
export const useTaskStoreNoTimeSpent = () => {
  return useTaskStore(
    state => ({
      // Just return the projects and other state, don't transform tasks
      projects: state.projects,
      isAddingTask: state.isAddingTask,
      editingTaskId: state.editingTaskId,
      showDetailsMenu: state.showDetailsMenu,
      isLoading: state.isLoading,
      taskListViewMode: state.taskListViewMode,
      columnOrder: state.columnOrder,
      projectColumnOrder: state.projectColumnOrder,
    }),
    shallow
  );
};

// Hook to get a specific task's timeSpent when needed
export const useTaskTimeSpent = (taskId: string) => {
  return useTaskStore(state => {
    if (!taskId) return 0;
    const task = state.tasks.find(t => t.id === taskId);
    return task?.timeSpent || 0;
  });
};