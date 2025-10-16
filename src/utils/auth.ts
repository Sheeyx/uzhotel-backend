import { ENV } from '../config';
import type { Request, Response, NextFunction } from 'express';

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const got = (req.headers['x-api-key'] || '') as string;
  if (!got || got !== ENV.API_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
}
