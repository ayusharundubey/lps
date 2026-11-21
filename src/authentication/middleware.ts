import type { NextFunction, Request, Response } from 'express';
import { writeAuditLog } from '../database/audit';
import type { AuthenticatedUser } from '../types/api';
import type { PermissionCode } from '../types/database';
import { resolveSessionUser } from './session';

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}

export async function attachAuthUser(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await resolveSessionUser(req);
    if (user) {
      req.authUser = user;
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.authUser) {
    res.status(401).json({
      error: 'Authentication required. Please sign in to continue.',
      code: 'UNAUTHORIZED',
    });
    return;
  }
  next();
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.authUser) {
    res.status(401).json({
      error: 'Administrator authentication required.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  if (!req.authUser.isAdmin) {
    await writeAuditLog({
      actorProfileId: req.authUser.profileId,
      actorRole: req.authUser.roleCode,
      action: 'admin.access_denied',
      resourceType: 'route',
      resourceId: req.originalUrl,
      req,
      details: { method: req.method },
    }).catch(() => undefined);

    res.status(403).json({
      error: 'Access denied. Administrator privileges are required for this resource.',
      code: 'FORBIDDEN',
    });
    return;
  }

  next();
}

export function requirePermission(permission: PermissionCode) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.authUser || !req.authUser.isAdmin) {
      res.status(403).json({
        error: 'Administrator privileges required.',
        code: 'FORBIDDEN',
      });
      return;
    }

    const hasPerm =
      req.authUser.permissions.includes('*') ||
      req.authUser.permissions.includes(permission);

    if (!hasPerm) {
      await writeAuditLog({
        actorProfileId: req.authUser.profileId,
        actorRole: req.authUser.roleCode,
        action: 'admin.permission_denied',
        resourceType: 'permission',
        resourceId: permission,
        req,
      }).catch(() => undefined);

      res.status(403).json({
        error: `Missing required permission: ${permission}`,
        code: 'INSUFFICIENT_PERMISSION',
      });
      return;
    }

    next();
  };
}

/**
 * CSRF & Origin verification for browser-initiated state mutations.
 * Webhook endpoints bypass this middleware and authenticate via HMAC signature instead.
 */
export function requireCsrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  if (req.path === '/api/payments/webhook') {
    next();
    return;
  }

  const customHeader = req.headers['x-requested-with'];
  const originHeader = req.headers.origin;
  const hostHeader = (req.headers['x-forwarded-host'] || req.headers.host || '')
    .toString()
    .split(',')[0]
    .trim();

  if (originHeader && hostHeader) {
    try {
      const originHost = new URL(originHeader).host;
      if (originHost !== hostHeader) {
        res.status(403).json({
          error: 'Cross-origin mutation rejected.',
          code: 'CSRF_ORIGIN_MISMATCH',
        });
        return;
      }
    } catch {
      res.status(403).json({
        error: 'Invalid request origin.',
        code: 'CSRF_INVALID_ORIGIN',
      });
      return;
    }
  }

  // Require explicit SPA client header when cookie-based auth is active
  if (req.headers.cookie && customHeader !== 'LPS-Store-Client') {
    res.status(403).json({
      error: 'Missing required CSRF verification header.',
      code: 'CSRF_HEADER_MISSING',
    });
    return;
  }

  next();
}

interface RateBucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}) {
  const buckets = new Map<string, RateBucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.ip ||
      'unknown';
    const key = `${options.keyPrefix}:${ip}`;
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (existing.count >= options.maxRequests) {
      const retrySeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retrySeconds));
      res.status(429).json({
        error: 'Too many requests. Please wait before retrying.',
        code: 'RATE_LIMITED',
      });
      return;
    }

    existing.count += 1;
    next();
  };
}
