/**
 * BlackRoad Alfred - Cloudflare Worker
 * Handles long-running tasks, health checks, and API routing
 *
 * Copyright (c) 2024-2026 BlackRoad OS, Inc. All Rights Reserved.
 * Proprietary and Confidential.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // Health check endpoint
      if (path === '/api/health') {
        return Response.json(
          {
            status: 'ok',
            service: 'blackroad-alfred',
            timestamp: new Date().toISOString(),
            version: env.VERSION || '1.0.0',
          },
          { headers: corsHeaders }
        );
      }

      // Task queue endpoint for longer-running operations
      if (path === '/api/tasks' && request.method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || authHeader !== `Bearer ${env.API_SECRET}`) {
          return Response.json(
            { error: 'Unauthorized' },
            { status: 401, headers: corsHeaders }
          );
        }

        const body = await request.json();
        const taskId = crypto.randomUUID();

        // Store task in KV for tracking
        if (env.TASKS_KV) {
          await env.TASKS_KV.put(
            `task:${taskId}`,
            JSON.stringify({
              id: taskId,
              type: body.type,
              status: 'queued',
              createdAt: new Date().toISOString(),
              payload: body.payload,
            }),
            { expirationTtl: 86400 } // 24h TTL
          );
        }

        // Dispatch to queue for async processing
        if (env.TASK_QUEUE) {
          ctx.waitUntil(
            env.TASK_QUEUE.send({
              taskId,
              type: body.type,
              payload: body.payload,
            })
          );
        }

        return Response.json(
          { taskId, status: 'queued' },
          { status: 202, headers: corsHeaders }
        );
      }

      // Get task status
      if (path.startsWith('/api/tasks/') && request.method === 'GET') {
        const taskId = path.split('/api/tasks/')[1];
        if (env.TASKS_KV) {
          const task = await env.TASKS_KV.get(`task:${taskId}`, 'json');
          if (task) {
            return Response.json(task, { headers: corsHeaders });
          }
        }
        return Response.json(
          { error: 'Task not found' },
          { status: 404, headers: corsHeaders }
        );
      }

      // Deployment webhook
      if (path === '/api/webhook/deploy' && request.method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || authHeader !== `Bearer ${env.WEBHOOK_SECRET}`) {
          return Response.json(
            { error: 'Unauthorized' },
            { status: 401, headers: corsHeaders }
          );
        }

        const payload = await request.json();
        console.log('Deploy webhook received:', JSON.stringify(payload));

        return Response.json(
          { received: true, timestamp: new Date().toISOString() },
          { headers: corsHeaders }
        );
      }

      // Stripe webhook
      if (path === '/api/webhook/stripe' && request.method === 'POST') {
        const signature = request.headers.get('stripe-signature');
        if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
          return Response.json(
            { error: 'Missing signature' },
            { status: 400, headers: corsHeaders }
          );
        }

        const body = await request.text();
        console.log('Stripe webhook received');

        return Response.json(
          { received: true },
          { headers: corsHeaders }
        );
      }

      // Default 404
      return Response.json(
        {
          error: 'Not found',
          service: 'blackroad-alfred',
          availableEndpoints: [
            'GET  /api/health',
            'POST /api/tasks',
            'GET  /api/tasks/:id',
            'POST /api/webhook/deploy',
            'POST /api/webhook/stripe',
          ],
        },
        { status: 404, headers: corsHeaders }
      );
    } catch (err) {
      console.error('Worker error:', err.message);
      return Response.json(
        { error: 'Internal server error' },
        { status: 500, headers: corsHeaders }
      );
    }
  },

  // Queue consumer for long-running tasks
  async queue(batch, env) {
    for (const message of batch.messages) {
      const { taskId, type, payload } = message.body;
      console.log(`Processing task ${taskId} (type: ${type})`);

      try {
        if (env.TASKS_KV) {
          await env.TASKS_KV.put(
            `task:${taskId}`,
            JSON.stringify({
              id: taskId,
              type,
              status: 'processing',
              updatedAt: new Date().toISOString(),
              payload,
            }),
            { expirationTtl: 86400 }
          );
        }

        // Process based on task type
        let result;
        switch (type) {
          case 'deploy':
            result = { deployed: true };
            break;
          case 'analyze':
            result = { analyzed: true };
            break;
          default:
            result = { processed: true };
        }

        if (env.TASKS_KV) {
          await env.TASKS_KV.put(
            `task:${taskId}`,
            JSON.stringify({
              id: taskId,
              type,
              status: 'completed',
              completedAt: new Date().toISOString(),
              result,
            }),
            { expirationTtl: 86400 }
          );
        }

        message.ack();
      } catch (err) {
        console.error(`Task ${taskId} failed:`, err.message);

        if (env.TASKS_KV) {
          await env.TASKS_KV.put(
            `task:${taskId}`,
            JSON.stringify({
              id: taskId,
              type,
              status: 'failed',
              error: err.message,
              failedAt: new Date().toISOString(),
            }),
            { expirationTtl: 86400 }
          );
        }

        message.retry();
      }
    }
  },

  // Scheduled CRON handler
  async scheduled(event, env, ctx) {
    console.log('Scheduled task running:', event.cron);

    // Periodic health self-check
    if (env.DEPLOY_URL) {
      try {
        const response = await fetch(`${env.DEPLOY_URL}/api/health`);
        if (!response.ok) {
          console.error('Self-health check failed:', response.status);
        }
      } catch (err) {
        console.error('Self-health check error:', err.message);
      }
    }
  },
};
