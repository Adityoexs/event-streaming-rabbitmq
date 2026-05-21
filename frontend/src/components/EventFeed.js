import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AppContext } from '../context/AppContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function EventFeed() {
  const { events, addNotification } = useContext(AppContext);
  const [eventType, setEventType] = useState('');
  const [eventData, setEventData] = useState('');
  const [publishing, setPublishing] = useState(false);

  const handlePublish = async (e) => {
    e.preventDefault();
    const type = eventType.trim();
    if (!type) return;

    let parsedData;
    try {
      parsedData = eventData.trim() ? JSON.parse(eventData) : {};
    } catch {
      addNotification({ message: 'Event data must be valid JSON', type: 'error' });
      return;
    }

    setPublishing(true);
    try {
      await axios.post(`${API_URL}/api/publish-event`, { eventType: type, data: parsedData });
      addNotification({ message: `Event "${type}" published`, type: 'success' });
      setEventData('');
    } catch {
      addNotification({ message: 'Failed to publish event', type: 'error' });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <section className="card event-feed">
      <h2>Event Stream <span className="badge">{events.length}</span></h2>

      <form onSubmit={handlePublish} className="event-form">
        <input
          className="task-input"
          type="text"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          placeholder="Event type (e.g. order.created)"
          aria-label="Event type"
          disabled={publishing}
        />
        <input
          className="task-input"
          type="text"
          value={eventData}
          onChange={(e) => setEventData(e.target.value)}
          placeholder='Payload JSON (e.g. {"id":1})'
          aria-label="Event payload"
          disabled={publishing}
        />
        <button
          className="btn btn-secondary"
          type="submit"
          disabled={publishing || !eventType.trim()}
        >
          {publishing ? 'Publishing…' : 'Publish Event'}
        </button>
      </form>

      {events.length === 0 ? (
        <p className="empty-state">No events received yet.</p>
      ) : (
        <ul className="event-list">
          {events.map((ev) => (
            <li key={`${ev.type}-${new Date(ev.receivedAt).getTime()}`} className="event-item">
              <span className="event-type">{ev.type}</span>
              <span className="event-data">{JSON.stringify(ev.data)}</span>
              <span className="event-time">
                {new Date(ev.receivedAt).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
