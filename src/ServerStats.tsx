import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import { Activity, Cpu, Server, HardDrive } from 'lucide-react';

export function ServerStats({ serverId }: { serverId?: number }) {
  const [stats, setStats] = useState<any>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const query = serverId ? `?serverId=${serverId}` : '';
        const statsRes = await apiFetch(`/api/system-stats${query}`);
        const statsData = await statsRes.json();
        setStats(statsData);

        const appsRes = await apiFetch(`/api/apps-scan${query}`);
        const appsData = await appsRes.json();
        setApps(appsData.apps || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [serverId]);

  if (loading) return <div className="text-gray-400 p-4">Loading system stats...</div>;
  if (!stats) return <div className="text-red-400 p-4">Failed to load stats.</div>;

  return (
    <div className="flex flex-col gap-6 mb-8">
      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* CPU */}
        <div className="glass-card flex flex-col p-4 animate-in delay-1">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Cpu size={20} />
            <span className="font-semibold text-lg">CPU Usage</span>
          </div>
          <div className="text-gray-300 text-sm mb-1 flex justify-between">
            <span className="truncate" title={stats.cpu.model}>{stats.cpu.model}</span>
            <span className="whitespace-nowrap ml-2 text-gray-400">{stats.cpu.cores} Cores</span>
          </div>
          <div>
            <span className="text-xl font-bold text-white">{stats.cpu.load1.toFixed(2)}</span>
            <span className="text-xs text-gray-500 ml-2 uppercase">Load Avg (1m)</span>
          </div>
        </div>

        {/* RAM */}
        <div className="glass-card flex flex-col p-4 animate-in delay-2">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <Server size={20} />
            <span className="font-semibold text-lg">Memory</span>
          </div>
          <div className="text-gray-300 text-sm mb-1">
            {((stats.memory.used) / 1024 / 1024 / 1024).toFixed(1)} GB / {((stats.memory.total) / 1024 / 1024 / 1024).toFixed(1)} GB
          </div>
          <div className="text-xl font-bold text-white">{stats.memory.usagePercent.toFixed(1)}% Used</div>
        </div>

        {/* System Info */}
        <div className="glass-card flex flex-col p-4 animate-in delay-3">
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <Activity size={20} />
            <span className="font-semibold text-lg">System</span>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">OS Platform</span>
              <span className="text-white">{stats.os.platform}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Release</span>
              <span className="text-white">{stats.os.release}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Uptime</span>
              <span className="text-white">{(stats.os.uptime / 3600).toFixed(1)} hrs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Discovered Apps */}
      <div className="animate-in delay-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <HardDrive size={22} className="text-pink-400" />
            Wykryte Procesy (Node.js)
          </h3>
          <span className="bg-slate-700 text-xs px-2 py-1 rounded text-gray-300">{apps.length} aktywnych</span>
        </div>
        
        {apps.length === 0 ? (
          <div className="glass-card p-6 text-center text-gray-400 italic">
            Brak wykrytych procesów Node.js na tym serwerze.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {apps.map((app, i) => (
              <div key={i} className="glass-card p-4 hover:border-pink-500/30 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 text-white font-medium truncate max-w-[70%]">
                    <span className="text-pink-400 font-mono text-sm">PID: {app.pid}</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-sm truncate" title={app.command}>{app.command.split(' ')[0]}</span>
                  </div>
                  <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded border border-indigo-500/20">
                    user: {app.user}
                  </span>
                </div>
                
                <div className="text-xs text-gray-400 font-mono truncate mb-3" title={app.command}>
                  {app.command}
                </div>
                
                <div className="flex gap-4 text-sm">
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-xs uppercase">CPU</span>
                    <span className="text-gray-200">{app.cpu}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-xs uppercase">RAM</span>
                    <span className="text-gray-200">{app.mem}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
