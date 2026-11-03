import express from 'express';
import { exec } from 'child_process';
import * as widgetsRepo from './widgetsRepository.js';
import * as serversRepo from '../servers/serversRepository.js';
import { sshCmd } from '../utils/ssh.js';

export const widgetsRouter = express.Router();

// Get Custom Widgets
widgetsRouter.get('/', async (req, res) => {
  try {
    const widgets = await widgetsRepo.getWidgets();
    res.json(widgets);
  } catch  {
    res.status(500).json({ error: 'Failed to fetch widgets' });
  }
});

widgetsRouter.get('/disk-usage', async (req, res) => {
  exec('node scripts/disk_usage_monitor.js', (error, stdout, stderr) => {
    if (error) {
      console.error('Disk usage script error:', error);
      return res.status(500).json({ error: error.message, stderr });
    }
    try {
      const data = JSON.parse(stdout);
      res.json(data);
    } catch (parseErr) {
      console.error('Parsing disk usage output failed:', parseErr);
      res.status(500).json({ error: 'Failed to parse script output', raw: stdout });
    }
  });
});

widgetsRouter.post('/', async (req, res) => {
  try {
    const { name, command, type, color, server_id } = req.body;
    if (!name || !command) {
      return res.status(400).json({ error: 'Name and command are required' });
    }
    const newWidget = await widgetsRepo.createWidget({ name, command, type, color, server_id });
    res.status(201).json(newWidget);
  } catch (error) {
    console.error('Failed to create widget', error);
    res.status(500).json({ error: 'Failed to create widget' });
  }
});

widgetsRouter.put('/:id', async (req, res) => {
  try {
    const { name, command, type, color, server_id } = req.body;
    const updated = await widgetsRepo.updateWidget(req.params.id, { name, command, type, color, server_id });
    if (!updated) {
      return res.status(404).json({ error: 'Widget not found' });
    }
    res.json(updated);
  } catch (error) {
    console.error('Failed to update widget', error);
    res.status(500).json({ error: 'Failed to update widget' });
  }
});

widgetsRouter.delete('/:id', async (req, res) => {
  try {
    await widgetsRepo.deleteWidget(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete widget', error);
    res.status(500).json({ error: 'Failed to delete widget' });
  }
});

widgetsRouter.get('/:id/run', async (req, res) => {
  try {
    const widget = await widgetsRepo.getWidgetById(req.params.id);
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    if (widget.server_id) {
      const server = await serversRepo.getServerById(widget.server_id);
      if (server) {
        // Check if widget is for "Local Docker Containers" and needs rebuild
        const isDockerContainers = widget.command.includes('docker ps -a');

        try {
          let result;
          if (isDockerContainers) {
            // For docker containers: build chart first, wait 10s, then check status
            const sshCmdStr = sshCmd(server, widget.command);

            // Step 1: Build the chart (docker-compose up -d or similar)
            result = await new Promise((resolve, reject) => {
              exec(`ssh -t ${sshCmdStr} "docker compose build"`, (err, stdout, stderr) => {
                if (err) {
                  console.error('Docker build error:', err);
                  reject(new Error(stderr || err.message));
                } else {
                  resolve(stdout.trim());
                }
              });
            });

            // Step 2: Wait 10 seconds for containers to start
            await new Promise(resolve => setTimeout(resolve, 10000));

            // Step 3: Get container status
            result = await new Promise((resolve, reject) => {
              exec(`ssh -t ${sshCmdStr} "docker ps -a --format 'ID: {{.ID}} Image: {{.Image}} Status: {{.Status}}'"`, (err, stdout, stderr) => {
                if (err) {
                  console.error('Docker status error:', err);
                  reject(new Error(stderr || err.message));
                } else {
                  resolve(stdout.trim());
                }
              });
            });
          } else {
            // Standard command execution via SSH
            result = await new Promise((resolve, reject) => {
              exec(`ssh -t ${sshCmdStr}`, (err, stdout, stderr) => {
                if (err) {
                  console.error('SSH widget error:', err);
                  reject(new Error(stderr || err.message));
                } else {
                  resolve(stdout.trim());
                }
              });
            });
          }

          return res.json({ result });
        } catch (sshErr) {
          console.error('SSH widget error:', sshErr);
          return res.json({ result: 'Error' });
        }
      }
    }

    exec(widget.command, (error, stdout) => {
      if (error) {
        console.error('Widget execution error:', error);
        return res.json({ result: stdout ? stdout.trim() : 'Error' });
      }
      res.json({ result: stdout.trim() });
    });
  } catch (error) {
    console.error('Failed to run widget', error);
    res.status(500).json({ error: 'Failed to run widget' });
  }
});
