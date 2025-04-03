import { useState, useEffect, useCallback, useRef } from 'react';
import { Board, EditingState, FeedbackState, Task, TaskMismatchData } from '../types';
import { filterTasksByPriority, filterTasksByRating } from '../utils/taskUtils';
import { validateTaskLocally, validateTaskWithAI } from '../utils/taskContextValidator';

const API_URL = 'https://api.openai.com/v1/chat/completions';

export function useTasks() {
  const [openAIKey, setOpenAIKey] = useState(import.meta.env.VITE_OPENAI_API_KEY || '');
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo');
  const [totalCost, setTotalCost] = useState(0);
  const [executionCount, setExecutionCount] = useState(0);
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>('daily');
  
  const [boards, setBoards] = useState<Board[]>([
    { id: 'todo', title: 'To Do', tasks: [] },
    { id: 'inprogress', title: 'In Progress', tasks: [] },
    { id: 'done', title: 'Done', tasks: [] }
  ]);
  
  const [newTask, setNewTask] = useState('');
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({ taskId: '', showing: false });
  const [generating, setGenerating] = useState(false);
  const [showContextInput, setShowContextInput] = useState<string | null>(null);
  const [contextInput, setContextInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [breakdownLevel, setBreakdownLevel] = useState(3);
  const [filterPriority, setFilterPriority] = useState<'low' | 'medium' | 'high' | 'all'>('all');
  const [filterRating, setFilterRating] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState>({ 
    taskId: null, 
    subtaskId: null, 
    field: null, 
    value: '' 
  });
  
  // Task mismatch states
  const [taskMismatch, setTaskMismatch] = useState<TaskMismatchData>({
    showing: false,
    reason: '',
    suggestedUseCase: undefined
  });
  
  // History for undo functionality
  const [history, setHistory] = useState<Board[][]>([]);
  
  // Refs for voice input
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Check if audio recording is available
  const audioAvailable = typeof window !== 'undefined' && 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;

  useEffect(() => {
    if (selectedUseCase) {
      document.documentElement.style.setProperty('--primary-color', `var(--${selectedUseCase}-primary)`);
      document.documentElement.style.setProperty('--primary-light', `var(--${selectedUseCase}-light)`);
      document.documentElement.style.setProperty('--secondary-light', `var(--${selectedUseCase}-secondary)`);
    }
  }, [selectedUseCase]);

  // Initialize daily organizer as default on load
  useEffect(() => {
    handleSelectUseCase('daily');
  }, []);
  
  // Add CSS animation styles dynamically
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes shrink {
        0% { width: 100%; }
        100% { width: 0%; }
      }
      
      .animate-in {
        animation: pop-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      }
      
      .animate-out {
        animation: pop-out 0.5s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards;
      }
      
      @keyframes pop-in {
        0% { transform: translate(-50%, -30%) scale(0.95); opacity: 0; }
        100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      }
      
      @keyframes pop-out {
        0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        100% { transform: translate(-50%, -30%) scale(0.95); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const checkTaskContext = useCallback(async (taskText: string) => {
    if (!selectedUseCase || !taskText.trim()) return true;
    
    const result = await validateTaskWithAI(taskText, selectedUseCase, openAIKey);
    
    if (!result.isValid && result.confidence > 0.6) {
      setTaskMismatch({
        showing: true,
        reason: result.reason,
        suggestedUseCase: result.suggestedUseCase
      });
      return false;
    }
    
    return true;
  }, [selectedUseCase, openAIKey]);

  const handleAddTask = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (newTask.trim()) {
      // Check if task matches selected use case
      const isContextValid = await checkTaskContext(newTask);
      
      // Continue with task creation
      setHistory(prev => [...prev, boards]);
      
      setBoards(prev => {
        const todoBoard = prev.find(board => board.id === 'todo');
        if (!todoBoard) return prev;
        
        return prev.map(board => {
          if (board.id === 'todo') {
            return {
              ...board,
              tasks: [
                ...board.tasks,
                {
                  id: `task-${Date.now()}`,
                  title: newTask.trim(),
                  subtasks: [],
                  completed: false,
                  priority: 'medium',
                  estimatedTime: 1,
                  expanded: false,
                  boardId: 'todo'
                }
              ]
            };
          }
          return board;
        });
      });
      
      setNewTask('');
    }
  }, [newTask, boards, checkTaskContext]);
  
  const startEditing = useCallback((
    taskId: string, 
    subtaskId: string | null, 
    field: 'title' | 'time' | 'priority', 
    currentValue: string
  ) => {
    setEditing({
      taskId,
      subtaskId,
      field,
      value: currentValue
    });
  }, []);
  console.log("🔁 This is a test update.");
  const handleEditSave = useCallback((boardId: string) => {
    const { taskId, subtaskId, field, value } = editing;
    
    if (!taskId || !field) {
      setEditing({ taskId: null, subtaskId: null, field: null, value: '' });
      return;
    }
    
    setHistory(prev => [...prev, boards]);
    
    setBoards(prevBoards => {
      return prevBoards.map(board => {
        if (board.id !== boardId) return board;
        
        return {
          ...board,
          tasks: board.tasks.map(task => {
            // If we're editing a subtask
            if (subtaskId && task.id === taskId) {
              return {
                ...task,
                subtasks: task.subtasks.map(subtask => {
                  if (subtask.id === subtaskId) {
                    if (field === 'title') {
                      return { ...subtask, title: value };
                    } else if (field === 'time') {
                      const time = parseFloat(value) || 0;
                      return { ...subtask, estimatedTime: time };
                    } else if (field === 'priority') {
                      return { ...subtask, priority: value as 'low' | 'medium' | 'high' };
                    }
                  }
                  return subtask;
                })
              };
            }
            
            // If we're editing the main task
            if (!subtaskId && task.id === taskId) {
              if (field === 'title') {
                return { ...task, title: value };
              } else if (field === 'time') {
                const time = parseFloat(value) || 0;
                return { ...task, estimatedTime: time };
              } else if (field === 'priority') {
                return { ...task, priority: value as 'low' | 'medium' | 'high' };
              }
            }
            
            return task;
          })
        };
      });
    });
    
    setEditing({ taskId: null, subtaskId: null, field: null, value: '' });
  }, [editing, boards]);

  const updateTaskPriority = useCallback((taskId: string, boardId: string, priority: 'low' | 'medium' | 'high') => {
    setHistory(prev => [...prev, boards]);
    
    setBoards(prevBoards => {
      return prevBoards.map(board => {
        if (board.id !== boardId) return board;
        
        return {
          ...board,
          tasks: board.tasks.map(task => {
            // Check if this is a main task
            if (task.id === taskId) {
              return { ...task, priority };
            }
            
            // Check if this is a subtask
            const updatedSubtasks = task.subtasks.map(subtask => {
              if (subtask.id === taskId) {
                return { ...subtask, priority };
              }
              return subtask;
            });
            
            if (task.subtasks.some(st => st.id === taskId)) {
              return { ...task, subtasks: updatedSubtasks };
            }
            
            return task;
          })
        };
      });
    });
  }, [boards]);
  
  const addSubtask = useCallback((taskId: string, boardId: string) => {
    setHistory(prev => [...prev, boards]);
    
    setBoards(prevBoards => {
      return prevBoards.map(board => {
        if (board.id !== boardId) return board;
        
        return {
          ...board,
          tasks: board.tasks.map(task => {
            if (task.id !== taskId) return task;
            
            return {
              ...task,
              expanded: true,
              subtasks: [
                ...task.subtasks,
                {
                  id: `subtask-${Date.now()}-${task.subtasks.length}`,
                  title: 'New subtask',
                  subtasks: [],
                  completed: false,
                  priority: task.priority,
                  estimatedTime: 0.5,
                  boardId
                }
              ]
            };
          })
        };
      });
    });
  }, [boards]);
  
  const updateBoardTitle = useCallback((boardId: string, newTitle: string) => {
    setHistory(prev => [...prev, boards]);
    
    setBoards(prevBoards => {
      return prevBoards.map(board => {
        if (board.id !== boardId) return board;
        return { ...board, title: newTitle };
      });
    });
  }, [boards]);
  
  const toggleExpanded = useCallback((taskId: string) => {
    setBoards(prevBoards => {
      return prevBoards.map(board => {
        return {
          ...board,
          tasks: board.tasks.map(task => {
            if (task.id !== taskId) return task;
            return { ...task, expanded: !task.expanded };
          })
        };
      });
    });
  }, []);
  
  const toggleComplete = useCallback((taskId: string, boardId: string) => {
    setHistory(prev => [...prev, boards]);
    
    setBoards(prevBoards => {
      return prevBoards.map(board => {
        if (board.id !== boardId) return board;
        
        return {
          ...board,
          tasks: board.tasks.map(task => {
            // If this is the main task
            if (task.id === taskId) {
              const newCompleted = !task.completed;
              
              // If completing the main task, complete all subtasks too
              if (newCompleted) {
                return {
                  ...task,
                  completed: newCompleted,
                  subtasks: task.subtasks.map(st => ({ ...st, completed: true }))
                };
              }
              
              return { ...task, completed: newCompleted };
            }
            
            // Check if this is a subtask
            const updatedSubtasks = task.subtasks.map(subtask => {
              if (subtask.id === taskId) {
                return { ...subtask, completed: !subtask.completed };
              }
              return subtask;
            });
            
            // Check if all subtasks are complete
            const allSubtasksComplete = updatedSubtasks.length > 0 && 
              updatedSubtasks.every(st => st.completed);
            
            return {
              ...task,
              subtasks: updatedSubtasks,
              completed: allSubtasksComplete
            };
          })
        };
      });
    });
  }, [boards]);

  const showFeedback = useCallback((taskId: string) => {
    setFeedback({ taskId, showing: true });
  }, []);
  
  const submitFeedback = useCallback((taskId: string, rating: number) => {
    setHistory(prev => [...prev, boards]);
    
    setBoards(prevBoards => {
      return prevBoards.map(board => {
        return {
          ...board,
          tasks: board.tasks.map(task => {
            if (task.id === taskId || task.subtasks.some(st => st.id === taskId)) {
              return {
                ...task,
                feedback: rating,
                subtasks: task.subtasks.map(st => {
                  if (st.id === taskId) {
                    return { ...st, feedback: rating };
                  }
                  return st;
                })
              };
            }
            return task;
          })
        };
      });
    });
    
    setFeedback({ taskId: '', showing: false });
  }, [boards]);
  
  const updateContext = useCallback((taskId: string) => {
    if (!contextInput.trim()) {
      setShowContextInput(null);
      setContextInput('');
      return;
    }
    
    setHistory(prev => [...prev, boards]);
    
    setBoards(prevBoards => {
      return prevBoards.map(board => {
        return {
          ...board,
          tasks: board.tasks.map(task => {
            if (task.id === taskId) {
              return { ...task, context: contextInput };
            }
            return task;
          })
        };
      });
    });
    
    setShowContextInput(null);
    setContextInput('');
  }, [contextInput, boards]);
  
  const deleteTask = useCallback((taskId: string, boardId: string) => {
    setHistory(prev => [...prev, boards]);
    
    setBoards(prevBoards => {
      return prevBoards.map(board => {
        if (board.id !== boardId) return board;
        
        // First check if it's a main task
        const updatedTasks = board.tasks.filter(task => task.id !== taskId);
        
        if (updatedTasks.length < board.tasks.length) {
          return { ...board, tasks: updatedTasks };
        }
        
        // If it's not a main task, check subtasks
        return {
          ...board,
          tasks: board.tasks.map(task => {
            return {
              ...task,
              subtasks: task.subtasks.filter(st => st.id !== taskId)
            };
          })
        };
      });
    });
  }, [boards]);
  
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    
    const previousState = history[history.length - 1];
    setBoards(previousState);
    setHistory(prev => prev.slice(0, -1));
  }, [history]);

  const startVoiceInput = async () => {
    if (!audioAvailable) {
      alert('Microphone access is not available');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        
        // Create form data to send to API
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');
        
        try {
          setNewTask('Processing audio...');
          
          // Send to Whisper API
          const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIKey}`
            },
            body: formData
          });
          
          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }

          const data = await response.json();
          
          if (data.text) {
            setNewTask(data.text);
            // Auto submit after a short delay
            setTimeout(() => {
              if (data.text.trim()) {
                const formEvent = new Event('submit', { bubbles: true, cancelable: true }) as unknown as React.FormEvent;
                handleAddTask(formEvent);
              }
            }, 1000);
          }
        } catch (error) {
          console.error('Error processing audio:', error);
          setNewTask(error instanceof Error ? error.message : 'Error processing audio. Please try again.');
        }
        
        setIsListening(false);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsListening(true);
      setNewTask('Recording... Click mic to stop');
      
      // Automatically stop after 10 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopVoiceInput();
        }
      }, 10000);
      
    } catch (error) {
      console.error('Error starting audio recording:', error);
      setNewTask('Error accessing microphone. Please check permissions.');
      setIsListening(false);
    }
  };
  
  const stopVoiceInput = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };
  
  const regenerateTask = async (taskId: string) => {
    if (!openAIKey) {
      alert('Please enter your OpenAI API key first.');
      return;
    }
    
    const task = boards.flatMap(b => b.tasks).find(t => t.id === taskId);
    if (!task) return;
    
    setActiveTask(taskId);
    setGenerating(true);
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAIKey}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content: 'You are a task management AI assistant. Rewrite this task to make it clearer and more actionable.'
            },
            {
              role: 'user',
              content: `Rewrite this task to make it more clear and actionable: "${task.title}"`
            }
          ]
        })
      });
      
      const data = await response.json();
      
      if (data.choices && data.choices[0]) {
        const improvedTask = data.choices[0].message.content.trim();
        
        setHistory(prev => [...prev, boards]);
        
        setBoards(prevBoards => {
          return prevBoards.map(board => {
            return {
              ...board,
              tasks: board.tasks.map(t => {
                if (t.id === taskId) {
                  return {
                    ...t,
                    title: improvedTask,
                    regenerateCount: (t.regenerateCount || 0) + 1
                  };
                }
                return t;
              })
            };
          });
        });
        
        setTotalCost(prev => prev + (data.usage?.total_tokens || 0) * 0.000002);
        setExecutionCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error regenerating task:', error);
    } finally {
      setGenerating(false);
      setActiveTask(null);
    }
  };
  
  const handleGenerateSubtasks = async (taskId: string) => {
    if (!openAIKey) {
      alert('Please enter your OpenAI API key first.');
      return;
    }
    
    const task = boards.flatMap(b => b.tasks).find(t => t.id === taskId);
    if (!task) return;
    
    setActiveTask(taskId);
    setGenerating(true);
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAIKey}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content: `You are a task management AI assistant. Break down tasks into specific, actionable subtasks. Provide ${breakdownLevel} subtasks. Return ONLY a JSON array of subtasks in the format [{"title": "Subtask title", "estimatedTime": 0.5, "priority": "low|medium|high"}].`
            },
            {
              role: 'user',
              content: `Break down this task into ${breakdownLevel} specific, actionable subtasks: "${task.title}"${task.context ? `\nContext: ${task.context}` : ''}`
            }
          ]
        })
      });
      
      const data = await response.json();
      
      if (data.choices && data.choices[0]) {
        let subtasksContent = data.choices[0].message.content.trim();
        
        // Extract the JSON array if it's wrapped in backticks
        if (subtasksContent.includes('```')) {
          subtasksContent = subtasksContent.replace(/```json|```/g, '').trim();
        }
        
        try {
          const subtasks = JSON.parse(subtasksContent);
          
          if (Array.isArray(subtasks)) {
            setHistory(prev => [...prev, boards]);
            
            setBoards(prevBoards => {
              return prevBoards.map(board => {
                return {
                  ...board,
                  tasks: board.tasks.map(t => {
                    if (t.id === taskId) {
                      return {
                        ...t,
                        expanded: true,
                        subtasks: [
                          ...t.subtasks,
                          ...subtasks.map((st: any, index: number) => ({
                            id: `subtask-${Date.now()}-${index}`,
                            title: st.title,
                            subtasks: [],
                            completed: false,
                            priority: st.priority || 'medium',
                            estimatedTime: st.estimatedTime || 0.5,
                            boardId: t.boardId
                          }))
                        ]
                      };
                    }
                    return t;
                  })
                };
              });
            });
            
            setTotalCost(prev => prev + (data.usage?.total_tokens || 0) * 0.000002);
            setExecutionCount(prev => prev + 1);
          }
        } catch (error) {
          console.error('Error parsing subtasks:', error);
        }
      }
    } catch (error) {
      console.error('Error generating subtasks:', error);
    } finally {
      setGenerating(false);
      setActiveTask(null);
    }
  };
  
  const handleSelectUseCase = useCallback((useCase: string) => {
    setSelectedUseCase(useCase);
    document.documentElement.style.setProperty('--primary-color', `var(--${useCase}-primary)`);
    document.documentElement.style.setProperty('--primary-light', `var(--${useCase}-light)`);
    document.documentElement.style.setProperty('--secondary-light', `var(--${useCase}-secondary)`);
  }, []);
  
  const handleGenerateIdeas = async () => {
    if (!openAIKey) {
      alert('Please enter your OpenAI API key first.');
      return;
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAIKey}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that generates creative task ideas. Return a list of 5 task ideas, one per line, no numbers or bullets.'
            },
            {
              role: 'user',
              content: `Generate 5 task ideas for ${selectedUseCase || 'general productivity'}`
            }
          ]
        })
      });

      const data = await response.json();
      
      if (data.choices && data.choices[0]) {
        const ideas = data.choices[0].message.content
          .split('\n')
          .filter(Boolean)
          .map((idea: string) => idea.replace(/^\d+\.\s*|-\s*|\*\s*/, '').trim());
        
        setHistory(prev => [...prev, boards]);
        
        setBoards(prevBoards => {
          const todoBoard = prevBoards.find(board => board.id === 'todo');
          if (!todoBoard) return prevBoards;

          return prevBoards.map(board => 
            board.id === 'todo' 
              ? { 
                  ...board, 
                  tasks: [
                    ...board.tasks, 
                    ...ideas.map((idea: string, index: number) => ({
                      id: `task-${Date.now()}-${index}`,
                      title: idea,
                      subtasks: [],
                      completed: false,
                      priority: 'medium',
                      estimatedTime: 1,
                      expanded: false,
                      boardId: 'todo'
                    }))
                  ] 
                }
              : board
          );
        });

        setTotalCost(prev => prev + (data.usage?.total_tokens || 0) * 0.000002);
        setExecutionCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error generating ideas:', error);
    }
  };
  
  const getFilteredTasks = useCallback((boardId: string) => {
    const board = boards.find(b => b.id === boardId);
    if (!board) return [];
    
    let filteredTasks = filterTasksByPriority(board.tasks, filterPriority);
    
    if (filterRating > 0) {
      filteredTasks = filterTasksByRating(filteredTasks, filterRating);
    }
    
    return filteredTasks;
  }, [boards, filterPriority, filterRating]);

  return {
    openAIKey,
    setOpenAIKey,
    selectedModel,
    setSelectedModel,
    totalCost,
    executionCount,
    boards,
    setBoards,
    newTask,
    setNewTask,
    editingBoardId,
    setEditingBoardId,
    activeTask,
    feedback,
    setFeedback,
    generating,
    showContextInput,
    setShowContextInput,
    contextInput,
    setContextInput,
    isListening,
    breakdownLevel,
    setBreakdownLevel,
    filterPriority,
    setFilterPriority,
    filterRating,
    setFilterRating,
    activeId,
    setActiveId,
    isDraggingOver,
    setIsDraggingOver,
    editing,
    taskMismatch,
    setTaskMismatch,
    handleAddTask,
    startEditing,
    handleEditSave,
    updateTaskPriority,
    addSubtask,
    updateBoardTitle,
    toggleExpanded,
    startVoiceInput,
    stopVoiceInput,
    handleUndo,
    regenerateTask,
    handleGenerateSubtasks,
    handleSelectUseCase,
    selectedUseCase,
    handleGenerateIdeas,
    toggleComplete,
    showFeedback,
    submitFeedback,
    updateContext,
    deleteTask,
    getFilteredTasks
  };
}