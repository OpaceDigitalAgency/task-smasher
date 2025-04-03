import { ReactNode } from 'react';

export interface Task {
  id: string;
  title: string;
  subtasks: Task[];
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  estimatedTime: number;
  expanded?: boolean;
  feedback?: number;
  context?: string;
  regenerateCount?: number;
  actions?: string[];
  boardId?: string;
}

export type Board = {
  id: string;
  title: string;
  tasks: Task[];
};

export interface FeedbackState {
  taskId: string;
  showing: boolean;
}

export interface EditingState {
  taskId: string | null;
  subtaskId: string | null;
  field: 'title' | 'time' | 'priority' | null;
  value: string;
}

export interface DroppableBoardProps {
  board: Board;
  children: ReactNode;
}

export interface TaskProps {
  task: Task;
  boardId: string;
  onToggleExpanded: (taskId: string) => void;
  onToggleComplete: (taskId: string, boardId: string) => void;
  onShowFeedback: (taskId: string) => void;
  onDeleteTask: (taskId: string, boardId: string) => void;
  onGenerateSubtasks: (taskId: string) => void;
  onAddSubtask: (taskId: string, boardId: string) => void;
  onRegenerateTask: (taskId: string) => void;
  showContextInput: string | null;
  setShowContextInput: (taskId: string | null) => void;
  contextInput: string;
  setContextInput: (value: string) => void;
  updateContext: (taskId: string) => void;
  generating: boolean;
  activeTask: string | null;
  editing: EditingState;
  startEditing: (taskId: string, subtaskId: string | null, field: 'title' | 'time' | 'priority', currentValue: string) => void;
  handleEditSave: (boardId: string) => void;
  updateTaskPriority?: (taskId: string, boardId: string, priority: 'low' | 'medium' | 'high') => void;
}

export interface BoardComponentProps {
  board: Board;
  tasks: Task[];
  editingBoardId: string | null;
  setEditingBoardId: (id: string | null) => void;
  updateBoardTitle: (boardId: string, newTitle: string) => void;
  onToggleExpanded: (taskId: string) => void;
  onToggleComplete: (taskId: string, boardId: string) => void;
  onShowFeedback: (taskId: string) => void;
  onDeleteTask: (taskId: string, boardId: string) => void;
  onGenerateSubtasks: (taskId: string) => void;
  onAddSubtask: (taskId: string, boardId: string) => void;
  onRegenerateTask: (taskId: string) => void;
  showContextInput: string | null;
  setShowContextInput: (taskId: string | null) => void;
  contextInput: string;
  setContextInput: (value: string) => void;
  updateContext: (taskId: string) => void;
  generating: boolean;
  activeTask: string | null;
  editing: EditingState;
  startEditing: (taskId: string, subtaskId: string | null, field: 'title' | 'time' | 'priority', currentValue: string) => void;
  handleEditSave: (boardId: string) => void;
  updateTaskPriority?: (taskId: string, boardId: string, priority: 'low' | 'medium' | 'high') => void;
  isDraggingOver: string | null;
}

export interface SubtaskProps {
  subtask: Task;
  taskId: string;
  boardId: string;
  onToggleComplete: (taskId: string, boardId: string) => void;
  editing: EditingState;
  startEditing: (taskId: string, subtaskId: string | null, field: 'title' | 'time' | 'priority', currentValue: string) => void;
  handleEditSave: (boardId: string) => void;
  onDeleteTask: (taskId: string, boardId: string) => void;
  updateTaskPriority?: (taskId: string, boardId: string, priority: 'low' | 'medium' | 'high') => void;
}

export interface TaskMismatchData {
  showing: boolean;
  reason: string;
  suggestedUseCase?: string;
}