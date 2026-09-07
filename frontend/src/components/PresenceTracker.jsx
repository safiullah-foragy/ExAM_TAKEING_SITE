import { useEffect } from 'react';
import axios from 'axios';
import { API_ORIGIN } from '../utils/api';

const BASE_URL = API_ORIGIN || 'http://localhost:5000';

export default function PresenceTracker() {
  useEffect(() => {
    const getActiveTokens = () => {
      const tokens = [];
      const adminToken = localStorage.getItem('adminToken');
      const userToken = localStorage.getItem('token');
      if (adminToken) tokens.push(adminToken);
      if (userToken) tokens.push(userToken);
      return tokens;
    };

    const sendHeartbeat = async () => {
      const tokens = getActiveTokens();
      tokens.forEach((t) => {
        axios
          .post(`${BASE_URL}/api/chat/heartbeat`, {}, { headers: { Authorization: `Bearer ${t}` } })
          .catch(() => {});
      });
    };

    const sendOffline = () => {
      const tokens = getActiveTokens();
      tokens.forEach((t) => {
        const url = `${BASE_URL}/api/chat/offline`;
        if (typeof fetch !== 'undefined') {
          try {
            fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${t}`,
              },
              body: JSON.stringify({ token: t }),
              keepalive: true,
            }).catch(() => {});
            return;
          } catch {}
        }
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          try {
            const blob = new Blob([JSON.stringify({ token: t })], { type: 'application/json' });
            navigator.sendBeacon(url, blob);
          } catch {}
        }
      });
    };

    // 1. Send immediate heartbeat as soon as user opens the site
    sendHeartbeat();

    // 2. Periodic heartbeat every 20s while on site
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    }, 20000);

    // 3. User becomes active / switches back to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };

    // 4. User closes tab / browser or navigates away
    const handlePageHide = () => {
      sendOffline();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      sendOffline();
    };
  }, []);

  return null;
}
