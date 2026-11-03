import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './jwtSecret.js';

export const authMiddleware = (req, res, next) => {
  // Allow OPTIONS requests for CORS
  if (req.method === 'OPTIONS') {return next();}
  
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch  {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Optional authentication middleware: extracts and verifies JWT token if present,
 * but does not block requests when unauthenticated.
 */
export const optionalAuthMiddleware = (req, res, next) => {
  if (req.method === 'OPTIONS') {return next();}
  
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch {}
  }

  next();
};
