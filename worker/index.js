// Combined Worker: Chatbot + Error Collection API
// Imports the main chatbot worker and adds error collection endpoints

import * as ChatWorker from './worker.js';
import {
  handleErrorReport,
  handleAuth,
  handleGetErrors,
  handleUpdateError,
  handleDeleteError
} from './error-api.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle OPTIONS requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Error Collection API Routes
    if (pathname.startsWith('/api/errors') || pathname === '/api/auth') {
      try {
        // POST /api/errors - Submit error
        if (pathname === '/api/errors' && request.method === 'POST') {
          return await handleErrorReport(request, env, corsHeaders);
        }

        // POST /api/auth - Authenticate
        if (pathname === '/api/auth' && request.method === 'POST') {
          return await handleAuth(request, env, corsHeaders);
        }

        // GET /api/errors - Get errors (requires auth)
        if (pathname === '/api/errors' && request.method === 'GET') {
          return await handleGetErrors(request, env, corsHeaders);
        }

        // PATCH /api/errors/:id - Update error (requires auth)
        const patchMatch = pathname.match(/^\/api\/errors\/(\d+)$/);
        if (patchMatch && request.method === 'PATCH') {
          return await handleUpdateError(request, env, corsHeaders, parseInt(patchMatch[1]));
        }

        // DELETE /api/errors/:id - Delete error (requires auth)
        const deleteMatch = pathname.match(/^\/api\/errors\/(\d+)$/);
        if (deleteMatch && request.method === 'DELETE') {
          return await handleDeleteError(request, env, corsHeaders, parseInt(deleteMatch[1]));
        }

        // Unknown error API route
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Error API error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Health check
    if (pathname === '/api/health') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        timestamp: Date.now(),
        version: 'v2026.01.26-error-collection'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // All other routes go to the chatbot worker
    return ChatWorker.default.fetch(request, env, ctx);
  }
};
