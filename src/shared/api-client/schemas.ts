import { z } from 'zod';

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+)?instructions/i,
  /forget\s+(all\s+)?(previous\s+)?instructions/i,
  /bypass\s+restrictions/i,
  /you\s+are\s+now/i,
  /print\s+previous/i,
  /system\s+prompt/i,
  /new\s+rule/i,
  /\[system\]/i
];

export const SecurePromptSchema = z.string().max(2000).superRefine((val, ctx) => {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Security Alert: Potential prompt injection payload detected. Request blocked.',
      });
      return;
    }
  }
});

export const DeployRequestSchema = z.object({
  agent: z.string(),
  directory: z.string().optional(),
  llmUrl: z.string().optional(),
  apiKey: z.string().optional(),
  tasks: z.array(z.any()).optional(),
  useBrowserTerminal: z.union([z.boolean(), z.string()]).transform(v => typeof v === 'string' ? v === 'true' : v).optional(),
  remoteServer: z.any().optional(),
  remotePrompt: SecurePromptSchema.optional()
});


export const TaskSchema = z.object({
  id: z.number(),
  title: z.string(),
  status: z.string(),
  meta: z.string().optional().nullable()
}).passthrough();

export const ProjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  desc: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  tech: z.string().nullable().optional(),
  complete: z.number().optional().default(0),
  tasks: z.preprocess(
    (val) => {
      if (!val) return [];
      if (typeof val === 'string') {
        try { 
          const parsed = JSON.parse(val);
          return Array.isArray(parsed) ? parsed : [];
        } catch { 
          return []; 
        }
      }
      return Array.isArray(val) ? val : [];
    },
    z.array(TaskSchema).optional().default([])
  )
}).passthrough();

export type ProjectData = z.infer<typeof ProjectSchema>;

export const ServerSchema = z.object({
  id: z.number(),
  name: z.string(),
  host: z.string().nullable().optional().default(''),
  username: z.string().nullable().optional().default(''),
  port: z.number().optional().default(22),
  use_devil: z.boolean().optional().default(false),
  ssh_password: z.string().nullable().optional()
}).passthrough();

export type ServerData = z.infer<typeof ServerSchema>;

export const AgentSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  config_uri: z.string().nullable().optional(),
  installed: z.boolean().optional(),
  llm_model: z.string().nullable().optional(),
  temperature: z.number().nullable().optional(),
  max_tokens: z.number().nullable().optional()
}).passthrough();

export type AgentData = z.infer<typeof AgentSchema>;

export const SettingsSchema = z.object({
  llmUrl: z.string().optional(),
  apiKey: z.string().optional(),
  llmName: z.string().optional(),
  llmModel: z.string().optional(),
  useBrowserTerminal: z.union([z.boolean(), z.string()]).transform(v => typeof v === 'string' ? v === 'true' : v).optional()
}).passthrough();

export type SettingsData = z.infer<typeof SettingsSchema>;
