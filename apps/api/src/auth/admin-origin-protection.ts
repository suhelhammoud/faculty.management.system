import type { Request, Response, NextFunction } from 'express';

export function adminOriginProtection(origins: string[], prefixes = ['/api/admin']) {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path.toLowerCase();
    if (
      req.method !== 'GET' &&
      prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) &&
      (!req.headers.origin || !origins.includes(req.headers.origin))
    ) {
      res.sendStatus(403);
      return;
    }
    next();
  };
}
