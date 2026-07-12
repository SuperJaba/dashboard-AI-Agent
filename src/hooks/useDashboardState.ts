import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

export function useDashboardState() {
  const [activeView, setActiveView] = useState<'dashboard' | 'agents'>('dashboard');
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | string | null>(null);
  const [servers, setServers] = useState<any[]>([]);
  const [showAddServer, setShowAddServer] = useState(false);
  const [newServer, setNewServer] = useState({ name: '', host: '', username: '', port: 22, use_devil: false, ssh_password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [remotePrompt, setRemotePrompt] = useState('');
  const [isWorkspacesExpanded, setIsWorkspacesExpanded] = useState(true);
  const [isRemoteExpanded, setIsRemoteExpanded] = useState(true);
  const [showTasks, setShowTasks] = useState(false);
  const [useBrowserTerminal, setUseBrowserTerminal] = useState(false);
  const [terminalConfig, setTerminalConfig] = useState<any>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [customLlmUrl, setCustomLlmUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    apiFetch('http://localhost:3001/api/projects')
      .then(res => res.json())
      .then(data => {
        if (data.length) {
          setProjects(data);
          setActiveProjectId(data[0].id);
        }
      })
      .catch(console.error);

    apiFetch('http://localhost:3001/api/servers')
      .then(res => res.json())
      .then(data => {
        if (data.length) setServers(data);
      })
      .catch(console.error);

    apiFetch('http://localhost:3001/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.llmUrl) setCustomLlmUrl(data.llmUrl);
        if (data.apiKey) setCustomApiKey(data.apiKey);
        
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
      await apiFetch('http://localhost:3001/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llmUrl: customLlmUrl, apiKey: customApiKey, useBrowserTerminal })
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
    apiFetch('http://localhost:3001/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useBrowserTerminal: checked })
    }).catch(console.error);
  };

  const deployAgent = async (agent: string) => {
    if (!activeProject) return;
    setDeploying(agent);
    try {
      const selectedTasks = (activeProject.tasks || []).filter((t: any) => selectedTaskIds.includes(t.id));
      const res = await apiFetch('http://localhost:3001/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          agent, 
          directory: activeProject.path, 
          llmUrl: customLlmUrl, 
          apiKey: customApiKey,
          tasks: selectedTasks,
          useBrowserTerminal
        })
      });
      const data = await res.json();
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
      const res = await apiFetch('http://localhost:3001/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          agent, 
          directory: '', 
          llmUrl: customLlmUrl, 
          apiKey: customApiKey,
          remoteServer: server,
          remotePrompt,
          useBrowserTerminal
        })
      });
      const data = await res.json();
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
      const res = await apiFetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: activeProject.path })
      });
      const data = await res.json();
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
        
        await apiFetch(`http://localhost:3001/api/projects/${activeProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tech: data.tech, tasks: mergedTasks, complete: updatedComplete, branch: data.branch || null })
        });
        
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
    
    await apiFetch(`http://localhost:3001/api/projects/${activeProject.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: mergedTasks, complete: updatedComplete })
    });
    
    setProjects(projects.map(p => 
      p.id === activeProject.id ? { ...p, tasks: mergedTasks, complete: updatedComplete } : p
    ));
    setNewTaskTitle('');
  };

  const deleteTask = async (taskId: number) => {
    if (!activeProject) return;
    const mergedTasks = (activeProject.tasks || []).filter((t: any) => t.id !== taskId);
    const updatedComplete = mergedTasks.length > 0 ? Math.round((mergedTasks.filter((t: any) => t.status === 'completed').length / mergedTasks.length) * 100) : 0;
    
    await apiFetch(`http://localhost:3001/api/projects/${activeProject.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: mergedTasks, complete: updatedComplete })
    });
    
    setProjects(projects.map(p => 
      p.id === activeProject.id ? { ...p, tasks: mergedTasks, complete: updatedComplete } : p
    ));
    setSelectedTaskIds(selectedTaskIds.filter(id => id !== taskId));
  };

  const initGit = async () => {
    if (!activeProject) return;
    try {
      const res = await apiFetch('http://localhost:3001/api/init-git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: activeProject.path })
      });
      const data = await res.json();
      if (data.success) {
        await apiFetch(`http://localhost:3001/api/projects/${activeProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branch: data.branch })
        });
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
      const res = await apiFetch('http://localhost:3001/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newServer)
      });
      const data = await res.json();
      setServers([...servers, data]);
      setShowAddServer(false);
      setNewServer({ name: '', host: '', username: '', port: 22, use_devil: false, ssh_password: '' });
      setShowPassword(false);
    } catch (e) { console.error(e); }
  };
  
  const deleteServer = async (id: number, e: any) => {
    e.stopPropagation();
    try {
      await apiFetch(`http://localhost:3001/api/servers/${id}`, { method: 'DELETE' });
      setServers(servers.filter(s => s.id !== id));
      if (activeProjectId === `server-${id}`) setActiveProjectId(null);
    } catch (e) { console.error(e); }
  };

  const handleAddProject = async () => {
    try {
      const res = await apiFetch('http://localhost:3001/api/pick-folder');
      if (res.status === 204) return;
      
      const data = await res.json();
      if (data.error || !data.path) return;
      
      const path = data.path;
      const folderName = path.split('/').pop() || path.split('\\').pop() || `New Project`;
      
      const createRes = await apiFetch('http://localhost:3001/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderName, desc: 'Local workspace', path })
      });
      const newProject = await createRes.json();
      
      setProjects([...projects, newProject]);
      setActiveProjectId(newProject.id);
      setShowTasks(false);
    } catch (err) {
      console.error('Failed to pick folder:', err);
    }
  };

  const setupSshKey = async (serverId: number) => {
    try {
      const res = await apiFetch(`http://localhost:3001/api/servers/${serverId}/setup-ssh`, { method: 'POST' });
      const data = await res.json();
      if (data.copyCommand) {
        alert(`Skopiuj poniższą komendę i uruchom ją w swoim terminalu, aby dodać klucz SSH do serwera:\n\n${data.copyCommand}`);
      } else {
        alert('Błąd konfiguracji klucza SSH.');
      }
    } catch (err: any) {
      alert(`Błąd: ${err.message}`);
    }
  };

  return {
    activeView, setActiveView,
    projects, setProjects,
    activeProjectId, setActiveProjectId,
    servers, setServers,
    showAddServer, setShowAddServer,
    newServer, setNewServer,
    showPassword, setShowPassword,
    remotePrompt, setRemotePrompt,
    isWorkspacesExpanded, setIsWorkspacesExpanded,
    isRemoteExpanded, setIsRemoteExpanded,
    showTasks, setShowTasks,
    useBrowserTerminal, setUseBrowserTerminal,
    terminalConfig, setTerminalConfig,
    selectedTaskIds, setSelectedTaskIds,
    deploying, setDeploying,
    customLlmUrl, setCustomLlmUrl,
    customApiKey, setCustomApiKey,
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
