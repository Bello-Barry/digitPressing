import http from 'http';
import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres';
const JWT_SECRET = 'super-secret-jwt-key-for-local-dev-testing-32-chars';

const pg = new Client({ connectionString: DB_URL });
pg.connect();

function parseFilterParam(paramValue: string | null) {
  if (!paramValue) return null;
  if (paramValue.startsWith('eq.')) {
    return { op: 'eq', val: paramValue.substring(3) };
  }
  if (paramValue.startsWith('in.(') && paramValue.endsWith(')')) {
    const rawList = paramValue.slice(4, -1);
    const list = rawList.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    return { op: 'in', val: list };
  }
  return { op: 'eq', val: paramValue };
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', async () => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const pathname = url.pathname;
    let parsedBody: any = {};
    try { if (body) parsedBody = JSON.parse(body); } catch (e) {}

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      return res.end();
    }

    // Token Endpoint
    if (pathname === '/auth/v1/token' && req.method === 'POST') {
      const grantType = url.searchParams.get('grant_type') || parsedBody.grant_type;
      if (grantType === 'password') {
        const { email, password } = parsedBody;
        try {
          const userRes = await pg.query('SELECT * FROM auth.users WHERE lower(email) = lower($1)', [email]);
          if (userRes.rows.length === 0) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }));
          }

          const user = userRes.rows[0];
          const valid = bcrypt.compareSync(password, user.encrypted_password);
          if (!valid) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }));
          }

          const token = jwt.sign(
            {
              sub: user.id,
              email: user.email,
              role: 'authenticated',
              aud: 'authenticated',
              exp: Math.floor(Date.now() / 1000) + 3600 * 24,
            },
            JWT_SECRET
          );

          res.statusCode = 200;
          return res.end(JSON.stringify({
            access_token: token,
            token_type: 'bearer',
            expires_in: 3600 * 24,
            refresh_token: token,
            user: {
              id: user.id,
              email: user.email,
              user_metadata: user.raw_user_meta_data || {},
              app_metadata: user.raw_app_meta_data || {},
            },
          }));
        } catch (err: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: err.message }));
        }
      }
    }

    // User Endpoint
    if (pathname === '/auth/v1/user' && req.method === 'GET') {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ error: 'missing token' }));
      }
      const token = authHeader.replace('Bearer ', '');
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        const userRes = await pg.query('SELECT * FROM auth.users WHERE id = $1', [decoded.sub]);
        if (userRes.rows.length === 0) {
          res.statusCode = 404;
          return res.end(JSON.stringify({ error: 'user not found' }));
        }
        const user = userRes.rows[0];
        res.statusCode = 200;
        return res.end(JSON.stringify({
          id: user.id,
          email: user.email,
          user_metadata: user.raw_user_meta_data || {},
          app_metadata: user.raw_app_meta_data || {},
        }));
      } catch (err: any) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ error: 'invalid token' }));
      }
    }

    // Admin Create User Endpoint
    if (pathname === '/auth/v1/admin/users' && req.method === 'POST') {
      const { email, password, user_metadata } = parsedBody;
      try {
        const encryptedPassword = bcrypt.hashSync(password, 10);
        const insertRes = await pg.query(
          `INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data)
           VALUES ($1, $2, NOW(), $3, $4) RETURNING id`,
          [email.toLowerCase(), encryptedPassword, JSON.stringify(user_metadata || {}), JSON.stringify({ provider: 'email', providers: ['email'] })]
        );
        const userId = insertRes.rows[0].id;
        await pg.query(
          `INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at)
           VALUES ($1, $2, $3, 'email', NOW()) ON CONFLICT DO NOTHING`,
          [userId, userId, JSON.stringify({ sub: userId, email: email.toLowerCase() })]
        );
        res.statusCode = 200;
        return res.end(JSON.stringify({
          user: {
            id: userId,
            email: email.toLowerCase(),
            user_metadata,
          },
        }));
      } catch (err: any) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // Logout Mock
    if (pathname === '/auth/v1/logout') {
      res.statusCode = 200;
      return res.end(JSON.stringify({}));
    }

    // RPC Endpoints
    if (pathname.startsWith('/rest/v1/rpc/')) {
      const fnName = pathname.replace('/rest/v1/rpc/', '');
      try {
        if (fnName === 'create_order_request') {
          const { p_org_id, p_client_name, p_client_phone, p_items, p_mode, p_address, p_notes, p_honeypot } = parsedBody;
          const rpcRes = await pg.query(
            `SELECT create_order_request($1, $2, $3, $4::jsonb, $5, $6, $7, NULL, $8) as res`,
            [p_org_id, p_client_name, p_client_phone, JSON.stringify(p_items), p_mode || 'DROP_OFF', p_address || null, p_notes || null, p_honeypot || null]
          );
          res.statusCode = 200;
          return res.end(JSON.stringify(rpcRes.rows[0].res));
        }

        if (fnName === 'receive_order_and_assign_ticket') {
          const { p_order_id, p_org_id, p_user_id, p_items_count } = parsedBody;
          const rpcRes = await pg.query(
            `SELECT receive_order_and_assign_ticket($1, $2, $3, $4) as ticket`,
            [p_order_id, p_org_id, p_user_id, p_items_count]
          );
          res.statusCode = 200;
          return res.end(JSON.stringify(rpcRes.rows[0].ticket));
        }

        res.statusCode = 404;
        return res.end(JSON.stringify({ error: `RPC ${fnName} not found` }));
      } catch (e: any) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    // REST Endpoint for organizations
    if (pathname.startsWith('/rest/v1/organizations')) {
      const slugFilter = parseFilterParam(url.searchParams.get('slug'));
      const idFilter = parseFilterParam(url.searchParams.get('id'));
      try {
        let query = 'SELECT * FROM organizations WHERE is_active = true';
        const params: any[] = [];
        if (slugFilter && slugFilter.op === 'eq') {
          params.push(slugFilter.val);
          query += ` AND slug = $${params.length}`;
        }
        if (idFilter && idFilter.op === 'eq') {
          params.push(idFilter.val);
          query += ` AND id = $${params.length}`;
        }
        const resDb = await pg.query(query, params);
        res.statusCode = 200;
        const acceptSingle = req.headers['accept']?.includes('vnd.pgrst.object+json');
        if (acceptSingle) {
          return res.end(JSON.stringify(resDb.rows[0] || null));
        }
        return res.end(JSON.stringify(resDb.rows));
      } catch (e: any) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    // REST Endpoint for services
    if (pathname.startsWith('/rest/v1/services')) {
      if (req.method === 'POST') {
        const { organization_id, name, category, price, is_active } = parsedBody;
        try {
          const insertRes = await pg.query(
            `INSERT INTO services (organization_id, name, category, price, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [organization_id, name, category, price, is_active ?? true]
          );
          res.statusCode = 201;
          return res.end(JSON.stringify(insertRes.rows[0]));
        } catch (e: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: e.message }));
        }
      }

      if (req.method === 'PATCH') {
        const idFilter = parseFilterParam(url.searchParams.get('id'));
        try {
          const updates: string[] = [];
          const params: any[] = [];
          if (parsedBody.name !== undefined) { params.push(parsedBody.name); updates.push(`name = $${params.length}`); }
          if (parsedBody.price !== undefined) { params.push(parsedBody.price); updates.push(`price = $${params.length}`); }
          if (parsedBody.category !== undefined) { params.push(parsedBody.category); updates.push(`category = $${params.length}`); }
          if (parsedBody.is_active !== undefined) { params.push(parsedBody.is_active); updates.push(`is_active = $${params.length}`); }

          if (idFilter && idFilter.op === 'eq') {
            params.push(idFilter.val);
            const query = `UPDATE services SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`;
            const updRes = await pg.query(query, params);
            res.statusCode = 200;
            return res.end(JSON.stringify(updRes.rows));
          }
        } catch (e: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: e.message }));
        }
      }

      const orgFilter = parseFilterParam(url.searchParams.get('organization_id'));
      const idFilter = parseFilterParam(url.searchParams.get('id'));
      const activeFilter = parseFilterParam(url.searchParams.get('is_active'));
      try {
        let query = 'SELECT * FROM services WHERE 1=1';
        const params: any[] = [];
        if (orgFilter && orgFilter.op === 'eq') {
          params.push(orgFilter.val);
          query += ` AND organization_id = $${params.length}`;
        }
        if (activeFilter && activeFilter.op === 'eq') {
          params.push(activeFilter.val === 'true');
          query += ` AND is_active = $${params.length}`;
        }
        if (idFilter) {
          if (idFilter.op === 'eq') {
            params.push(idFilter.val);
            query += ` AND id = $${params.length}`;
          } else if (idFilter.op === 'in') {
            params.push(idFilter.val);
            query += ` AND id = ANY($${params.length})`;
          }
        }
        query += ' ORDER BY category, price';
        const resDb = await pg.query(query, params);
        res.statusCode = 200;
        const acceptSingle = req.headers['accept']?.includes('vnd.pgrst.object+json');
        if (acceptSingle) {
          return res.end(JSON.stringify(resDb.rows[0] || null));
        }
        return res.end(JSON.stringify(resDb.rows));
      } catch (e: any) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    // REST Endpoint for orders
    if (pathname.startsWith('/rest/v1/orders')) {
      if (req.method === 'PATCH') {
        const idFilter = parseFilterParam(url.searchParams.get('id'));
        try {
          const updates: string[] = [];
          const params: any[] = [];
          if (parsedBody.status !== undefined) { params.push(parsedBody.status); updates.push(`status = $${params.length}`); }
          if (parsedBody.validated_by !== undefined) { params.push(parsedBody.validated_by); updates.push(`validated_by = $${params.length}`); }
          if (parsedBody.delivery_fee !== undefined) { params.push(parsedBody.delivery_fee); updates.push(`delivery_fee = $${params.length}`); }
          if (parsedBody.total_amount !== undefined) { params.push(parsedBody.total_amount); updates.push(`total_amount = $${params.length}`); }
          if (parsedBody.cancelled_by !== undefined) { params.push(parsedBody.cancelled_by); updates.push(`cancelled_by = $${params.length}`); }
          if (parsedBody.cancellation_reason !== undefined) { params.push(parsedBody.cancellation_reason); updates.push(`cancellation_reason = $${params.length}`); }
          if (parsedBody.updated_at !== undefined) { params.push(parsedBody.updated_at); updates.push(`updated_at = $${params.length}`); }

          if (idFilter && idFilter.op === 'eq') {
            params.push(idFilter.val);
            const query = `UPDATE orders SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`;
            const updRes = await pg.query(query, params);
            res.statusCode = 200;
            return res.end(JSON.stringify(updRes.rows));
          }
        } catch (e: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: e.message }));
        }
      }

      const idFilter = parseFilterParam(url.searchParams.get('id'));
      const orgFilter = parseFilterParam(url.searchParams.get('organization_id'));
      try {
        let query = 'SELECT * FROM orders WHERE 1=1';
        const params: any[] = [];
        if (idFilter && idFilter.op === 'eq') {
          params.push(idFilter.val);
          query += ` AND id = $${params.length}`;
        }
        if (orgFilter && orgFilter.op === 'eq') {
          params.push(orgFilter.val);
          query += ` AND organization_id = $${params.length}`;
        }
        query += ' ORDER BY created_at DESC';

        const resDb = await pg.query(query, params);
        const rows = [];
        for (const o of resDb.rows) {
          const orgRes = await pg.query('SELECT name, slug, ticket_prefix, phone_1, phone_2, currency, address FROM organizations WHERE id = $1', [o.organization_id]);
          const itemsRes = await pg.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC', [o.id]);
          const paymentsRes = await pg.query('SELECT * FROM payments WHERE order_id = $1 ORDER BY collected_at ASC', [o.id]);

          rows.push({
            ...o,
            organization: orgRes.rows[0] || null,
            order_items: itemsRes.rows,
            payments: paymentsRes.rows,
          });
        }

        res.statusCode = 200;
        const acceptSingle = req.headers['accept']?.includes('vnd.pgrst.object+json');
        if (acceptSingle) {
          return res.end(JSON.stringify(rows[0] || null));
        }
        return res.end(JSON.stringify(rows));
      } catch (e: any) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    // REST Endpoint for order_payment_summary
    if (pathname.startsWith('/rest/v1/order_payment_summary')) {
      const orderIdFilter = parseFilterParam(url.searchParams.get('order_id'));
      try {
        let query = 'SELECT * FROM order_payment_summary WHERE 1=1';
        const params: any[] = [];
        if (orderIdFilter && orderIdFilter.op === 'eq') {
          params.push(orderIdFilter.val);
          query += ` AND order_id = $${params.length}`;
        }
        const resDb = await pg.query(query, params);
        res.statusCode = 200;
        const acceptSingle = req.headers['accept']?.includes('vnd.pgrst.object+json');
        if (acceptSingle) {
          return res.end(JSON.stringify(resDb.rows[0] || null));
        }
        return res.end(JSON.stringify(resDb.rows));
      } catch (e: any) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    // REST Endpoint for payments
    if (pathname.startsWith('/rest/v1/payments')) {
      if (req.method === 'POST') {
        const { organization_id, order_id, amount, method, collected_by, reference, notes, collected_at } = parsedBody;
        try {
          const insRes = await pg.query(
            `INSERT INTO payments (organization_id, order_id, amount, method, collected_by, reference, notes, collected_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [organization_id, order_id, amount, method, collected_by, reference || null, notes || null, collected_at || new Date().toISOString()]
          );
          res.statusCode = 201;
          return res.end(JSON.stringify(insRes.rows[0]));
        } catch (e: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: e.message }));
        }
      }

      const orgFilter = parseFilterParam(url.searchParams.get('organization_id'));
      const orderIdFilter = parseFilterParam(url.searchParams.get('order_id'));
      try {
        let query = 'SELECT * FROM payments WHERE 1=1';
        const params: any[] = [];
        if (orgFilter && orgFilter.op === 'eq') {
          params.push(orgFilter.val);
          query += ` AND organization_id = $${params.length}`;
        }
        if (orderIdFilter && orderIdFilter.op === 'eq') {
          params.push(orderIdFilter.val);
          query += ` AND order_id = $${params.length}`;
        }
        const resDb = await pg.query(query, params);
        res.statusCode = 200;
        const acceptSingle = req.headers['accept']?.includes('vnd.pgrst.object+json');
        if (acceptSingle) {
          return res.end(JSON.stringify(resDb.rows[0] || null));
        }
        return res.end(JSON.stringify(resDb.rows));
      } catch (e: any) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    // REST Endpoint for memberships
    if (pathname.startsWith('/rest/v1/memberships')) {
      if (req.method === 'POST') {
        const { user_id, organization_id, role, full_name, is_active } = parsedBody;
        try {
          const insertMem = await pg.query(
            `INSERT INTO memberships (user_id, organization_id, role, full_name, is_active)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [user_id, organization_id, role, full_name, is_active ?? true]
          );
          res.statusCode = 201;
          return res.end(JSON.stringify(insertMem.rows[0]));
        } catch (e: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: e.message }));
        }
      }

      const userIdFilter = parseFilterParam(url.searchParams.get('user_id'));
      try {
        let query = 'SELECT m.id, m.organization_id, m.role, m.full_name, m.phone, m.is_active, m.created_at, m.user_id FROM memberships m WHERE m.is_active = true';
        const params: any[] = [];
        if (userIdFilter && userIdFilter.op === 'eq') {
          params.push(userIdFilter.val);
          query += ` AND m.user_id = $${params.length}`;
        }
        query += ' ORDER BY m.created_at DESC';

        const resDb = await pg.query(query, params);
        const rows = [];
        for (const r of resDb.rows) {
          const orgRes = await pg.query('SELECT * FROM organizations WHERE id = $1', [r.organization_id]);
          rows.push({
            ...r,
            organization: orgRes.rows[0] || null,
          });
        }

        res.statusCode = 200;
        const acceptSingle = req.headers['accept']?.includes('vnd.pgrst.object+json');
        if (acceptSingle) {
          return res.end(JSON.stringify(rows[0] || null));
        }
        return res.end(JSON.stringify(rows));
      } catch (e: any) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    if (pathname.startsWith('/rest/v1/platform_admins')) {
      res.statusCode = 200;
      return res.end(JSON.stringify([]));
    }

    // Default fallback
    res.statusCode = 200;
    return res.end(JSON.stringify([]));
  });
});

server.listen(54321, () => {
  console.log('Local Supabase Dev Gateway listening on port 54321');
});
