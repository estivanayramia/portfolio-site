/**
 * Error Monitoring API Endpoints
 * Handles error collection, storage, retrieval, and management
 */

/**
 * Bot detection using User-Agent and behavioral patterns
 */
function isBot(userAgent, ip, env) {
  if (!userAgent) return true;
  
  const ua = userAgent.toLowerCase();
  
  // Known bot signatures
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper',
    'headless', 'phantom', 'slurp', 'curl',
    'wget', 'python', 'java', 'go-http',
    'googlebot', 'bingbot', 'yahoo', 'baidu'
  ];
  
  return botPatterns.some(pattern => ua.includes(pattern));
}

/**
 * Rate limiting check using KV
 */
async function checkRateLimit(ip, env) {
  const key = `rate:${ip}`;
  const maxRequests = parseInt(env.RATE_LIMIT_MAX || '10');
  const window = parseInt(env.RATE_LIMIT_WINDOW || '60000'); // 60s
  
  try {
    const data = await env.SAVONIE_KV.get(key, 'json');
    const now = Date.now();
    
    if (!data) {
      await env.SAVONIE_KV.put(key, JSON.stringify({ count: 1, firstRequest: now }), {
        expirationTtl: Math.ceil(window / 1000)
      });
      return true;
    }
    
    // Reset if window expired
    if (now - data.firstRequest > window) {
      await env.SAVONIE_KV.put(key, JSON.stringify({ count: 1, firstRequest: now }), {
        expirationTtl: Math.ceil(window / 1000)
      });
      return true;
    }
    
    // Increment count
    if (data.count >= maxRequests) {
      return false; // Rate limit exceeded
    }
    
    data.count++;
    await env.SAVONIE_KV.put(key, JSON.stringify(data), {
      expirationTtl: Math.ceil(window / 1000)
    });
    return true;
    
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return true; // Failopen on error
  }
}

/**
 * POST /api/error-report - Collect errors from clients
 */
async function handleErrorReport(request, env, corsHeaders) {
  try {
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || '';
    
    // Bot detection
    const isLikelyBot = isBot(userAgent, clientIP, env);
    
    // Rate limiting
    const withinLimit = await checkRateLimit(clientIP, env);
    if (!withinLimit) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const body = await request.json();
    const { type, message, filename, line, col, stack, url, viewport, version } = body;
    
    // Validate required fields
    if (!type || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Auto-categorize based on error type
    let category = 'uncategorized';
    const lowerMsg = (message || '').toLowerCase();
    if (lowerMsg.includes('404') || lowerMsg.includes('not found')) {
      category = 'navigation';
    } else if (type === 'network_error') {
      category = 'connectivity';
    } else if (type === 'javascript_error') {
      category = 'code_bug';
    } else if (type === 'unhandled_rejection') {
      category = 'async_bug';
    }
    
    // Store in D1 database
    const stmt = env.DB.prepare(`
      INSERT INTO errors (type, message, filename, line, col, stack, url, user_agent, viewport, version, timestamp, category, status, is_bot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    await stmt.bind(
      type,
      message?.slice(0, 1000),
      filename?.slice(0, 500),
      line || null,
      col || null,
      stack?.slice(0, 2000),
      url?.slice(0, 500),
      userAgent?.slice(0, 500),
      viewport,
      version,
      Date.now(),
      category,
      'new',
      isLikelyBot ? 1 : 0
    ).run();
    
    return new Response(JSON.stringify({ success: true }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error storing report:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/auth - Simple password authentication
 */
async function handleAuth(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { password } = body;
    
    if (password === env.DASHBOARD_PASSWORD_HASH) {
      // Generate simple session token (timestamp-based)
      const token = Buffer.from(`${Date.now()}:${password}`).toString('base64');
      
      return new Response(JSON.stringify({ success: true, token }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Bad request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Verify authentication token
 */
function verifyAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const [timestamp, password] = decoded.split(':');
    
    // Check password matches
    if (password !== env.DASHBOARD_PASSWORD_HASH) {
      return false;
    }
    
    // Check token age (24 hour expiry)
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > 86400000) { // 24 hours
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * GET /api/errors - Fetch errors (auth required)
 */
async function handleGetErrors(request, env, corsHeaders) {
  if (!verifyAuth(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || null;
    const category = url.searchParams.get('category') || null;
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    let query = 'SELECT * FROM errors WHERE 1=1';
    const bindings = [];
    
    if (status) {
      query += ' AND status = ?';
      bindings.push(status);
    }
    
    if (category) {
      query += ' AND category = ?';
      bindings.push(category);
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);
    
    const stmt = env.DB.prepare(query);
    const { results } = await stmt.bind(...bindings).all();
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM errors WHERE 1=1';
    const countBindings = [];
    if (status) {
      countQuery += ' AND status = ?';
      countBindings.push(status);
    }
    if (category) {
      countQuery += ' AND category = ?';
      countBindings.push(category);
    }
    
    const countStmt = env.DB.prepare(countQuery);
    const { results: countResults } = await countStmt.bind(...countBindings).all();
    const total = countResults[0]?.total || 0;
    
    return new Response(JSON.stringify({
      errors: results,
      total,
      limit,
      offset
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error fetching errors:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PATCH /api/errors/:id - Update error (auth required)
 */
async function handleUpdateError(request, env, corsHeaders, errorId) {
  if (!verifyAuth(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const body = await request.json();
    const { category, status } = body;
    
    const updates = [];
    const bindings = [];
    
    if (category) {
      updates.push('category = ?');
      bindings.push(category);
    }
    
    if (status) {
      updates.push('status = ?');
      bindings.push(status);
    }
    
    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No updates provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    bindings.push(errorId);
    
    const query = `UPDATE errors SET ${updates.join(', ')} WHERE id = ?`;
    const stmt = env.DB.prepare(query);
    await stmt.bind(...bindings).run();
    
    // Auto-delete if marked as resolved
    if (status === 'resolved') {
      const deleteStmt = env.DB.prepare('DELETE FROM errors WHERE id = ?');
      await deleteStmt.bind(errorId).run();
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error updating error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * DELETE /api/errors/:id - Delete error (auth required)
 */
async function handleDeleteError(request, env, corsHeaders, errorId) {
  if (!verifyAuth(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const stmt = env.DB.prepare('DELETE FROM errors WHERE id = ?');
    await stmt.bind(errorId).run();
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error deleting error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Export handlers for integration into main worker
export {
  handleErrorReport,
  handleAuth,
  handleGetErrors,
  handleUpdateError,
  handleDeleteError
};
