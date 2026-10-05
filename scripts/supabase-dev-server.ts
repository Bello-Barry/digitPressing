import http from 'http';
import { Client } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const PORT = 54321;
const POSTGREST_PORT = 3001;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';
const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres';

function getPgClient() {
  return new Client({ connectionString: DB_URL });
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, X-Tenant-Org, apikey');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = req.url || '';

  // 1. SUPABASE AUTH ENDPOINTS
  if (url.startsWith('/auth/v1/token') && req.method === 'POST') {
    let bodyStr = '';
    req.on('data', (chunk) => { bodyStr += chunk; });
    req.on('end', async () => {
      try {
        const { email, password } = JSON.parse(bodyStr || '{}');
        if (!email || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Email and password are required' }));
          return;
        }

        const pg = getPgClient();
        await pg.connect();
        const { rows } = await pg.query('SELECT * FROM auth.users WHERE lower(email) = lower($1)', [email.trim()]);
        await pg.end();

        if (rows.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }));
          return;
        }

        const user = rows[0];
        const isValid = bcrypt.compareSync(password, user.encrypted_password || '');
        if (!isValid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }));
          return;
        }

        const payload = {
          sub: user.id,
          email: user.email,
          role: 'authenticated',
          aud: 'authenticated',
          exp: Math.floor(Date.now() / 1000) + 86400 * 7,
        };

        const token = jwt.sign(payload, JWT_SECRET);

        const userObj = {
          id: user.id,
          email: user.email,
          role: 'authenticated',
          aud: 'authenticated',
          user_metadata: user.raw_user_meta_data || {},
          app_metadata: user.raw_app_meta_data || {},
          created_at: user.created_at,
          updated_at: user.updated_at,
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          access_token: token,
          token_type: 'bearer',
          expires_in: 86400 * 7,
          refresh_token: token,
          user: userObj,
        }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'server_error', error_description: err.message }));
      }
    });
    return;
  }

  if (url.startsWith('/auth/v1/user') && req.method === 'GET') {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const pg = getPgClient();
      await pg.connect();
      const { rows } = await pg.query('SELECT * FROM auth.users WHERE id = $1', [decoded.sub]);
      await pg.end();

      if (rows.length === 0) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized', error_description: 'User not found' }));
        return;
      }

      const user = rows[0];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: user.id,
        email: user.email,
        role: 'authenticated',
        aud: 'authenticated',
        user_metadata: user.raw_user_meta_data || {},
        app_metadata: user.raw_app_meta_data || {},
        created_at: user.created_at,
        updated_at: user.updated_at,
      }));
    } catch (err: any) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized', error_description: 'Invalid token: ' + err.message }));
    }
    return;
  }

  if (url.startsWith('/auth/v1/logout')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({}));
    return;
  }

  // 2. PROXY TO POSTGREST
  const proxyReq = http.request(
    {
      host: '127.0.0.1',
      port: POSTGREST_PORT,
      path: url.replace('/rest/v1', ''),
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    }
  );

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'postgrest_error', error_description: err.message }));
  });

  req.pipe(proxyReq, { end: true });
});

server.listen(PORT, () => {
  console.log(`Supabase local dev gateway listening on http://127.0.0.1:${PORT}`);
});
