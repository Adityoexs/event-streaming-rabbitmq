'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const amqplib = require('amqplib');
const cors = require('cors');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST']
  }
});

app.use(express.json());
app.use(cors({ origin: CORS_ORIGIN }));

// ─── RabbitMQ State ───────────────────────────────────────────────────────────
let channel = null;
let connection = null;
const tasks = new Map(); // taskId → task object

const EXCHANGES = {
  NOTIFICATIONS: 'notifications', // fanout  – broadcast to all
  EVENTS: 'events',               // topic   – routable event streams
  TASKS: 'tasks'                  // direct  – point-to-point task dispatch
};

const QUEUES = {
  TASKS: 'tasks_queue',
  NOTIFICATIONS: 'notifications_queue'
};

// ─── RabbitMQ Setup ───────────────────────────────────────────────────────────
async function connectRabbitMQ() {
  try {
    const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
    connection = await amqplib.connect(url);
    channel = await connection.createChannel();

    // Exchanges
    await channel.assertExchange(EXCHANGES.NOTIFICATIONS, 'fanout', { durable: true });
    await channel.assertExchange(EXCHANGES.EVENTS, 'topic', { durable: true });
    await channel.assertExchange(EXCHANGES.TASKS, 'direct', { durable: true });

    // Durable queues
    await channel.assertQueue(QUEUES.TASKS, { durable: true });
    await channel.assertQueue(QUEUES.NOTIFICATIONS, { durable: true });

    // Bindings
    await channel.bindQueue(QUEUES.TASKS, EXCHANGES.TASKS, 'task.new');
    await channel.bindQueue(QUEUES.NOTIFICATIONS, EXCHANGES.NOTIFICATIONS, '');

    console.log('✓ Connected to RabbitMQ');

    consumeTaskMessages();
    consumeNotifications();

    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err.message);
      scheduleReconnect();
    });

    connection.on('close', () => {
      console.warn('RabbitMQ connection closed, reconnecting…');
      scheduleReconnect();
    });
  } catch (err) {
    console.error('✗ RabbitMQ connection failed:', err.message);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  channel = null;
  connection = null;
  setTimeout(connectRabbitMQ, 5000);
}

// ─── Task Consumer ────────────────────────────────────────────────────────────
async function consumeTaskMessages() {
  try {
    await channel.prefetch(1);

    channel.consume(QUEUES.TASKS, async (msg) => {
      if (!msg) return;
      try {
        const task = JSON.parse(msg.content.toString());
        console.log('Processing task:', task.id);

        // Mark processing
        tasks.set(task.id, { ...task, status: 'processing', updatedAt: new Date() });
        io.emit('task:status', { taskId: task.id, status: 'processing' });

        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, TASK_PROCESSING_DELAY_MS));

        // Mark completed
        const result = `Processed: ${task.data}`;
        tasks.set(task.id, {
          ...task,
          status: 'completed',
          result,
          completedAt: new Date()
        });

        io.emit('task:completed', { taskId: task.id, status: 'completed', result });

        channel.ack(msg);
      } catch (err) {
        console.error('Error processing task:', err.message);
        channel.nack(msg, false, true);
      }
    }, { noAck: false });
  } catch (err) {
    console.error('Error setting up task consumer:', err.message);
  }
}

// ─── Notification Consumer ────────────────────────────────────────────────────
async function consumeNotifications() {
  try {
    const { queue } = await channel.assertQueue('', { exclusive: true });
    await channel.bindQueue(queue, EXCHANGES.NOTIFICATIONS, '');

    channel.consume(queue, (msg) => {
      if (!msg) return;
      try {
        const notification = JSON.parse(msg.content.toString());
        io.emit('notification', notification);
        channel.ack(msg);
      } catch (err) {
        console.error('Error processing notification:', err.message);
        channel.nack(msg, false, false);
      }
    });
  } catch (err) {
    console.error('Error setting up notification consumer:', err.message);
  }
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.emit('connection:established', {
    message: 'Connected to RabbitMQ event-streaming server',
    timestamp: new Date()
  });

  socket.on('subscribe:events', (eventType) => {
    socket.join(`event:${eventType}`);
    socket.emit('subscribed', { event: eventType });
    console.log(`Socket ${socket.id} subscribed to event:${eventType}`);
  });

  socket.on('unsubscribe:events', (eventType) => {
    socket.leave(`event:${eventType}`);
    socket.emit('unsubscribed', { event: eventType });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ─── REST API ─────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    rabbitmq: channel ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

// Submit a new task
app.post('/api/tasks', async (req, res) => {
  if (!channel) {
    return res.status(503).json({ error: 'RabbitMQ not connected' });
  }
  try {
    const taskId = uuidv4();
    const task = {
      id: taskId,
      data: req.body.data || '',
      status: 'queued',
      createdAt: new Date()
    };

    tasks.set(taskId, task);

    channel.publish(
      EXCHANGES.TASKS,
      'task.new',
      Buffer.from(JSON.stringify(task)),
      { persistent: true }
    );

    res.status(201).json({ taskId, status: 'queued' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get task status
app.get('/api/tasks/:taskId', (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(task);
});

// List all tasks
app.get('/api/tasks', (_req, res) => {
  res.json(Array.from(tasks.values()));
});

// Publish a topic event
app.post('/api/publish-event', async (req, res) => {
  if (!channel) {
    return res.status(503).json({ error: 'RabbitMQ not connected' });
  }
  try {
    const { eventType, data } = req.body;
    if (!eventType) {
      return res.status(400).json({ error: 'eventType is required' });
    }

    channel.publish(
      EXCHANGES.EVENTS,
      eventType,
      Buffer.from(JSON.stringify(data || {})),
      { persistent: true }
    );

    // Also push to subscribed Socket.IO rooms
    io.to(`event:${eventType}`).emit('event', { type: eventType, data, timestamp: new Date() });

    res.json({ success: true, eventType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Broadcast a notification to all connected clients
app.post('/api/broadcast-notification', async (req, res) => {
  if (!channel) {
    return res.status(503).json({ error: 'RabbitMQ not connected' });
  }
  try {
    const { message, type = 'info' } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const notification = { message, type, timestamp: new Date() };

    channel.publish(
      EXCHANGES.NOTIFICATIONS,
      '',
      Buffer.from(JSON.stringify(notification)),
      { persistent: true }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
async function shutdown() {
  console.log('\nShutting down gracefully…');
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
  } catch (_) { /* ignore */ }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const TASK_PROCESSING_DELAY_MS = parseInt(process.env.TASK_PROCESSING_DELAY_MS || '2000', 10);
server.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  await connectRabbitMQ();
});

module.exports = { app, server }; // for testing
