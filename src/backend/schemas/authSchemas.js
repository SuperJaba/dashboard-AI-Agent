import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Nazwa użytkownika jest wymagana').max(64),
  password: z.string().min(1, 'Hasło jest wymagane').max(256),
});

export const setupSchema = z.object({
  username: z.string().min(3, 'Min. 3 znaki').max(64),
  password: z.string().min(8, 'Min. 8 znaków').max(256),
});

export const refreshSchema = z.object({
  token: z.string().optional(),
});
