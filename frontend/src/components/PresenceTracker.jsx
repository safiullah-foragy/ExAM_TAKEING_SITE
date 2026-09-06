import { useEffect } from 'react';
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export default function PresenceTracker() {
  useEffect(() => {
    const getToken = () => localStorage.getItem('adminToken') || localStorage.getItem('token');

    const sendHeartbeat = async () => {
      const token = getToken();
      if (!token) return;
      try {
        await axios.post(
          `${BASE_URL}/api/chat/heartbeat`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch {
        // silent fail on network glitch
      }
    };

    const sendOffline = () => {
      const token = getToken();
      if (!token) return;
      const url = `${BASE_URL}/api/chat/offline`;

      // Modern fetch with keepalive ensures the request outlives the page unload
      if (typeof fetch !== 'undefined') {
        try {
          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ token }),
            keepalive: true,
          }).catch(() => {});
          return;
        } catch {
          // fallback to sendBeacon below
        }
      }

      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        try {
          const blob = new Blob([JSON.stringify({ token })], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        } catch {}
      }
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
