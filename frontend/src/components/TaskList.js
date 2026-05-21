import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';

const STATUS_LABELS = {
  queued: { label: 'Queued', cls: 'status-queued' },
  processing: { label: 'Processing…', cls: 'status-processing' },
  completed: { label: 'Completed', cls: 'status-completed' },
  failed: { label: 'Failed', cls: 'status-failed' }
};

export default function TaskList() {
  const { tasks } = useContext(AppContext);

  return (
    <section className="card task-list">
      <h2>Tasks <span className="badge">{tasks.length}</span></h2>
      {tasks.length === 0 ? (
        <p className="empty-state">No tasks yet — submit one above!</p>
      ) : (
        <ul className="tasks">
          {tasks.map((task) => {
            const { label, cls } = STATUS_LABELS[task.status] || { label: task.status, cls: '' };
            return (
              <li key={task.id} className={`task-item ${cls}`}>
                <div className="task-meta">
                  <span className="task-id" title={task.id}>
                    #{task.id.substring(0, 8)}
                  </span>
                  <span className={`task-status-badge ${cls}`}>{label}</span>
                </div>
                <div className="task-data">{task.data}</div>
                {task.result && <div className="task-result">↳ {task.result}</div>}
                <div className="task-time">
                  {new Date(task.createdAt).toLocaleTimeString()}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
