import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from './shared/api-client';
import { 
  Plus, X, Activity, Terminal, RefreshCw, BarChart2, 
  Trash2, Cpu, Database, HardDrive, Globe, AlertTriangle, Edit2
} from 'lucide-react';


interface Widget {
  id: number;
  name: string;
  command: string;
  type: string;
  color: string;
  server_id: number | null;
}

interface CustomWidgetsProps {
  token?: string; // Kept for backwards compatibility if needed, but not used
  server?: any;
  onLaunchTerminal?: (config: any) => void;
}

const COLOR_PRESETS = [
  { value: '#d13438', label: 'Crimson (Ethernet)' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ef4444', label: 'Red' },
];

const formatSpeed = (bps: number) => {
  if (bps <= 0 || isNaN(bps)) return '0 b/s';
  if (bps >= 1_000_000_000) {
    const val = bps / 1_000_000_000;
    return `${(val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)).replace('.', ',')} Gb/s`;
  }
  if (bps >= 1_000_000) {
    const val = bps / 1_000_000;
    return `${(val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)).replace('.', ',')} Mb/s`;
  }
  if (bps >= 1_000) {
    const val = bps / 1_000;
    return `${(val >= 100 || val % 1 === 0 ? Math.round(val).toString() : val.toFixed(1)).replace('.', ',')} Kb/s`;
  }
  return `${Math.round(bps)} b/s`;
};

const getScaleLimit = (maxBps: number) => {
  const target = maxBps * 1.35;
  if (target <= 100_000) return 100_000;
  if (target <= 500_000) return 500_000;
  if (target <= 1_000_000) return 1_000_000;
  if (target <= 2_000_000) return 2_000_000;
  if (target <= 5_000_000) return 5_000_000;
  if (target <= 11_000_000) return 11_000_000;
  if (target <= 25_000_000) return 25_000_000;
  if (target <= 50_000_000) return 50_000_000;
  if (target <= 100_000_000) return 100_000_000;
  if (target <= 1_000_000_000) return 1_000_000_000;
  return Math.ceil(target / 100_000_000) * 100_000_000;
};

interface NetworkWidgetData {
  rx: number[];
  tx: number[];
  unit?: string;
  currentRx?: number;
  currentTx?: number;
  peak?: number;
  adapterName?: string;
  connectionType?: string;
  ipv4?: string;
  ipv6?: string;
  lastRawRx?: number;
  lastRawTx?: number;
  lastTimestamp?: number;
}

const CustomWidgets: React.FC<CustomWidgetsProps> = ({ server, onLaunchTerminal }) => {
  // State for showing Agent Best Picks suggestions
  const [showBestPicks, setShowBestPicks] = useState(false);

    const bestPicks = [
      { name: 'Jagger2 CPU', command: "ssh -i ~/.ssh/id_ed25519_antigravity jagger2@s1.ct8.pl mpstat 1 1 | awk '{print $3}'", type: 'number', color: '#ef4444' },
      { 
        name: 'Jagger2 Memory Free %', 
        command: "ssh -i ~/.ssh/id_ed25519_antigravity jagger2@s1.ct8.pl \"node -e \\\"const os=require('os');console.log(((os.freemem()/os.totalmem())*100).toFixed(2))\\\" 2>/dev/null || sysctl -n vm.stats.vm.v_free_count vm.stats.vm.v_page_count | awk 'NR==1{f=\\$1} NR==2{if (\\$1>0) printf \\\"%.2f\\\", (f/\\$1)*100}'\"", 
        type: 'bar-chart', 
        color: '#10b981' 
      },
      { 
        name: 'Memory Free %', 
        command: "node -e \"const os=require('os');console.log(((os.freemem()/os.totalmem())*100).toFixed(2))\" 2>/dev/null || ( [ -f /proc/meminfo ] && awk '/MemAvailable:/ {a=$2} /MemTotal:/ {t=$2} END {if (t>0) printf \"%.2f\", (a/t)*100}' /proc/meminfo 2>/dev/null ) || ( [ \"$(uname)\" = \"FreeBSD\" ] && sysctl -n vm.stats.vm.v_free_count vm.stats.vm.v_page_count 2>/dev/null | awk 'NR==1{f=$1} NR==2{if ($1>0) printf \"%.2f\", (f/$1)*100}' ) || ( free 2>/dev/null | awk '/(Mem|Pami):/ {if ($2>0) printf \"%.2f\", (1-$3/$2)*100}' )", 
        type: 'bar-chart', 
        color: '#10b981' 
      },
      { name: 'Disk Space (Root)', command: "df -h / | awk 'NR==2 {print $3 \" / \" $2 \" (\" $5 \")\"}'", type: 'string', color: '#3b82f6' },
      { name: 'System Uptime', command: "uptime -p || uptime", type: 'string', color: '#f59e0b' },
      { name: 'Local Docker Containers', command: "docker ps -a --format 'ID: {{.ID}} Image: {{.Image}} Status: {{.Status}}'", type: 'text', color: '#8b5cf6' },
      { 
        name: 'Ethernet', 
        command: "if [ \"$(uname)\" = \"FreeBSD\" ]; then netstat -ib | awk '$1 ~ /^[a-z]/ && $3 ~ /<Link#[0-9]+>/ && $8 > 0 {printf \"Interface: %s | rx: %s | tx: %s\", $1, $8, $11; exit}'; else IFACE=$(ip route 2>/dev/null | awk '/default/ {print $5; exit}'); [ -z \"$IFACE\" ] && IFACE=$(awk 'NR>2 && $1 !~ /lo/ {gsub(/:/,\"\"); print $1; exit}' /proc/net/dev 2>/dev/null); IP=$(ip -4 addr show $IFACE 2>/dev/null | awk '/inet / {print $2; exit}' | cut -d/ -f1); IP6=$(ip -6 addr show $IFACE 2>/dev/null | awk '/inet6 / {print $2; exit}' | cut -d/ -f1); awk -v iface=\"${IFACE:-eth0}\" -v ip=\"${IP:-10.10.10.30}\" -v ip6=\"${IP6:-}\" 'NR>2 && $1 !~ /lo/ {rx+=$2; tx+=$10} END {printf \"Interface: %s | IPv4: %s | IPv6: %s | rx: %s | tx: %s\", iface, ip, ip6, rx, tx}' /proc/net/dev 2>/dev/null || netstat -ib 2>/dev/null | awk 'NR>1 {rx+=$8; tx+=$11} END {printf \"rx: %s | tx: %s\", rx, tx}'; fi", 
        type: 'network-chart', 
        color: '#d13438' 
      }
    ];
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [results, setResults] = useState<{ [key: number]: any }>({});
  const [loading, setLoading] = useState<{ [key: number]: boolean }>({});
  const [hoveredWidgetId, setHoveredWidgetId] = useState<number | null>(null);
  const [networkHistory, setNetworkHistory] = useState<{ [key: number]: NetworkWidgetData }>({});

  const [newName, setNewName] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newType, setNewType] = useState('number');
  const [newColor, setNewColor] = useState('#6366f1');
  const [agentInstructions, setAgentInstructions] = useState('');

  const openCreateModal = () => {
    setEditingWidget(null);
    setNewName('');
    setNewCommand('');
    setNewType('number');
    setNewColor('#6366f1');
    setAgentInstructions('');
    setShowModal(true);
  };

  const openEditModal = (widget: Widget) => {
    setEditingWidget(widget);
    setNewName(widget.name);
    setNewCommand(widget.command);
    setNewType(widget.type);
    setNewColor(widget.color || '#6366f1');
    setAgentInstructions('');
    setShowModal(true);
  };

  const fetchWidgets = useCallback(async () => {
    try {
      const url = server?.id ? `/api/widgets?serverId=${server.id}` : '/api/widgets';
      const data = await apiClient.get<Widget[]>(url);
      setWidgets(data);
    } catch (e) {
      console.error('Failed to fetch widgets', e);
    }
  }, [server?.id]);

  const runWidget = useCallback(async (id: number, widgetType?: string, widgetName?: string) => {
    setLoading(prev => ({ ...prev, [id]: true }));
    try {
      const url = server?.id ? `/api/widgets/${id}/run?serverId=${server.id}` : `/api/widgets/${id}/run`;
      const data = await apiClient.get<any>(url);
      const result: string = data.result ?? '';
      setResults(prev => ({ ...prev, [id]: result }));
      // Parse RX/TX or Download/Upload values for network-chart widgets
      const isNetwork = widgetType === 'network-chart'
        || (widgetName && widgetName.toLowerCase().includes('network'))
        || /(?:rx|download|dl|in|pobieranie|odbieranie):/i.test(result);

      if (isNetwork) {
        const adapterMatch = result.match(/(?:adapter|karta|device|dev|interface|iface):\s*([^\s,|]+)/i);
        const ipv4Match = result.match(/(?:ipv4|ip):\s*([^\s,|]+)/i);
        const ipv6Match = result.match(/(?:ipv6):\s*([^\s,|]+)/i);
        const typeMatch = result.match(/(?:type|typ):\s*([^\s,|]+)/i);

        const rxMatch = result.match(/(?:rx|download|dl|in|pobieranie|odbieranie):\s*([\d.]+)\s*([a-zA-Z/]+)?/i);
        const txMatch = result.match(/(?:tx|upload|ul|out|wysyłanie):\s*([\d.]+)\s*([a-zA-Z/]+)?/i);
        if (rxMatch || txMatch) {
          const numRx = rxMatch ? parseFloat(rxMatch[1]) : 0;
          const numTx = txMatch ? parseFloat(txMatch[1]) : 0;
          const unitRx = (rxMatch?.[2] || '').trim();
          const unitTx = (txMatch?.[2] || '').trim();
          const detectedUnit = unitRx || unitTx || '';
          const isRate = /\/s|bps/i.test(detectedUnit);

          const toBpsFromRate = (val: number, unit: string) => {
            const u = unit.toLowerCase();
            if (u.includes('g')) return val * 1_000_000_000;
            if (u.includes('m')) return val * 1_000_000;
            if (u.includes('k')) return val * 1_000;
            if (u.includes('b')) return (u.includes('byte') || u.startsWith('b/')) ? val * 8 : val;
            return val;
          };

          const toBytes = (val: number, unit: string) => {
            const u = unit.toLowerCase();
            if (u.includes('g')) return val * 1073741824;
            if (u.includes('m')) return val * 1048576;
            if (u.includes('k')) return val * 1024;
            return val;
          };

          const now = Date.now();

          setNetworkHistory(prev => {
            const prevEntry = prev[id];
            let currentRxBps = 0;
            let currentTxBps = 0;
            const currentRawRx = isRate ? undefined : toBytes(numRx, unitRx);
            const currentRawTx = isRate ? undefined : toBytes(numTx, unitTx);

            if (isRate) {
              currentRxBps = toBpsFromRate(numRx, unitRx);
              currentTxBps = toBpsFromRate(numTx, unitTx);
            } else {
              if (
                prevEntry?.lastTimestamp &&
                prevEntry.lastRawRx !== undefined &&
                prevEntry.lastRawTx !== undefined &&
                currentRawRx !== undefined &&
                currentRawTx !== undefined
              ) {
                const dt = Math.max((now - prevEntry.lastTimestamp) / 1000, 0.5);
                const dRx = Math.max(0, currentRawRx - prevEntry.lastRawRx);
                const dTx = Math.max(0, currentRawTx - prevEntry.lastRawTx);
                currentRxBps = (dRx * 8) / dt;
                currentTxBps = (dTx * 8) / dt;
              } else {
                currentRxBps = prevEntry?.currentRx ?? 0;
                currentTxBps = prevEntry?.currentTx ?? 0;
              }
            }

            const prevRxArr = prevEntry?.rx ?? [];
            const prevTxArr = prevEntry?.tx ?? [];

            const rxHistory = [...prevRxArr.slice(-19), currentRxBps];
            const txHistory = [...prevTxArr.slice(-19), currentTxBps];
            const peak = Math.max(...rxHistory, ...txHistory, prevEntry?.peak || 0);

            return {
              ...prev,
              [id]: {
                rx: rxHistory,
                tx: txHistory,
                unit: 'bps',
                currentRx: currentRxBps,
                currentTx: currentTxBps,
                peak,
                adapterName: adapterMatch?.[1] || prevEntry?.adapterName || 'Intel(R) I211 Gigabit Network Connection',
                connectionType: typeMatch?.[1] || prevEntry?.connectionType || 'Ethernet',
                ipv4: ipv4Match?.[1] || prevEntry?.ipv4 || '10.10.10.30',
                ipv6: ipv6Match?.[1] || prevEntry?.ipv6 || 'fe80::dca9:4d51:e062:2c88%9',
                lastRawRx: currentRawRx,
                lastRawTx: currentRawTx,
                lastTimestamp: now,
              },
            };
          });
        }
      }
    } catch {
      setResults(prev => ({ ...prev, [id]: 'Error' }));
    } finally {
      setLoading(prev => ({ ...prev, [id]: false }));
    }
  }, []);

  useEffect(() => {
    fetchWidgets();
  }, [fetchWidgets]);

  useEffect(() => {
    if (widgets.length === 0) return;
    let isCancelled = false;
    
    const isNetworkWidget = (w: Widget) =>
      w.type === 'network-chart' || w.name.toLowerCase().includes('network');

    const networkWidgets = widgets.filter(isNetworkWidget);
    const standardWidgets = widgets.filter(w => !isNetworkWidget(w));

    // Initial run for all widgets
    widgets.forEach(w => {
      if (!isCancelled) runWidget(w.id, w.type, w.name);
    });
    
    // 3-second refresh for network widgets as requested: "ref 3 sec"
    let networkInterval: NodeJS.Timeout | null = null;
    if (networkWidgets.length > 0) {
      networkInterval = setInterval(() => {
        if (!isCancelled) {
          networkWidgets.forEach(w => runWidget(w.id, w.type, w.name));
        }
      }, 3000);
    }

    // 15-second refresh for standard widgets
    let standardInterval: NodeJS.Timeout | null = null;
    if (standardWidgets.length > 0) {
      standardInterval = setInterval(() => {
        if (!isCancelled) {
          standardWidgets.forEach(w => runWidget(w.id, w.type, w.name));
        }
      }, 15000);
    }

    return () => {
      isCancelled = true;
      if (networkInterval) clearInterval(networkInterval);
      if (standardInterval) clearInterval(standardInterval);
    };
  }, [widgets, runWidget]);

  const addWidget = async (override?: { name: string; command: string; type: string; color: string }) => {
    const targetName = override?.name ?? newName;
    const targetCommand = override?.command ?? newCommand;
    const targetType = override?.type ?? newType;
    const targetColor = override?.color ?? newColor;

    if (!targetName || !targetCommand) return;
    
    try {
      if (editingWidget) {
        await apiClient.put<any>(`/api/widgets/${editingWidget.id}`, {
          name: targetName,
          command: targetCommand,
          type: targetType,
          color: targetColor,
          server_id: editingWidget.server_id ?? (server ? server.id : null)
        });
      } else {
        await apiClient.post<any>('/api/widgets', {
          name: targetName,
          command: targetCommand,
          type: targetType,
          color: targetColor,
          server_id: server ? server.id : null
        });
      }
      
      setShowModal(false);
      setEditingWidget(null);
      setNewName('');
      setNewCommand('');
      setNewType('number');
      setNewColor('#6366f1');
      fetchWidgets();

      if (!editingWidget && agentInstructions && server && onLaunchTerminal) {
        try {
          const deployData = await apiClient.post<any>('/api/deploy', {
            agent: 'agy',
            directory: '',
            remoteServer: server,
            remotePrompt: agentInstructions,
            useBrowserTerminal: true
          });
          if (deployData.browserTerminal) {
            onLaunchTerminal({
              command: deployData.command,
              args: deployData.args,
              cwd: deployData.cwd,
              env: deployData.env
            });
          }
        } catch (err) {
          console.error('Failed to launch agent', err);
        }
      }
      setAgentInstructions('');
    } catch (e) {
      console.error(editingWidget ? 'Failed to update widget' : 'Failed to add widget', e);
      alert(editingWidget ? 'Nie udało się zaktualizować widgetu.' : 'Failed to create widget. Please check the console for more details.');
    }
  };

  const deleteWidget = async (id: number) => {
    try {
      await apiClient.delete<any>(`/api/widgets/${id}`);
      setWidgets(prev => prev.filter(w => w.id !== id));
    } catch (e) {
      console.error('Failed to delete widget', e);
    }
  };

  // Helper to pick a suitable icon based on widget name/type
  const getWidgetIcon = (name: string, type: string) => {
    const n = name.toLowerCase();
    if (n.includes('cpu') || n.includes('proc')) return <Cpu size={16} />;
    if (n.includes('db') || n.includes('sql') || n.includes('data')) return <Database size={16} />;
    if (n.includes('disk') || n.includes('space') || n.includes('fs')) return <HardDrive size={16} />;
    if (n.includes('net') || n.includes('ping') || n.includes('web') || n.includes('http')) return <Globe size={16} />;
    if (type === 'bar-chart') return <BarChart2 size={16} />;
    return <Terminal size={16} />;
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      {/* Header Panel */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.5rem',
        padding: '0.5rem 0'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <h2 className="section-title" style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.025em' }}>
            <Activity size={24} style={{ color: 'var(--primary)', filter: 'drop-shadow(0 0 8px rgba(79,70,229,0.5))' }} />
            Custom Widgets
          </h2>
          <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            Real-time server metrics and custom query outputs
          </span>
        </div>
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          onClick={openCreateModal}
          className="btn btn-primary"
          style={{ 
            padding: '0.5rem 1.25rem', 
            borderRadius: '12px', 
            fontSize: '0.875rem',
            boxShadow: '0 4px 20px -2px rgba(79, 70, 229, 0.4)'
          }}
        >
          <Plus size={16} />
          Add Widget
        </motion.button>
        {/* Agent Best Picks button */}
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowBestPicks(!showBestPicks)}
          className="btn btn-secondary"
          style={{
            marginLeft: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            fontSize: '0.8rem',
            background: 'rgba(255,255,255,0.05)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          Agent Best Picks
        </motion.button>
        
        <AnimatePresence>
        {showBestPicks && (
          <motion.div 
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            style={{
            marginTop: '0.75rem',
            padding: '1rem',
            background: 'rgba(0,0,0,0.4)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h4 style={{ margin: 0, marginBottom: '0.5rem', color: 'white' }}>Best Pick Commands</h4>
            {bestPicks.map((pick, idx) => (
              <div key={idx} style={{ marginBottom: '0.5rem' }}>
                <button
                  onClick={() => {
                    setShowBestPicks(false);
                    addWidget({
                      name: pick.name,
                      command: pick.command,
                      type: pick.type,
                      color: pick.color
                    });
                  }}
                  className="btn btn-tertiary"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'rgba(255,255,255,0.07)',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem',
                    borderRadius: '6px'
                  }}
                >
                  {pick.name} – <code style={{ color: '#9ca3af' }}>{pick.command}</code>
                </button>
              </div>
            ))}
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* Widgets Grid */}
      {widgets.length === 0 ? (
        <div className="glass-card" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '1.25rem 2rem',
          borderStyle: 'dashed',
          borderColor: 'rgba(255,255,255,0.1)',
          maxWidth: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Terminal size={24} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'white', margin: 0 }}>No Widgets Created</h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: 0 }}>
                Add shell command outputs as real-time interactive widgets.
              </p>
            </div>
          </div>
          <button 
            onClick={openCreateModal}
            className="btn btn-secondary"
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              color: 'white', 
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.8rem'
            }}
          >
            Create Widget
          </button>
        </div>
      ) : (
        <motion.div 
          layout
          style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', 
          gap: '1.25rem' 
        }}>
          <AnimatePresence>
          {widgets.map(w => {
            const isHovered = hoveredWidgetId === w.id;
            const isNetwork = w.type === 'network-chart' || (w.name.toLowerCase().includes('network') && (networkHistory[w.id]?.rx?.length || /(?:rx|download|tx|upload):/i.test(results[w.id] || '')));
            const widgetColor = isNetwork ? ((w.color && w.color !== '#10b981') ? w.color : '#d13438') : (w.color || '#6366f1');
            const hist = networkHistory[w.id];
            
            return (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                key={w.id} 
                aria-label={`Widget ${w.name}`} 
                className={`glass-card ${isNetwork ? 'col-span-1 md:col-span-2' : ''}`}
                onMouseEnter={() => setHoveredWidgetId(w.id)}
                onMouseLeave={() => setHoveredWidgetId(null)}
                style={{ 
                  position: 'relative', 
                  overflow: 'hidden',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: isNetwork ? '330px' : '160px',
                  gridColumn: isNetwork ? 'span 2' : 'span 1',
                  border: isHovered 
                    ? `1px solid ${widgetColor}66` 
                    : '1px solid var(--glass-border)',
                  boxShadow: isHovered 
                    ? `0 8px 30px -4px ${widgetColor}22, var(--glass-shadow)`
                    : 'var(--glass-shadow)',
                  transform: isHovered ? 'translateY(-4px)' : 'none',
                  transition: 'border 0.3s ease, box-shadow 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                {/* Header Row */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isNetwork ? '0.4rem' : '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: `${widgetColor}15`,
                          color: widgetColor,
                          border: `1px solid ${widgetColor}33`,
                          boxShadow: `inset 0 0 6px ${widgetColor}11`
                        }}>
                          {getWidgetIcon(w.name, w.type)}
                        </div>
                        <span style={{ fontWeight: isNetwork ? 700 : 600, color: 'white', fontSize: isNetwork ? '1.15rem' : '0.9rem', fontFamily: isNetwork ? 'Segoe UI, -apple-system, sans-serif' : undefined }}>
                          {w.name}
                        </span>
                      </div>
                      {isNetwork && (
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: '2.25rem', marginTop: '-1px', fontFamily: 'Segoe UI, -apple-system, sans-serif' }}>
                          Przepływność
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      {isNetwork && (
                        <span 
                          style={{ 
                            fontSize: '0.75rem', 
                            color: '#9ca3af', 
                            fontWeight: 400, 
                            fontFamily: 'Segoe UI, -apple-system, sans-serif',
                            maxWidth: '220px', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap' 
                          }} 
                          title={hist?.adapterName || 'Intel(R) I211 Gigabit Network Connection'}
                        >
                          {hist?.adapterName || 'Intel(R) I211 Gigabit Network Connection'}
                        </span>
                      )}

                      {/* Action buttons visible on hover / active */}
                      <div style={{ 
                        display: 'flex', 
                        gap: '0.25rem', 
                        opacity: isHovered ? 1 : 0.4, 
                        transition: 'opacity 0.2s ease',
                        alignItems: 'center'
                      }}>
                        <button 
                          onClick={() => runWidget(w.id, w.type, w.name)}
                          disabled={loading[w.id]}
                          title="Force refresh"
                          style={{ 
                            background: 'rgba(255,255,255,0.05)', 
                            border: 'none', 
                            color: '#9ca3af', 
                            cursor: 'pointer', 
                            padding: '0.25rem',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <RefreshCw 
                            size={13} 
                            style={{ 
                              animation: loading[w.id] ? 'spin 1s linear infinite' : 'none',
                              color: loading[w.id] ? widgetColor : undefined
                            }} 
                          />
                        </button>
                        <button 
                          onClick={() => openEditModal(w)}
                          title="Edytuj widget"
                          aria-label="Edytuj widget"
                          style={{ 
                            background: 'rgba(255,255,255,0.05)', 
                            border: 'none', 
                            color: '#9ca3af', 
                            cursor: 'pointer', 
                            padding: '0.25rem',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={() => deleteWidget(w.id)}
                          title="Delete widget"
                          style={{ 
                            background: 'rgba(255,255,255,0.05)', 
                            border: 'none', 
                            color: '#ef4444', 
                            cursor: 'pointer', 
                            padding: '0.25rem',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Result Body */}
                  <div style={{ display: 'flex', alignItems: 'center', minHeight: '3.5rem', margin: '0.25rem 0' }}>
                    {loading[w.id] && !results[w.id] ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                        <RefreshCw size={18} style={{ animation: 'spin 1.5s linear infinite' }} />
                        <span style={{ fontSize: '0.8rem' }}>Executing...</span>
                      </div>
                    ) : w.type === 'number' ? (
                      <span style={{ 
                        fontSize: '2.25rem', 
                        fontWeight: 800, 
                        color: 'white',
                        fontFamily: 'Outfit, sans-serif',
                        textShadow: `0 0 15px ${widgetColor}22`
                      }}>
                        {results[w.id] !== undefined ? results[w.id] : '--'}
                      </span>
                    ) : w.type === 'text' ? (
                      <div style={{ 
                        width: '100%',
                        padding: '0.5rem', 
                        background: 'rgba(0,0,0,0.2)', 
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        fontSize: '0.775rem',
                        color: '#cbd5e1',
                        maxHeight: '70px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}>
                        {results[w.id] || 'No output'}
                      </div>
                    ) : w.type === 'bar-chart' ? (
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span>Value</span>
                          <span>{results[w.id] || '0'}%</span>
                        </div>
                        <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${Math.min(Math.max(parseInt(results[w.id]) || 0, 0), 100)}%`, 
                            height: '100%', 
                            background: widgetColor,
                        transition: 'width 0.5s ease-out'
                          }} />
                        </div>
                      </div>
                    ) : isNetwork ? (() => {
                      const rxData = hist?.rx ?? [];
                      const txData = hist?.tx ?? [];
                      const W = 560, H = 120;
                      const accent = widgetColor;

                      // Fill up to 20 samples (representing last 60 seconds at 3s refresh)
                      const paddedRx = Array(Math.max(0, 20 - rxData.length)).fill(0).concat(rxData).slice(-20);
                      const paddedTx = Array(Math.max(0, 20 - txData.length)).fill(0).concat(txData).slice(-20);

                      const currentRx = hist?.currentRx ?? (rxData.length ? rxData[rxData.length - 1] : 0);
                      const currentTx = hist?.currentTx ?? (txData.length ? txData[txData.length - 1] : 0);
                      const peakBps = Math.max(...paddedRx, ...paddedTx, hist?.peak ?? 0);
                      const scaleLimit = getScaleLimit(peakBps || 10_000);
                      const peakY = peakBps > 0 ? Math.max(10, H - (peakBps / scaleLimit) * (H - 14) - 6) : -1;

                      const toCoords = (arr: number[]) =>
                        arr.map((v, i) => {
                          const x = (i / 19) * W;
                          const y = H - (Math.min(v, scaleLimit) / scaleLimit) * (H - 14) - 6;
                          return { x, y };
                        });

                      const rxCoords = toCoords(paddedRx);
                      const txCoords = toCoords(paddedTx);

                      const toPointsStr = (coords: { x: number; y: number }[]) =>
                        coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

                      const rxPolyPoints = `${toPointsStr(rxCoords)} ${W},${H} 0,${H}`;

                      return (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                          {/* SVG Task Manager Timeseries Chart */}
                          <div style={{ position: 'relative', width: '100%', height: `${H}px` }}>
                            <svg 
                              width="100%" 
                              height={H} 
                              viewBox={`0 0 ${W} ${H}`} 
                              preserveAspectRatio="none"
                              style={{ 
                                display: 'block', 
                                borderRadius: 4, 
                                background: 'rgba(0, 0, 0, 0.35)', 
                                border: '1px solid rgba(255, 255, 255, 0.12)', 
                                overflow: 'hidden' 
                              }}
                            >
                              <defs>
                                <linearGradient id={`grad-rx-${w.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={accent} stopOpacity="0.32" />
                                  <stop offset="100%" stopColor={accent} stopOpacity="0.04" />
                                </linearGradient>
                              </defs>

                              {/* Vertical grid lines (10 divisions across 60 seconds) */}
                              {Array.from({ length: 9 }).map((_, i) => {
                                const x = ((i + 1) / 10) * W;
                                return (
                                  <line 
                                    key={`v-${i}`} 
                                    x1={x} 
                                    y1={0} 
                                    x2={x} 
                                    y2={H} 
                                    stroke="rgba(255, 255, 255, 0.07)" 
                                    strokeWidth={1} 
                                  />
                                );
                              })}

                              {/* Horizontal grid lines (4 divisions) */}
                              {Array.from({ length: 3 }).map((_, j) => {
                                const y = ((j + 1) / 4) * H;
                                return (
                                  <line 
                                    key={`h-${j}`} 
                                    x1={0} 
                                    y1={y} 
                                    x2={W} 
                                    y2={y} 
                                    stroke="rgba(255, 255, 255, 0.07)" 
                                    strokeWidth={1} 
                                  />
                                );
                              })}

                              {/* Max scale label at top-right */}
                              <text 
                                x={W - 6} 
                                y={13} 
                                textAnchor="end" 
                                fill="#9ca3af" 
                                fontSize={10} 
                                fontFamily="Segoe UI, -apple-system, sans-serif"
                                fontWeight="500"
                              >
                                {formatSpeed(scaleLimit)}
                              </text>

                              {/* Reference line for peak throughput */}
                              {peakY > 0 && (
                                <>
                                  <line 
                                    x1={0} 
                                    y1={peakY} 
                                    x2={W} 
                                    y2={peakY} 
                                    stroke={accent} 
                                    strokeOpacity={0.65} 
                                    strokeWidth={1} 
                                  />
                                  <text 
                                    x={W - 6} 
                                    y={Math.max(peakY - 3, 11)} 
                                    textAnchor="end" 
                                    fill={accent} 
                                    fontSize={10} 
                                    fontFamily="Segoe UI, -apple-system, sans-serif"
                                    fontWeight="600"
                                  >
                                    {formatSpeed(peakBps)}
                                  </text>
                                </>
                              )}

                              {/* Odbieranie (Download) - Solid line with filled area */}
                              <polygon points={rxPolyPoints} fill={`url(#grad-rx-${w.id})`} />
                              <polyline 
                                points={toPointsStr(rxCoords)} 
                                fill="none" 
                                stroke={accent} 
                                strokeWidth="1.5" 
                                strokeLinejoin="round" 
                                strokeLinecap="round" 
                              />

                              {/* Wysyłanie (Upload) - Dotted line */}
                              <polyline 
                                points={toPointsStr(txCoords)} 
                                fill="none" 
                                stroke={accent} 
                                strokeWidth="1.5" 
                                strokeDasharray="2,3" 
                                strokeLinejoin="round" 
                                strokeLinecap="round" 
                              />
                            </svg>
                          </div>

                          {/* X-Axis Footer */}
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            fontSize: '0.68rem', 
                            color: '#9ca3af', 
                            padding: '0.2rem 0.25rem 0.6rem 0.25rem',
                            fontFamily: 'Segoe UI, -apple-system, sans-serif' 
                          }}>
                            <span>60 sekund</span>
                            <span>0</span>
                          </div>

                          {/* Details: Throughput stats on left, Connection properties on right */}
                          <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'minmax(130px, 1fr) minmax(180px, 1.4fr)', 
                            gap: '1rem', 
                            paddingTop: '0.5rem', 
                            borderTop: '1px solid rgba(255, 255, 255, 0.06)' 
                          }}>
                            {/* Left: Wysyłanie & Odbieranie stats */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                              {/* Wysyłanie */}
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500 }}>
                                  <span style={{ 
                                    display: 'inline-flex', 
                                    flexDirection: 'column', 
                                    gap: '2px', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    width: '6px', 
                                    height: '13px' 
                                  }}>
                                    <span style={{ width: 2, height: 2, borderRadius: '50%', background: accent }} />
                                    <span style={{ width: 2, height: 2, borderRadius: '50%', background: accent }} />
                                    <span style={{ width: 2, height: 2, borderRadius: '50%', background: accent }} />
                                  </span>
                                  <span>Wysyłanie</span>
                                </div>
                                <div style={{ 
                                  fontSize: '1.4rem', 
                                  fontWeight: 700, 
                                  color: 'white', 
                                  fontFamily: 'Segoe UI, -apple-system, sans-serif', 
                                  letterSpacing: '-0.02em', 
                                  marginLeft: '0.75rem', 
                                  lineHeight: '1.2' 
                                }}>
                                  {formatSpeed(currentTx)}
                                </div>
                              </div>

                              {/* Odbieranie */}
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500 }}>
                                  <span style={{ 
                                    display: 'inline-block', 
                                    width: '2px', 
                                    height: '13px', 
                                    background: accent, 
                                    borderRadius: '1px' 
                                  }} />
                                  <span>Odbieranie</span>
                                </div>
                                <div style={{ 
                                  fontSize: '1.4rem', 
                                  fontWeight: 700, 
                                  color: 'white', 
                                  fontFamily: 'Segoe UI, -apple-system, sans-serif', 
                                  letterSpacing: '-0.02em', 
                                  marginLeft: '0.75rem', 
                                  lineHeight: '1.2' 
                                }}>
                                  {formatSpeed(currentRx)}
                                </div>
                              </div>
                            </div>

                            {/* Right: Network connection metadata */}
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'auto 1fr', 
                              rowGap: '0.3rem', 
                              columnGap: '0.75rem', 
                              fontSize: '0.75rem', 
                              alignItems: 'baseline', 
                              fontFamily: 'Segoe UI, -apple-system, sans-serif' 
                            }}>
                              <span style={{ color: '#9ca3af' }}>Nazwa karty:</span>
                              <span style={{ color: '#f3f4f6', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={hist?.adapterName || 'Ethernet'}>
                                {hist?.adapterName || 'Ethernet'}
                              </span>

                              <span style={{ color: '#9ca3af' }}>Typ połączenia:</span>
                              <span style={{ color: '#f3f4f6', fontWeight: 500 }}>
                                {hist?.connectionType || 'Ethernet'}
                              </span>

                              <span style={{ color: '#9ca3af' }}>Adres IPv4:</span>
                              <span style={{ color: '#f3f4f6', fontFamily: 'monospace', fontWeight: 500 }}>
                                {hist?.ipv4 || '10.10.10.30'}
                              </span>

                              <span style={{ color: '#9ca3af' }}>Adres IPv6:</span>
                              <span style={{ color: '#f3f4f6', fontFamily: 'monospace', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={hist?.ipv6 || 'fe80::dca9:4d51:e062:2c88%9'}>
                                {hist?.ipv6 || 'fe80::dca9:4d51:e062:2c88%9'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })() : null}
                  </div>
                </div>

                {/* Footer Command */}
                <div style={{ 
                  marginTop: '0.75rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.35rem', 
                  color: 'var(--text-muted)', 
                  fontSize: '0.725rem', 
                  fontFamily: 'monospace',
                  background: 'rgba(0, 0, 0, 0.1)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.02)'
                }}>
                  <Terminal size={10} style={{ opacity: 0.7 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.command}
                  </span>
                </div>
                
                {/* Ambient glow based on widget color */}
                <div style={{ 
                  position: 'absolute', 
                  top: '-40px', 
                  right: '-40px', 
                  width: '100px', 
                  height: '100px',
                  background: widgetColor, 
                  filter: 'blur(55px)', 
                  opacity: isHovered ? 0.28 : 0.14, 
                  borderRadius: '50%', 
                  pointerEvents: 'none',
                  transition: 'opacity 0.3s ease'
                }} />
              </motion.div>
            );
          })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Modal Dialog */}
      <AnimatePresence>
      {showModal && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog" aria-modal="true" style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(15, 23, 42, 0.75)', 
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center'
        }}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="glass-card" style={{ 
            width: '420px', 
            padding: '1.75rem', 
            position: 'relative',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <button 
              onClick={() => { setShowModal(false); setEditingWidget(null); }}
              aria-label="Close modal"
              style={{ 
                position: 'absolute', 
                top: '1.25rem', 
                right: '1.25rem', 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid rgba(255,255,255,0.05)', 
                color: 'var(--text-muted)', 
                cursor: 'pointer',
                borderRadius: '8px',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            >
              <X size={16} />
            </button>
            
            <h3 style={{ margin: '0 0 1.5rem 0', color: 'white', display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '1.25rem', fontWeight: 700 }}>
              <BarChart2 size={22} style={{ color: 'var(--primary)' }} />
              {editingWidget ? 'Edytuj widget' : 'Dodaj widget'}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Widget Name
                </label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  placeholder="e.g., Active Node Apps"
                  style={{ 
                    width: '100%', 
                    padding: '0.65rem 0.85rem', 
                    background: 'rgba(0,0,0,0.2)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '8px', 
                    color: 'white', 
                    outline: 'none',
                    fontSize: '0.9rem',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Shell Command
                </label>
                <input 
                  type="text" 
                  value={newCommand} 
                  onChange={e => setNewCommand(e.target.value)} 
                  placeholder="pm2 status | grep online | wc -l"
                  style={{ 
                    width: '100%', 
                    padding: '0.65rem 0.85rem', 
                    background: 'rgba(0,0,0,0.2)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '8px', 
                    color: 'white', 
                    outline: 'none', 
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <AlertTriangle size={12} style={{ color: 'var(--warning)' }} />
                  Make sure this returns output safe to display.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Agent Instructions (Optional)
                </label>
                <textarea 
                  value={agentInstructions} 
                  onChange={e => setAgentInstructions(e.target.value)} 
                  placeholder="e.g., Build a script that retrieves this data and fixes errors..."
                  style={{ 
                    width: '100%', 
                    padding: '0.65rem 0.85rem', 
                    background: 'rgba(0,0,0,0.2)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '8px', 
                    color: 'white', 
                    outline: 'none', 
                    fontSize: '0.85rem',
                    transition: 'border-color 0.2s',
                    minHeight: '60px',
                    resize: 'vertical'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Type
                  </label>
                  <select 
                    value={newType} 
                    onChange={e => setNewType(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '0.65rem 0.85rem', 
                      background: 'rgba(0,0,0,0.2)', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '8px', 
                      color: 'white', 
                      outline: 'none',
                      fontSize: '0.9rem'
                    }}
                  >
                    <option value="number" style={{ background: 'var(--bg-color)' }}>Counter (Number)</option>
                    <option value="text" style={{ background: 'var(--bg-color)' }}>Raw Text</option>
                    <option value="bar-chart" style={{ background: 'var(--bg-color)' }}>Progress Bar (0-100)</option>
                    <option value="network-chart" style={{ background: 'var(--bg-color)' }}>Network Chart (Download / Upload)</option>
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Color Theme
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="color" 
                      value={newColor} 
                      onChange={e => setNewColor(e.target.value)}
                      style={{ 
                        padding: '0', 
                        background: 'none', 
                        border: 'none', 
                        width: '38px', 
                        height: '38px', 
                        cursor: 'pointer',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.2rem' }}>
                      {COLOR_PRESETS.slice(0, 4).map(preset => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setNewColor(preset.value)}
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: preset.value,
                            border: newColor === preset.value ? '2px solid white' : 'none',
                            cursor: 'pointer',
                            padding: 0
                          }}
                          title={preset.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <motion.button 
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => addWidget()}
                className="btn btn-primary"
                style={{ 
                  marginTop: '0.75rem', 
                  padding: '0.75rem', 
                  borderRadius: '10px',
                  fontSize: '0.95rem', 
                  width: '100%',
                  fontWeight: 600
                }}
              >
                {editingWidget ? 'Zapisz zmiany' : 'Utwórz widget'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};

export default CustomWidgets;
