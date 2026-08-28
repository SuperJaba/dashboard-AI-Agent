import { useState, useEffect } from 'react';
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
  const [activeView, setActiveView] = useState<'dashboard' | 'agents' | 'opsramp'>('dashboard');
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | string | null>(null);
  const [servers, setServers] = useState<ServerData[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [showAddServer, setShowAddServer] = useState(false);
  const [newServer, setNewServer] = useState({ name: '', host: '', username: '', port: 22, use_devil: false, ssh_password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [remotePrompt, setRemotePrompt] = useState('');
  const [isWorkspacesExpanded, setIsWorkspacesExpanded] = useState(true);
  const [isRemoteExpanded, setIsRemoteExpanded] = useState(true);
  const [showTasks, setShowTasks] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [useBrowserTerminal, setUseBrowserTerminal] = useState(false);
  const [terminalConfig, setTerminalConfig] = useState<any>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [customLlmUrl, setCustomLlmUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customLlmName, setCustomLlmName] = useState('AtomicChat');
  const [customLlmModel, setCustomLlmModel] = useState('AtomicChat/qwen35-4b-Q8_0');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    apiClient.get<unknown>('/api/projects')
      .then(rawData => {
        const data = z.array(ProjectSchema).parse(rawData);
        if (data.length) {
          setProjects(data);
          setActiveProjectId(data[0].id);
        }
      })
      .catch(console.error);

    apiClient.get<unknown>('/api/servers')
      .then(rawData => {
        const data = z.array(ServerSchema).parse(rawData);
        if (data.length) setServers(data);
      })
      .catch(console.error);

    apiClient.get<any[]>('/api/agents')
      .then(data => {
        if (Array.isArray(data)) setAgents(data);
      })
      .catch(console.error);

    apiClient.get<unknown>('/api/settings')
      .then(rawData => {
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
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    setSelectedTaskIds([]);
  }, [activeProjectId]);

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
        // Merge tasks: keep existing, add new ones from disk
        const currentTasks = activeProject.tasks || [];
        const existingTitles = new Set(currentTasks.map((t: any) => t.title));
        const newTasks = data.tasks.filter((t: any) => !existingTitles.has(t.title));
        
        // Ensure unique IDs
        let maxId = currentTasks.length > 0 ? Math.max(...currentTasks.map((t: any) => t.id)) : 0;
        const tasksToAdd = newTasks.map((t: any) => ({ ...t, id: ++maxId }));
        
        const mergedTasks = [...currentTasks, ...tasksToAdd];
        const updatedComplete = mergedTasks.length ? Math.round((mergedTasks.filter(t => t.status === 'completed').length / mergedTasks.length) * 100) : 0;
        
        await apiClient.put(`/api/projects/${activeProject.id}`, { tech: data.tech, tasks: mergedTasks, complete: updatedComplete, branch: data.branch || null });
        
        setProjects(prevProjects => prevProjects.map(p => 
          p.id === activeProject.id 
            ? { ...p, tech: data.tech, tasks: mergedTasks, complete: updatedComplete, branch: data.branch || null }
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

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !newTaskTitle.trim()) return;
    
    const currentTasks = activeProject.tasks || [];
    let maxId = currentTasks.length > 0 ? Math.max(...currentTasks.map((t: any) => t.id)) : 0;
    const newTask = { id: maxId + 1, title: newTaskTitle.trim(), meta: 'Custom Task', status: 'pending' };
    const mergedTasks = [...currentTasks, newTask];
    const updatedComplete = mergedTasks.length > 0 ? Math.round((mergedTasks.filter(t => t.status === 'completed').length / mergedTasks.length) * 100) : 0;
    
    await apiClient.put(`/api/projects/${activeProject.id}`, { tasks: mergedTasks, complete: updatedComplete });
    
    setProjects(projects.map(p => 
      p.id === activeProject.id ? { ...p, tasks: mergedTasks, complete: updatedComplete } : p
    ));
    setNewTaskTitle('');
  };

  const deleteTask = async (taskId: number) => {
    if (!activeProject) return;
    const mergedTasks = (activeProject.tasks || []).filter((t: any) => t.id !== taskId);
    const updatedComplete = mergedTasks.length > 0 ? Math.round((mergedTasks.filter((t: any) => t.status === 'completed').length / mergedTasks.length) * 100) : 0;
    
    await apiClient.put(`/api/projects/${activeProject.id}`, { tasks: mergedTasks, complete: updatedComplete });
    
    setProjects(projects.map(p => 
      p.id === activeProject.id ? { ...p, tasks: mergedTasks, complete: updatedComplete } : p
    ));
    setSelectedTaskIds(selectedTaskIds.filter(id => id !== taskId));
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

  const handleAddProject = async () => {
    try {
      let folderPath = '';
      try {
        const data = await apiClient.get<any>('/api/pick-folder');
        if (data && data.path) {
          folderPath = data.path;
        }
      } catch (e) {
        // Fallback to manual entry if dialog returns error or non-json
      }

      if (!folderPath) {
        const manualPath = prompt('Wprowadź lub wklej pełną ścieżkę do folderu projektu (np. F:\\AI-Agents\\dashboard):');
        if (!manualPath || !manualPath.trim()) return;
        folderPath = manualPath.trim();
      }
      
      const folderName = folderPath.split('/').pop() || folderPath.split('\\').pop() || `New Project`;
      
      const newProject = await apiClient.post<any>('/api/projects', { name: folderName, desc: 'Local workspace', path: folderPath });
      
      setProjects([...projects, newProject]);
      setActiveProjectId(newProject.id);
      setShowTasks(false);
    } catch (err) {
      console.error('Failed to pick folder:', err);
    }
  };

  const handleCloneProject = async (repoUrl: string, targetDir: string, projectName?: string) => {
    try {
      const name = projectName || targetDir.split('/').pop() || targetDir.split('\\').pop() || 'Cloned Repo';
      const data = await apiClient.post<any>('/api/git/clone', {
        repoUrl,
        targetDir,
        name
      });
      if (data.project) {
        setProjects(prev => [...prev, data.project]);
        setActiveProjectId(data.project.id);
      } else {
        const newProj = await apiClient.post<any>('/api/projects', { name, desc: `Cloned from ${repoUrl}`, path: data.directory || targetDir });
        setProjects(prev => [...prev, newProj]);
        setActiveProjectId(newProj.id);
      }
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
    initGit,
    handleAddServer,
    deleteServer,
    handleAddProject,
    setupSshKey
  };
}
