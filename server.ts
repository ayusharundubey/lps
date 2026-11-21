import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { adminRouter } from './src/api/adminRoutes';
import { authRouter } from './src/api/authRoutes';
import { storeRouter } from './src/api/customerRoutes';
import { paymentRouter, type RawBodyRequest } from './src/api/paymentRoutes';
import { attachAuthUser, requireCsrfProtection } from './src/authentication/middleware';
import { getServerEnv } from './src/configuration/env';
import { runMigrations } from './src/database/migrate';
import { getDb } from './src/database/pool';
import { seedFoundation } from './src/database/seed';
import { getMediaUploadDir } from './src/utilities/mediaStorage';

export async function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  // Security headers compatible with AI Studio preview iframe
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Preserve raw request buffer for Razorpay webhook HMAC verification; allow 8mb for validated image uploads
  app.use(
    express.json({
      limit: '8mb',
      verify: (req, _res, buf) => {
        (req as RawBodyRequest).rawBody = buf;
      },
    })
  );

  // Serve uploaded storefront media safely (strict UUID.ext filename allowlist, no path traversal)
  app.get('/media/:filename', (req, res) => {
    const filename = req.params.filename || '';
    if (!/^[a-f0-9-]+\.(jpg|png|webp)$/i.test(filename)) {
      res.status(404).end();
      return;
    }
    const fullPath = path.join(getMediaUploadDir(), path.basename(filename));
    if (!fs.existsSync(fullPath)) {
      res.status(404).end();
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(fullPath);
  });

  app.use('/api', attachAuthUser);
  app.use('/api', requireCsrfProtection);

  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/payments', paymentRouter);
  app.use('/api', storeRouter);

  // Unknown API routes return structured JSON 404 rather than falling back to index.html
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.', code: 'NOT_FOUND' });
  });

  // Error boundary for API routes (never leaks SQL or stack details to browser)
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error('[LPS STORE Server Error]:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'An internal server error occurred.',
          code: 'INTERNAL_ERROR',
        });
      }
    }
  );

  return app;
}

async function startServer() {
  const env = getServerEnv();
  const db = getDb();
  const newlyApplied = await runMigrations(db);
  await seedFoundation(db);

  console.log(
    `[LPS STORE] PostgreSQL (${db.engine}) connected. Migrations applied: ${
      newlyApplied.length ? newlyApplied.join(', ') : 'up to date'
    }`
  );

  const app = await createApp();

  if (env.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`[LPS STORE] Server listening on http://0.0.0.0:${env.port}`);
  });
}

// Start server when run directly
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  path.basename(process.argv[1]) === 'server.ts';

if (isDirectRun) {
  startServer().catch((err) => {
    console.error('[LPS STORE] Fatal startup failure:', err);
    process.exit(1);
  });
}
