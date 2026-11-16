import type { Request, Response, NextFunction } from 'express';

export function adminOriginProtection(origins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (
      req.method !== 'GET' &&
      req.path.startsWith('/api/admin') &&
      (!req.headers.origin || !origins.includes(req.headers.origin))
    ) {
      res.sendStatus(403);
      return;
    }
    next();
  };
}
