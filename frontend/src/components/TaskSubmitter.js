import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AppContext } from '../context/AppContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function TaskSubmitter() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { addTask, addNotification } = useContext(AppContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/tasks`, { data: trimmed });
      addTask({
        id: data.taskId,
        data: trimmed,
        status: 'queued',
        createdAt: new Date().toISOString()
      });
      addNotification({ message: 'Task submitted successfully', type: 'success' });
      setInput('');
    } catch {
      addNotification({ message: 'Failed to submit task', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card task-submitter">
      <h2>Submit Task</h2>
      <form onSubmit={handleSubmit} className="task-form">
        <input
          className="task-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter task data…"
          disabled={loading}
          aria-label="Task data"
        />
        <button className="btn btn-primary" type="submit" disabled={loading || !input.trim()}>
          {loading ? 'Submitting…' : 'Submit Task'}
        </button>
      </form>
    </section>
  );
}
