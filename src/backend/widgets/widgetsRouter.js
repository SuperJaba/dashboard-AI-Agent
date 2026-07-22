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
  } catch (error) {
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
