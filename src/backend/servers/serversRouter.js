import express from 'express';
import os from 'os';
import { exec } from 'child_process';
import * as serversRepo from './serversRepository.js';
import { sshCmd } from '../utils/ssh.js';

export const serversRouter = express.Router();

// Get all servers
serversRouter.get('/servers', async (req, res) => {
  try {
    const servers = await serversRepo.getServers();
    res.json(servers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a server
serversRouter.post('/servers', async (req, res) => {
  const { name, host, username, port, use_devil, ssh_password } = req.body;
  try {
    const row = await serversRepo.createServer({ name, host, username, port, use_devil, ssh_password });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a server
serversRouter.put('/servers/:id', async (req, res) => {
  const { name, host, username, port, use_devil, ssh_password } = req.body;
  try {
    const row = await serversRepo.updateServer(req.params.id, { name, host, username, port, use_devil, ssh_password });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a server
serversRouter.delete('/servers/:id', async (req, res) => {
  try {
    const result = await serversRepo.deleteServer(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// System Stats
serversRouter.get('/system-stats', async (req, res) => {
  try {
    const { serverId } = req.query;

    if (serverId) {
      const s = await serversRepo.getServerById(serverId, true);
      if (s) {
        const nodeScript = `const os = require('os'); const totalMem = os.totalmem(); const freeMem = os.freemem(); console.log(JSON.stringify({ cpu: { cores: os.cpus().length, model: os.cpus()[0]?.model, load1: os.loadavg()[0], load5: os.loadavg()[1], load15: os.loadavg()[2] }, memory: { total: totalMem, free: freeMem, used: totalMem - freeMem, usagePercent: ((totalMem - freeMem) / totalMem) * 100 }, os: { platform: os.platform(), release: os.release(), uptime: os.uptime() } }));`;
        const cmd = sshCmd(s, `"node -e \\"${nodeScript}\\""`);
        
        exec(cmd, (error, stdout) => {
          if (error) {
            return res.status(500).json({ error: 'Failed to fetch remote stats: ' + error.message });
          }
          try {
            const stats = JSON.parse(stdout.trim());
            return res.json(stats);
          } catch (e) {
            return res.status(500).json({ error: 'Failed to parse remote stats' });
          }
        });
        return;
      }
    }

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsagePercent = (usedMem / totalMem) * 100;
    const cpuLoad = os.loadavg();
    
    res.json({
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model,
        load1: cpuLoad[0],
        load5: cpuLoad[1],
        load15: cpuLoad[2]
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercent: memoryUsagePercent
      },
      os: {
        platform: os.platform(),
        release: os.release(),
        uptime: os.uptime()
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// App Scanner API (Find running Node.js/web apps)
// On MyDevil.net (ct8.pl) hosting, Node.js apps run in isolated process jails
// and are NOT visible via `ps aux`. Use `devil www list` instead.
serversRouter.get('/apps-scan', async (req, res) => {
  try {
    const { serverId } = req.query;

    if (serverId) {
      const s = await serversRepo.getServerById(serverId, true);
      if (s) {
        const sshBase = sshCmd(s);

        if (s.use_devil) {
          exec(`${sshBase} "devil www list 2>/dev/null"`, (err, out) => {
            const apps = (!err && out)
              ? out.trim().split('\n')
                  .filter(line => /nodejs|python|ruby/.test(line))
                  .map(line => {
                    const parts = line.trim().split(/\s+/);
                    return {
                      user: s.username,
                      pid: '-', cpu: '-', mem: '-',
                      command: `${parts[1] || 'nodejs'}: ${parts[0] || ''}`,
                      domain: parts[0] || '',
                      type:   parts[1] || 'nodejs',
                      dir:    parts.slice(2).join(' ') || '',
                      source: 'devil'
                    };
                  })
              : [];
            res.json({ apps });
          });
        } else {
          exec(`${sshBase} "ps aux | grep node | grep -v grep"`, (err, out) => {
            const apps = (!err && out)
              ? out.trim().split('\n').filter(Boolean).map(line => {
                  const parts = line.split(/\s+/);
                  return {
                    user: parts[0], pid: parts[1], cpu: parts[2], mem: parts[3],
                    command: parts.slice(10).join(' '),
                    source: 'ps'
                  };
                })
              : [];
            res.json({ apps });
          });
        }
        return;
      }
    }

    exec('ps aux | grep node | grep -v grep', (error, stdout) => {
      let apps = [];
      if (!error && stdout) {
        apps = stdout.trim().split('\n').filter(Boolean).map(line => {
          const parts = line.split(/\s+/);
          return {
            user: parts[0],
            pid: parts[1],
            cpu: parts[2],
            mem: parts[3],
            command: parts.slice(10).join(' '),
            source: 'ps'
          };
        });
      }
      res.json({ apps });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kill App
serversRouter.post('/kill-app', async (req, res) => {
  try {
    const { serverId, pid, domain, source } = req.body;
    if (!serverId) return res.status(400).json({ error: 'Missing serverId' });
    
    const s = await serversRepo.getServerById(serverId, true);
    if (!s) return res.status(404).json({ error: 'Server not found' });
    const sshBase = sshCmd(s);
    
    let killCmd = '';
    if (s.use_devil && source === 'devil') {
       if (!domain) return res.status(400).json({ error: 'Missing domain' });
       killCmd = `${sshBase} "devil www restart ${domain}"`;
    } else {
       if (!pid || pid === '-') return res.status(400).json({ error: 'Missing PID' });
       killCmd = `${sshBase} "kill -9 ${pid}"`;
    }

    exec(killCmd, (err, out) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: 'App killed/restarted' });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
