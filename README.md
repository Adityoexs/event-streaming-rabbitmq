# 🐇 RabbitMQ Event Streaming with React

A full-stack real-time messaging application demonstrating RabbitMQ integration with a React frontend via a Node.js/Express backend and Socket.IO WebSocket bridge.

---

## Architecture

```
React (Browser)
    ↕  Socket.IO (WebSocket)
Node.js / Express (Backend)
    ↕  AMQP (amqplib)
RabbitMQ Message Broker
```

### Exchanges & Queues

| Exchange        | Type    | Purpose                          |
|-----------------|---------|----------------------------------|
| `notifications` | fanout  | Broadcast notifications to all   |
| `events`        | topic   | Routable event streams           |
| `tasks`         | direct  | Point-to-point task dispatch     |

| Queue               | Bound to           | Routing key |
|---------------------|--------------------|-------------|
| `tasks_queue`       | `tasks` exchange   | `task.new`  |
| `notifications_queue` | `notifications` exchange | `""` (fanout) |

---

## Features

| Feature | Description |
|---------|-------------|
| **Real-time notifications** | Server broadcasts messages to all connected Socket.IO clients |
| **Event streaming** | Publish/subscribe to topic-routed events; clients subscribe via `subscribe:events` |
| **Task queue** | Submit tasks via REST API → persisted in RabbitMQ → processed asynchronously |
| **Task status tracking** | Live task state updates (`queued → processing → completed`) via WebSocket |
| **Auto-reconnect** | Both the backend (to RabbitMQ) and frontend (Socket.IO) reconnect automatically |
| **Graceful shutdown** | Backend closes RabbitMQ channels on SIGINT/SIGTERM |

---

## Project Structure

```
.
├── backend/
│   ├── server.js          # Express + Socket.IO + RabbitMQ
│   ├── package.json
│   ├── .env.example       # Environment template
│   └── .gitignore
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── EventFeed.js          # Event stream + publish form
│   │   │   ├── NotificationCenter.js # Toast notifications
│   │   │   ├── TaskList.js           # Live task status list
│   │   │   └── TaskSubmitter.js      # Task submission form
│   │   ├── context/
│   │   │   └── AppContext.js         # React Context for global state
│   │   ├── services/
│   │   │   └── socketService.js      # Socket.IO client wrapper
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
├── docker-compose.yml     # RabbitMQ + Management UI
└── README.md
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 16
- [Docker](https://www.docker.com/) & Docker Compose

---

## Quick Start

### 1 — Start RabbitMQ

```bash
docker-compose up -d
```

RabbitMQ Management UI will be available at <http://localhost:15672> (user: `guest`, pass: `guest`).

### 2 — Backend

```bash
cd backend
cp .env.example .env   # edit if needed
npm install
npm run dev            # uses nodemon; or: npm start
```

The server starts at <http://localhost:5000>.

### 3 — Frontend

```bash
cd frontend
npm install
npm start
```

The React app opens at <http://localhost:3000>.

---

## Environment Variables

### `backend/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672` | RabbitMQ AMQP connection URL |
| `PORT` | `5000` | Express server port |
| `NODE_ENV` | `development` | Node environment |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |
| `TASK_PROCESSING_DELAY_MS` | `2000` | Simulated worker processing time (ms) |

### `frontend` (optional `.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `REACT_APP_API_URL` | `http://localhost:5000` | Backend REST base URL |
| `REACT_APP_SOCKET_URL` | `http://localhost:5000` | Socket.IO server URL |

---

## REST API Endpoints

### `GET /api/health`
Returns server and RabbitMQ connection status.

```json
{ "status": "ok", "rabbitmq": "connected", "uptime": 42.5 }
```

### `POST /api/tasks`
Submit a new task.

**Request body:**
```json
{ "data": "my task payload" }
```

**Response:**
```json
{ "taskId": "uuid", "status": "queued" }
```

### `GET /api/tasks/:taskId`
Get a task by ID.

### `GET /api/tasks`
List all tasks.

### `POST /api/publish-event`
Publish a topic event.

**Request body:**
```json
{ "eventType": "order.created", "data": { "orderId": 123 } }
```

### `POST /api/broadcast-notification`
Broadcast a notification to all connected clients.

**Request body:**
```json
{ "message": "System maintenance in 5 minutes", "type": "warning" }
```

---

## WebSocket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `subscribe:events` | `"order.created"` | Subscribe to a topic event |
| `unsubscribe:events` | `"order.created"` | Unsubscribe from a topic event |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `connection:established` | `{ message, timestamp }` | Emitted on connect |
| `task:status` | `{ taskId, status }` | Task moved to `processing` |
| `task:completed` | `{ taskId, status, result }` | Task finished |
| `notification` | `{ message, type, timestamp }` | Broadcast notification |
| `event` | `{ type, data, timestamp }` | Topic event pushed to subscribers |

---

## Usage Example (curl)

```bash
# Submit a task
curl -s -X POST http://localhost:5000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"data":"hello world"}'

# Broadcast a notification
curl -s -X POST http://localhost:5000/api/broadcast-notification \
  -H 'Content-Type: application/json' \
  -d '{"message":"Hello from the server!","type":"info"}'

# Publish a topic event
curl -s -X POST http://localhost:5000/api/publish-event \
  -H 'Content-Type: application/json' \
  -d '{"eventType":"order.created","data":{"orderId":42}}'
```

---

## Scaling Workers

To run multiple backend instances (workers), simply start additional Node.js processes. RabbitMQ's competing-consumers model on `tasks_queue` distributes tasks across all active workers automatically.

```bash
PORT=5001 node backend/server.js &
PORT=5002 node backend/server.js &
```

---

## License

MIT