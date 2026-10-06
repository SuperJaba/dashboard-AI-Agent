import express from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../auth/jwtSecret.js';
import { resolveDashboardUrl } from '../utils/network.js';
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
  const { name, host, username, port, use_devil, ssh_password, provider, url } = req.body;
  try {
    const row = await serversRepo.createServer({ name, host, username, port, use_devil, ssh_password, provider, url });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a server
serversRouter.put('/servers/:id', async (req, res) => {
  const { name, host, username, port, use_devil, ssh_password, provider, url } = req.body;
  try {
    const row = await serversRepo.updateServer(req.params.id, { name, host, username, port, use_devil, ssh_password, provider, url });
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

// Setup Agent SSH Keys for a server
serversRouter.post('/servers/:id/setup-ssh', async (req, res) => {
  try {
    const s = await serversRepo.getServerById(req.params.id);
    if (!s) {return res.status(404).json({ error: 'Server not found' });}

    const home = os.homedir();
    const sshDir = path.join(home, '.ssh');
    const keyPath = path.join(sshDir, 'id_ed25519_antigravity');
    const pubKeyPath = keyPath + '.pub';

    if (!fs.existsSync(sshDir)) {
      fs.mkdirSync(sshDir, { recursive: true, mode: 0o700 });
    }

    const generateKey = () => {
      return new Promise((resolve, reject) => {
        if (fs.existsSync(keyPath)) {
          return resolve();
        }
        exec(`ssh-keygen -t ed25519 -f "${keyPath}" -N ""`, (error) => {
          if (error) {return reject(error);}
          resolve();
        });
      });
    };

    await generateKey();

    const pubKey = fs.readFileSync(pubKeyPath, 'utf8').trim();
    const copyCommand = `ssh-copy-id -i "${pubKeyPath}" -p ${s.port} ${s.username}@${s.host}`;

    res.json({
      success: true,
      publicKey: pubKey,
      copyCommand
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Setup Socket.IO Worker Tunnel on remote server via SSH
serversRouter.post('/servers/:id/setup-tunnel', async (req, res) => {
  try {
    const s = await serversRepo.getServerById(req.params.id, true);
    if (!s) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const dashboardUrl = resolveDashboardUrl(req);
    const workerToken = jwt.sign(
      { id: req.user?.id || 1, username: req.user?.username || 'worker-client', isWorker: true, serverId: s.id },
      JWT_SECRET,
      { expiresIn: '90d' }
    );
    const workerName = s.name || s.host || 'Remote-Worker';

    const remoteScript = [
      'mkdir -p ~/dashboard-worker && cd ~/dashboard-worker',
      '[ -f package.json ] || npm init -y',
      'node -e \'const fs=require("fs"); try{ const p=JSON.parse(fs.readFileSync("package.json")); p.type="module"; fs.writeFileSync("package.json",JSON.stringify(p,null,2)); }catch(e){}\'',
      '([ -d node_modules/socket.io-client ] && [ -d node_modules/node-pty ]) || npm install socket.io-client node-pty',
      `curl -sSL "${dashboardUrl}/api/worker/script" -o local-agent-worker.js`,
      'pkill -9 -f "local-agent-worker.js" || true',
      `nohup node local-agent-worker.js "${dashboardUrl}" "${workerToken}" "${workerName}" remote > worker.log 2>&1 &`
    ].join(' && ');

    const cmd = sshCmd(s, `"${remoteScript}"`);

    exec(cmd, { timeout: 35000 }, (error, stdout, stderr) => {
      if (error) {
        const msg = stderr ? stderr.trim() : error.message;
        return res.status(500).json({ error: `SSH setup-tunnel failed: ${msg}` });
      }
      res.json({
        success: true,
        message: `Tunel został pomyślnie uruchomiony na serwerze ${s.name}`,
        workerName,
        dashboardUrl
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kill Socket.IO Worker Tunnel on remote server via SSH
serversRouter.post('/servers/:id/kill-tunnel', async (req, res) => {
  try {
    const s = await serversRepo.getServerById(req.params.id, true);
    if (!s) {
      return res.status(404).json({ error: 'Server not found' });
    }
    const workerName = s.name || s.host || 'Remote-Worker';
    const remoteScript = 'pkill -9 -f "local-agent-worker.js" || true';
    const cmd = sshCmd(s, `"${remoteScript}"`);

    exec(cmd, { timeout: 15000 }, () => {
      // Disconnect any active worker in server.js matching this server
      import('../../../server.js').then(({ activeWorkers }) => {
        if (activeWorkers) {
          for (const [wId, w] of activeWorkers.entries()) {
            if (
              Number(w.serverId) === Number(s.id) ||
              w.name === workerName ||
              w.serverName === s.name ||
              w.hostname === s.host ||
              (w.ip && w.ip === s.host)
            ) {
              try {
                w.socket.emit('worker_terminate', { reason: 'SSH kill on remote server' });
                w.socket.disconnect(true);
              } catch {}
              activeWorkers.delete(wId);
            }
          }
        }
      }).catch(() => {});

      res.json({
        success: true,
        message: `Tunel na serwerze ${s.name} został zatrzymany i ubity (SSH).`
      });
    });
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
        const nodeScript = 'const os = require(\'os\'); const totalMem = os.totalmem(); const freeMem = os.freemem(); console.log(JSON.stringify({ cpu: { cores: os.cpus().length, model: os.cpus()[0]?.model, load1: os.loadavg()[0], load5: os.loadavg()[1], load15: os.loadavg()[2] }, memory: { total: totalMem, free: freeMem, used: totalMem - freeMem, usagePercent: ((totalMem - freeMem) / totalMem) * 100 }, os: { platform: os.platform(), release: os.release(), uptime: os.uptime() } }));';
        const cmd = sshCmd(s, `"node -e \\"${nodeScript}\\""`);
        
        exec(cmd, { timeout: 8000 }, (error, stdout, stderr) => {
          if (error) {
            const msg = stderr ? stderr.trim() : error.message;
            return res.json({ error: `SSH Connection Failed: ${msg}` });
          }
          try {
            const stats = JSON.parse(stdout.trim());
            return res.json(stats);
          } catch  {
            return res.json({ error: 'Failed to parse remote stats output' });
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

        const isDevil = s.use_devil || (s.host && s.host.includes('ct8.pl'));
        if (isDevil) {
          exec(`${sshBase} "devil www list 2>/dev/null"`, (err, out) => {
            const apps = (!err && out)
              ? out.trim().split('\n')
                .filter(line => /nodejs|proxy|python|ruby/.test(line))
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
                const command = parts.slice(10).join(' ');
                const domainMatch = command.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                return {
                  user: parts[0], pid: parts[1], cpu: parts[2], mem: parts[3],
                  command,
                  domain: domainMatch ? domainMatch[1] : (command.split(' ')[0] || ''),
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
    if (!serverId) {return res.status(400).json({ error: 'Missing serverId' });}
    
    const s = await serversRepo.getServerById(serverId, true);
    if (!s) {return res.status(404).json({ error: 'Server not found' });}
    const sshBase = sshCmd(s);
    
    let killCmd = '';
    const isDevil = s.use_devil || (s.host && s.host.includes('ct8.pl'));
    if (isDevil && (source === 'devil' || domain)) {
      if (!domain) {return res.status(400).json({ error: 'Missing domain' });}
      killCmd = `${sshBase} "devil www restart ${domain}"`;
    } else {
      if (!pid || pid === '-') {return res.status(400).json({ error: 'Missing PID' });}
      killCmd = `${sshBase} "kill -9 ${pid}"`;
    }

    exec(killCmd, (err) => {
      if (err) {return res.status(500).json({ error: err.message });}
      res.json({ success: true, message: 'App killed/restarted' });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
