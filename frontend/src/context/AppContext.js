import React, { createContext, useState, useCallback, useRef } from 'react';

export const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const notifCounter = useRef(0);

  const addTask = useCallback((task) => {
    setTasks((prev) => [task, ...prev]);
  }, []);

  const updateTask = useCallback((taskId, updates) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
  }, []);

  const addNotification = useCallback((notification) => {
    const id = ++notifCounter.current;
    const entry = { ...notification, id };
    setNotifications((prev) => [entry, ...prev]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, []);

  const addEvent = useCallback((event) => {
    setEvents((prev) => [{ ...event, receivedAt: new Date() }, ...prev].slice(0, 100));
  }, []);

  return (
    <AppContext.Provider
      value={{
        tasks,
        notifications,
        events,
        connected,
        setConnected,
        addTask,
        updateTask,
        addNotification,
        addEvent
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
