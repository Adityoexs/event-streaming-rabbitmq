import React, { useEffect, useContext } from 'react';
import socketService from './services/socketService';
import { AppContext } from './context/AppContext';
import NotificationCenter from './components/NotificationCenter';
import TaskSubmitter from './components/TaskSubmitter';
import TaskList from './components/TaskList';
import EventFeed from './components/EventFeed';
import './App.css';

export default function App() {
  const { connected, setConnected, addNotification, updateTask, addEvent } =
    useContext(AppContext);

  useEffect(() => {
    const socket = socketService.connect();

    socket.on('connect', () => {
      setConnected(true);
      addNotification({ message: 'Connected to server', type: 'success' });
    });

    socket.on('disconnect', () => {
      setConnected(false);
      addNotification({ message: 'Disconnected from server — reconnecting…', type: 'error' });
    });

    socket.on('task:status', ({ taskId, status }) => {
      updateTask(taskId, { status });
    });

    socket.on('task:completed', ({ taskId, status, result }) => {
      updateTask(taskId, { status, result });
      addNotification({ message: `Task completed: ${result}`, type: 'success' });
    });

    socket.on('notification', (notification) => {
      addNotification({ message: notification.message, type: notification.type || 'info' });
    });

    socket.on('event', (event) => {
      addEvent(event);
    });

    return () => {
      socketService.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🐇 RabbitMQ Event Streaming</h1>
        <div className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '● Connected' : '○ Disconnected'}
        </div>
      </header>

      <NotificationCenter />

      <main className="app-main">
        <div className="column">
          <TaskSubmitter />
          <TaskList />
        </div>
        <div className="column">
          <EventFeed />
        </div>
      </main>
    </div>
  );
}
