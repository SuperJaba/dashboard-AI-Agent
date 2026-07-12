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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Custom Widget
widgetsRouter.post('/', async (req, res) => {
  try {
    const widget = await widgetsRepo.createWidget(req.body);
    res.json(widget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Custom Widget
widgetsRouter.delete('/:id', async (req, res) => {
  try {
    const result = await widgetsRepo.deleteWidget(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run Custom Widget
widgetsRouter.get('/:id/run', async (req, res) => {
  try {
    const widget = await widgetsRepo.getWidgetById(req.params.id);
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    if (widget.server_id) {
      const s = await serversRepo.getServerById(widget.server_id, true);
      if (s) {
        // Use bash to execute the command correctly remotely, wrapping in quotes
        const cmd = sshCmd(s, `"bash -c '${widget.command.replace(/'/g, "'\\''")}'"`);
        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            return res.status(500).json({ error: 'Remote execution failed: ' + (stderr || error.message) });
          }
          return res.json({ result: stdout.trim() });
        });
        return;
      }
    }

    // Local fallback
    exec(`bash -c "${widget.command.replace(/"/g, '\\"')}"`, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ error: 'Local execution failed: ' + (stderr || error.message) });
      }
      return res.json({ result: stdout.trim() });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
