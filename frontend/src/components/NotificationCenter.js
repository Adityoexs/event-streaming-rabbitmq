import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';

const TYPE_ICONS = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️'
};

export default function NotificationCenter() {
  const { notifications } = useContext(AppContext);

  if (notifications.length === 0) return null;

  return (
    <div className="notification-center" aria-live="polite">
      {notifications.map((n) => (
        <div key={n.id} className={`notification notification-${n.type || 'info'}`}>
          <span className="notif-icon">{TYPE_ICONS[n.type] || 'ℹ️'}</span>
          <span className="notif-message">{n.message}</span>
        </div>
      ))}
    </div>
  );
}
