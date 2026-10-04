import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../shared/api-client';
import { ProjectSchema, ServerSchema, SettingsSchema } from '../shared/api-client/schemas';
import type { ProjectData, ServerData } from '../shared/api-client/schemas';
import { z } from 'zod';

/**
 * Main state management hook for the Dashboard application.
 * Handles the state and data fetching for projects, servers, AI agents,
 * LLM settings, and terminal configurations.
 * 
 * @returns An object containing all the dashboard state variables and modifier functions.
 */
export function useDashboardState() {
  const [activeView, setActiveView] = useState<'dashboard' | 'agents'>('dashboard');
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | string | null>(null);
  const [servers, setServers] = useState<ServerData[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [showAddServer, setShowAddServer] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [newServer, setNewServer] = useState({ name: '', host: '', username: '', port: 22, use_devil: false, ssh_password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [remotePrompt, setRemotePrompt] = useState('');
  const [isWorkspacesExpanded, setIsWorkspacesExpanded] = useState(true);
  const [isRemoteExpanded, setIsRemoteExpanded] = useState(true);
  const [showTasks, setShowTasks] = useState(false);
  const [hideCompleted, setHideCompletedState] = useState(() => {
    try {
      return localStorage.getItem('hideCompleted') === 'true';
    } catch {
      return false;
    }
  });

  const setHideCompleted = (value: boolean | ((prev: boolean) => boolean)) => {
    setHideCompletedState(prev => {
      const nextVal = typeof value === 'function' ? value(prev) : value;
      try {
        localStorage.setItem('hideCompleted', String(nextVal));
      } catch {}
      return nextVal;
    });
  };
  const [useBrowserTerminal, setUseBrowserTerminal] = useState(true);
  const [terminalConfig, setTerminalConfig] = useState<any>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [customLlmUrl, setCustomLlmUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customLlmName, setCustomLlmName] = useState('AtomicChat');
  const [customLlmModel, setCustomLlmModel] = useState('AtomicChat/qwen35-4b-Q8_0');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const projectFolderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;

    apiClient.get<unknown>('/api/projects')
      .then(rawData => {
        if (!isMounted) return;
        const data = z.array(ProjectSchema).parse(rawData);
        if (data.length) {
          setProjects(data);
          setActiveProjectId(data[0].id);
        }
      })
      .catch(console.error);

    apiClient.get<unknown>('/api/servers')
      .then(rawData => {
        if (!isMounted) return;
        const data = z.array(ServerSchema).parse(rawData);
        if (data.length) setServers(data);
      })
      .catch(console.error);

    apiClient.get<any[]>('/api/agents')
      .then(data => {
        if (!isMounted) return;
        if (Array.isArray(data)) setAgents(data);
      })
      .catch(console.error);

    apiClient.get<unknown>('/api/settings')
      .then(rawData => {
        if (!isMounted) return;
        const data = SettingsSchema.parse(rawData);
        if (data.llmUrl) setCustomLlmUrl(data.llmUrl);
        if (data.apiKey) setCustomApiKey(data.apiKey);
        if (data.llmName) setCustomLlmName(data.llmName);
        if (data.llmModel) setCustomLlmModel(data.llmModel);
        
        // Sync terminal preference
        const localPref = localStorage.getItem('useBrowserTerminal');
        if (localPref !== null) {
          setUseBrowserTerminal(localPref === 'true');
        } else if (data.useBrowserTerminal !== undefined) {
          setUseBrowserTerminal(data.useBrowserTerminal === 'true');
        } else {
          setUseBrowserTerminal(true);
        }
      })
      .catch(console.error);

    return () => {
      isMounted = false;
    };
  }, []);

  const [prevActiveProjectId, setPrevActiveProjectId] = useState(activeProjectId);
  if (activeProjectId !== prevActiveProjectId) {
    setPrevActiveProjectId(activeProjectId);
    setSelectedTaskIds([]);
  }

  const activeProject = typeof activeProjectId === 'number' ? projects.find(p => p.id === activeProjectId) || null : null;
  const activeServer = typeof activeProjectId === 'string' && activeProjectId.startsWith('server-') 
    ? servers.find(s => s.id === parseInt(activeProjectId.replace('server-', ''))) || null
    : null;

  const saveSettings = async () => {
    try {
      await apiClient.post('/api/settings', { 
        llmUrl: customLlmUrl, 
        apiKey: customApiKey, 
        llmName: customLlmName,
        llmModel: customLlmModel,
        useBrowserTerminal 
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTerminalToggle = (checked: boolean) => {
    setUseBrowserTerminal(checked);
    localStorage.setItem('useBrowserTerminal', checked.toString());
    apiClient.post('/api/settings', { useBrowserTerminal: checked }).catch(console.error);
  };

  const deployAgent = async (agent: string) => {
    if (!activeProject) return;
    setDeploying(agent);
    try {
      const allTasks = activeProject.tasks || [];
      const selectedTasks = selectedTaskIds.length > 0
        ? allTasks.filter((t: any) => selectedTaskIds.includes(t.id))
        : allTasks.filter((t: any) => t.status !== 'completed');
      
      const tasksToDeploy = selectedTasks.length > 0 ? selectedTasks : allTasks;

      const data = await apiClient.post<any>('/api/deploy', { 
        agent, 
        directory: activeProject.path, 
        llmUrl: customLlmUrl, 
        apiKey: customApiKey,
        tasks: tasksToDeploy,
        useBrowserTerminal
      });
      if (data.browserTerminal) {
        setTerminalConfig({
          command: data.command,
          args: data.args,
          cwd: data.cwd,
          env: data.env
        });
      }
    } catch (err) {
      console.error(err);
    }
    setDeploying(null);
  };

  const deployRemoteAgent = async (agent: string, server: any) => {
    setDeploying(agent);
    try {
      const data = await apiClient.post<any>('/api/deploy', { 
        agent, 
        directory: '', 
        llmUrl: customLlmUrl, 
        apiKey: customApiKey,
        remoteServer: server,
        remotePrompt,
        useBrowserTerminal
      });
      if (data.browserTerminal) {
        setTerminalConfig({
          command: data.command,
          args: data.args,
          cwd: data.cwd,
          env: data.env
        });
      }
    } catch (err) {
      console.error(err);
    }
    setDeploying(null);
  };

  const analyzeProject = async () => {
    if (!activeProject) return;
    setDeploying('analyze');
    try {
      const data = await apiClient.post<any>('/api/analyze', { directory: activeProject.path });
      if (!data.error) {
        // Merge tasks: keep existing, update statuses if completed on disk, add new pending tasks from disk
        const currentTasks = activeProject.tasks || [];
        const currentTitles = new Set(currentTasks.map((t: any) => t.title.trim().toLowerCase()));

        // Update status of existing tasks if completed on disk
        const mergedTasks = currentTasks.map((t: any) => {
          const norm = t.title.trim().toLowerCase();
          const diskMatch = (data.tasks || []).find((dt: any) => dt.title.trim().toLowerCase() === norm);
          if (diskMatch && diskMatch.status === 'completed' && t.status !== 'completed') {
            return { ...t, status: 'completed' };
          }
          return t;
        });

        // Only add brand-new tasks from disk if they are pending (do not flood table with old completed tasks)
        let maxId = currentTasks.length > 0 ? Math.max(...currentTasks.map((t: any) => t.id)) : 0;
        const newPendingTasks = (data.tasks || []).filter((dt: any) => {
          const norm = dt.title.trim().toLowerCase();
          return !currentTitles.has(norm) && dt.status === 'pending';
        });
        const tasksToAdd = newPendingTasks.map((t: any) => ({ ...t, id: ++maxId }));

        const finalTasks = [...mergedTasks, ...tasksToAdd];
        const updatedComplete = finalTasks.length ? Math.round((finalTasks.filter(t => t.status === 'completed').length / finalTasks.length) * 100) : 0;
        
        await apiClient.put(`/api/projects/${activeProject.id}`, { tech: data.tech, tasks: finalTasks, complete: updatedComplete, branch: data.branch || null });
        
        setProjects(prevProjects => prevProjects.map(p => 
          p.id === activeProject.id 
            ? { ...p, tech: data.tech, tasks: finalTasks, complete: updatedComplete, branch: data.branch || null }
            : p
        ));
        setShowTasks(true);
      } else {
        console.error('Analysis error:', data.error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeploying(null);
    }
  };

  const toggleTaskStatus = async (taskId: number) => {
    if (!activeProject) return;
    const currentTasks = activeProject.tasks || [];
    const task = currentTasks.find((t: any) => t.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const updatedTasks = currentTasks.map((t: any) => 
      t.id === taskId ? { ...t, status: newStatus } : t
    );
    const updatedComplete = updatedTasks.length > 0 
      ? Math.round((updatedTasks.filter((t: any) => t.status === 'completed').length / updatedTasks.length) * 100)
      : 0;

    // Optimistic update
    setProjects(prevProjects => prevProjects.map(p => 
      p.id === activeProject.id ? { ...p, tasks: updatedTasks, complete: updatedComplete } : p
    ));

    try {
      const res = await apiClient.patch<any>(`/api/projects/${activeProject.id}/tasks/${taskId}`, {
        status: newStatus
      });
      if (res && res.tasks) {
        setProjects(prevProjects => prevProjects.map(p => 
          p.id === activeProject.id ? { ...p, ...res } : p
        ));
      }
    } catch (err) {
      console.error('Failed to toggle task status:', err);
      // Revert on error
      setProjects(prevProjects => prevProjects.map(p => 
        p.id === activeProject.id ? { ...p, tasks: currentTasks } : p
      ));
    }
  };

  const syncProjectTasks = async () => {
    if (!activeProject) return null;
    setDeploying('sync-tasks');
    try {
      const res = await apiClient.post<any>(`/api/projects/${activeProject.id}/sync-tasks`, {});
      if (res && res.project) {
        setProjects(prevProjects => prevProjects.map(p => 
          p.id === activeProject.id ? { ...p, ...res.project } : p
        ));
      }
      return res;
    } catch (err) {
      console.error('Failed to sync tasks:', err);
      return null;
    } finally {
      setDeploying(null);
    }
  };

  const clearCompletedTasks = async () => {
    if (!activeProject) return;
    const activeTasks = (activeProject.tasks || []).filter((t: any) => t.status !== 'completed');
    const updatedComplete = activeTasks.length > 0 
      ? Math.round((activeTasks.filter((t: any) => t.status === 'completed').length / activeTasks.length) * 100)
      : 0;

    try {
      await apiClient.put(`/api/projects/${activeProject.id}/tasks`, { tasks: activeTasks });
      setProjects(prevProjects => prevProjects.map(p => 
        p.id === activeProject.id ? { ...p, tasks: activeTasks, complete: updatedComplete } : p
      ));
      setSelectedTaskIds(prev => prev.filter(id => activeTasks.some((t: any) => t.id === id)));
    } catch (err) {
      console.error('Failed to clear completed tasks:', err);
    }
  };

  const archiveTasks = async () => {
    if (!activeProject || !activeProject.tasks) return;
    const currentTasks = activeProject.tasks;
    const completedTasks = currentTasks.filter((t: any) => t.status === 'completed');
    if (completedTasks.length === 0) return;

    // Check which completed tasks are currently selected
    const selectedCompletedIds = selectedTaskIds.filter(id =>
      completedTasks.some((t: any) => t.id === id)
    );

    // If some completed tasks are selected, archive ONLY those.
    // Otherwise, archive ALL completed tasks.
    const idsToArchive = selectedCompletedIds.length > 0
      ? selectedCompletedIds
      : completedTasks.map((t: any) => t.id);

    const updatedTasks = currentTasks.map((task: any) => {
      if (idsToArchive.includes(task.id)) {
        return { ...task, status: 'archived', archivedAt: new Date().toISOString() };
      }
      return task;
    });

    const activeTasks = updatedTasks.filter((t: any) => t.status !== 'archived');
    const updatedComplete = activeTasks.length > 0
      ? Math.round((activeTasks.filter((t: any) => t.status === 'completed').length / activeTasks.length) * 100)
      : 0;

    try {
      await apiClient.put(`/api/projects/${activeProject.id}/tasks`, { tasks: updatedTasks, complete: updatedComplete });
      setProjects(prevProjects => prevProjects.map(p =>
        p.id === activeProject.id ? { ...p, tasks: updatedTasks, complete: updatedComplete } : p
      ));
      setSelectedTaskIds(prev => prev.filter(id => !idsToArchive.includes(id)));
    } catch (err) {
      console.error('Failed to archive tasks:', err);
    }
  };

  const restoreTask = async (taskId: number) => {
    if (!activeProject || !activeProject.tasks) return;
    const currentTasks = activeProject.tasks;
    const updatedTasks = currentTasks.map((task: any) => {
      if (task.id === taskId) {
        return { ...task, status: 'completed' };
      }
      return task;
    });

    const activeTasks = updatedTasks.filter((t: any) => t.status !== 'archived');
    const updatedComplete = activeTasks.length > 0
      ? Math.round((activeTasks.filter((t: any) => t.status === 'completed').length / activeTasks.length) * 100)
      : 0;

    try {
      await apiClient.put(`/api/projects/${activeProject.id}/tasks`, { tasks: updatedTasks, complete: updatedComplete });
      setProjects(prevProjects => prevProjects.map(p =>
        p.id === activeProject.id ? { ...p, tasks: updatedTasks, complete: updatedComplete } : p
      ));
    } catch (err) {
      console.error('Failed to restore task:', err);
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !newTaskTitle.trim()) return;
    
    const currentTasks = activeProject.tasks || [];
    let maxId = currentTasks.length > 0 ? Math.max(...currentTasks.map((t: any) => t.id)) : 0;
    const newTask = { id: maxId + 1, title: newTaskTitle.trim(), meta: 'Custom Task', status: 'pending' };
    const mergedTasks = [...currentTasks, newTask];
    const activeTasks = mergedTasks.filter((t: any) => t.status !== 'archived');
    const updatedComplete = activeTasks.length > 0 ? Math.round((activeTasks.filter(t => t.status === 'completed').length / activeTasks.length) * 100) : 0;
    
    await apiClient.put(`/api/projects/${activeProject.id}`, { tasks: mergedTasks, complete: updatedComplete });
    
    setProjects(projects.map(p => 
      p.id === activeProject.id ? { ...p, tasks: mergedTasks, complete: updatedComplete } : p
    ));
    setNewTaskTitle('');
  };

  const deleteTask = async (taskId: number) => {
    if (!activeProject) return;
    const mergedTasks = (activeProject.tasks || []).filter((t: any) => t.id !== taskId);
    const activeTasks = mergedTasks.filter((t: any) => t.status !== 'archived');
    const updatedComplete = activeTasks.length > 0 ? Math.round((activeTasks.filter((t: any) => t.status === 'completed').length / activeTasks.length) * 100) : 0;
    
    await apiClient.put(`/api/projects/${activeProject.id}`, { tasks: mergedTasks, complete: updatedComplete });
    
    setProjects(projects.map(p => 
      p.id === activeProject.id ? { ...p, tasks: mergedTasks, complete: updatedComplete } : p
    ));
    setSelectedTaskIds(selectedTaskIds.filter(id => id !== taskId));
  };

  const markTasksCompleted = async (taskIds?: number[]) => {
    if (!activeProject) return;
    const idsToComplete = taskIds && taskIds.length > 0 ? taskIds : selectedTaskIds;
    if (!idsToComplete || idsToComplete.length === 0) return;

    const mergedTasks = (activeProject.tasks || []).map((t: any) => 
      idsToComplete.includes(t.id) ? { ...t, status: 'completed' } : t
    );
    const updatedComplete = mergedTasks.length > 0 ? Math.round((mergedTasks.filter((t: any) => t.status === 'completed').length / mergedTasks.length) * 100) : 0;

    await apiClient.put(`/api/projects/${activeProject.id}`, { tasks: mergedTasks, complete: updatedComplete });

    setProjects(projects.map(p => 
      p.id === activeProject.id ? { ...p, tasks: mergedTasks, complete: updatedComplete } : p
    ));
    setSelectedTaskIds([]);
  };

  const initGit = async () => {
    if (!activeProject) return;
    try {
      const data = await apiClient.post<any>('/api/init-git', { directory: activeProject.path });
      if (data.success) {
        await apiClient.put(`/api/projects/${activeProject.id}`, { branch: data.branch });
        setProjects(projects.map(p => 
          p.id === activeProject.id ? { ...p, branch: data.branch } : p
        ));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddServer = async () => {
    try {
      const data = await apiClient.post<any>('/api/servers', newServer);
      setServers([...servers, data]);
      setShowAddServer(false);
      setNewServer({ name: '', host: '', username: '', port: 22, use_devil: false, ssh_password: '' });
      setShowPassword(false);
    } catch (e) { console.error(e); }
  };
  
  const deleteServer = async (id: number, e: any) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/api/servers/${id}`);
      setServers(servers.filter(s => s.id !== id));
      if (activeProjectId === `server-${id}`) setActiveProjectId(null);
    } catch (e) { console.error(e); }
  };

  const handleAddProject = async (projectId?: number, action?: 'delete') => {
    if (action === 'delete' && projectId) {
      try {
        await apiClient.delete(`/api/projects/${projectId}`);
        setProjects(projects.filter(p => p.id !== projectId));
        if (activeProjectId === projectId) setActiveProjectId(null);
      } catch (e) { console.error(e); }
      return;
    }
    setShowFolderPicker(true);
  };

  const handleFolderPicked = async (folderPath: string, folderName: string) => {
    try {
      const finalName = folderName || folderPath.split(/[/\\]/).filter(Boolean).pop() || 'New Project';
      const rawProject = await apiClient.post<any>('/api/projects', { name: finalName, desc: 'Local workspace', path: folderPath });
      const safeProject = ProjectSchema.parse(rawProject);

      setProjects(prev => [...prev.filter(p => p.id !== safeProject.id), safeProject]);
      setActiveProjectId(safeProject.id);
      setActiveView('dashboard');
      setShowTasks(false);

      apiClient.get<unknown>('/api/projects')
        .then(rawData => {
          const data = z.array(ProjectSchema).parse(rawData);
          if (data.length) setProjects(data);
        })
        .catch(() => {});
    } catch (err: any) {
      console.error('Failed to add project:', err);
      alert('Nie udało się dodać projektu: ' + (err.message || 'Wystąpił błąd serwera.'));
    }
  };

  const handleProjectFolderSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    // Allow re-selecting the same folder later.
    e.target.value = '';
    if (!files || files.length === 0) return;

    const relativePath = (files[0] as any).webkitRelativePath || files[0].name;
    const folderName = relativePath.split(/[/\\]/)[0] || 'New Project';

    const manualPath = prompt(
      'Wybrano folder: ' + folderName + '\nPotwierdź lub uzupełnij pełną ścieżkę do folderu projektu (np. F:\\AI-Agents\\' + folderName + '):',
      folderName
    );
    if (!manualPath || !manualPath.trim()) return;
    const folderPath = manualPath.trim();

    try {
      const finalName = folderPath.split(/[/\\]/).filter(Boolean).pop() || folderName || 'New Project';
      const rawProject = await apiClient.post<any>('/api/projects', { name: finalName, desc: 'Local workspace', path: folderPath });
      const safeProject = ProjectSchema.parse(rawProject);

      setProjects(prev => [...prev.filter(p => p.id !== safeProject.id), safeProject]);
      setActiveProjectId(safeProject.id);
      setActiveView('dashboard');
      setShowTasks(false);

      apiClient.get<unknown>('/api/projects')
        .then(rawData => {
          const data = z.array(ProjectSchema).parse(rawData);
          if (data.length) setProjects(data);
        })
        .catch(() => {});
    } catch (err: any) {
      console.error('Failed to add project:', err);
      alert('Nie udało się dodać projektu: ' + (err.message || 'Wystąpił błąd serwera.'));
    }
  };

  const handleCloneProject = async (repoUrl: string, targetDir: string, projectName?: string) => {
    try {
      const name = projectName || targetDir.split(/[/\\]/).filter(Boolean).pop() || 'Cloned Repo';
      const data = await apiClient.post<any>('/api/git/clone', {
        repoUrl,
        targetDir,
        name
      });
      const projectPayload = data.project || await apiClient.post<any>('/api/projects', { name, desc: `Cloned from ${repoUrl}`, path: data.directory || targetDir });
      const safeProject = ProjectSchema.parse(projectPayload);
      setProjects(prev => [...prev.filter(p => p.id !== safeProject.id), safeProject]);
      setActiveProjectId(safeProject.id);

      apiClient.get<unknown>('/api/projects')
        .then(rawData => {
          const data = z.array(ProjectSchema).parse(rawData);
          if (data.length) setProjects(data);
        })
        .catch(() => {});
      return data;
    } catch (err: any) {
      console.error('Failed to clone project:', err);
      throw err;
    }
  };

  const setupSshKey = async (serverId: number) => {
    try {
      const data = await apiClient.post<any>(`/api/servers/${serverId}/setup-ssh`);
      if (data.copyCommand) {
        prompt('Skopiuj poniższą komendę i uruchom ją w swoim terminalu, aby dodać klucz SSH do serwera:', data.copyCommand);
      } else {
        console.error('Błąd konfiguracji klucza SSH.');
      }
    } catch (err: any) {
      console.error(`Błąd klucza SSH: ${err.message}`);
    }
  };

  return {
    activeView, setActiveView,
    projects, setProjects,
    activeProjectId, setActiveProjectId,
    servers, setServers,
    handleCloneProject,
    agents, setAgents,
    showAddServer, setShowAddServer,
    newServer, setNewServer,
    showPassword, setShowPassword,
    remotePrompt, setRemotePrompt,
    isWorkspacesExpanded, setIsWorkspacesExpanded,
    isRemoteExpanded, setIsRemoteExpanded,
    showTasks, setShowTasks,
    hideCompleted, setHideCompleted,
    useBrowserTerminal, setUseBrowserTerminal,
    terminalConfig, setTerminalConfig,
    selectedTaskIds, setSelectedTaskIds,
    deploying, setDeploying,
    customLlmUrl, setCustomLlmUrl,
    customApiKey, setCustomApiKey,
    customLlmName, setCustomLlmName,
    customLlmModel, setCustomLlmModel,
    settingsSaved, setSettingsSaved,
    newTaskTitle, setNewTaskTitle,
    activeProject,
    activeServer,
    saveSettings,
    handleTerminalToggle,
    deployAgent,
    deployRemoteAgent,
    analyzeProject,
    addTask,
    deleteTask,
    toggleTaskStatus,
    syncProjectTasks,
    clearCompletedTasks,
    archiveTasks,
    restoreTask,
    markTasksCompleted,
    initGit,
    handleAddServer,
    deleteServer,
    handleAddProject,
    showFolderPicker, setShowFolderPicker,
    handleFolderPicked,
    handleProjectFolderSelected,
    projectFolderInputRef,
    setupSshKey
  };
}
