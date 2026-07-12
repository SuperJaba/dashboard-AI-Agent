import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import { Activity, Cpu, Server, HardDrive } from 'lucide-react';

export function ServerStats() {
  const [stats, setStats] = useState<any>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await apiFetch('http://localhost:3001/api/system-stats');
        const statsData = await statsRes.json();
        setStats(statsData);

        const appsRes = await apiFetch('http://localhost:3001/api/apps-scan');
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
  }, []);

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
          <div className="text-gray-300 text-sm mb-3 h-8">{stats.cpu.model}</div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-3xl font-bold text-white">{stats.cpu.load1.toFixed(2)}</div>
              <div className="text-xs text-gray-500 uppercase">Load Avg (1m)</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-medium text-gray-300">{stats.cpu.cores}</div>
              <div className="text-xs text-gray-500 uppercase">Cores</div>
            </div>
          </div>
        </div>

        {/* RAM */}
        <div className="glass-card flex flex-col p-4 animate-in delay-2">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <Server size={20} />
            <span className="font-semibold text-lg">Memory</span>
          </div>
          <div className="text-gray-300 text-sm mb-3 h-8">
            {((stats.memory.used) / 1024 / 1024 / 1024).toFixed(1)} GB / {((stats.memory.total) / 1024 / 1024 / 1024).toFixed(1)} GB
          </div>
          <div className="w-full bg-slate-800 rounded-full h-3 mb-2">
            <div 
              className="bg-green-500 h-3 rounded-full transition-all duration-500" 
              style={{ width: `${stats.memory.usagePercent}%` }}
            ></div>
          </div>
          <div className="text-right text-xs text-gray-400">{stats.memory.usagePercent.toFixed(1)}% Used</div>
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
      <div className="glass-card animate-in delay-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <HardDrive size={22} className="text-pink-400" />
            Detected Node.js Processes
          </h3>
          <span className="bg-slate-700 text-xs px-2 py-1 rounded text-gray-300">{apps.length} running</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-gray-500 border-b border-slate-700/50">
              <tr>
                <th className="pb-3 px-2 font-medium">User</th>
                <th className="pb-3 px-2 font-medium">PID</th>
                <th className="pb-3 px-2 font-medium">CPU%</th>
                <th className="pb-3 px-2 font-medium">MEM%</th>
                <th className="pb-3 px-2 font-medium">Command</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {apps.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500 italic">No Node processes detected</td>
                </tr>
              ) : (
                apps.map((app, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-2 text-gray-300">{app.user}</td>
                    <td className="py-3 px-2 text-blue-400 font-mono">{app.pid}</td>
                    <td className="py-3 px-2 text-gray-300">{app.cpu}</td>
                    <td className="py-3 px-2 text-gray-300">{app.mem}</td>
                    <td className="py-3 px-2 text-gray-400 truncate max-w-md font-mono" title={app.command}>
                      {app.command}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
