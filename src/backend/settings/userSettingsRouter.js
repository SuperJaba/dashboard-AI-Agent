import express from 'express';
import { z } from 'zod';
import * as userSettingsRepo from './userSettingsRepository.js';

export const userSettingsRouter = express.Router();

const UserSettingsSchema = z.object({
  theme: z.enum(['dark', 'light']).optional(),
  language: z.enum(['pl', 'en', 'hi']).optional(),
});

// Get the logged-in user's preferences (theme/language)
userSettingsRouter.get('/', async (req, res) => {
  try {
    const settings = await userSettingsRepo.getUserSettings(req.user.id);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save the logged-in user's preferences (theme/language)
userSettingsRouter.put('/', async (req, res) => {
  try {
    const { theme, language } = UserSettingsSchema.parse(req.body);
    const settings = await userSettingsRepo.saveUserSettings(req.user.id, { theme, language });
    res.json(settings);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
