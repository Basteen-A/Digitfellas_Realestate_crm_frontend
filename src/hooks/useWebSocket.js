// ============================================================
// WebSocket Hook — Real-time notifications & lead updates
// ============================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

const WS_BASE = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') +
  (window.location.hostname) + ':' +
  (import.meta.env.VITE_WS_PORT || import.meta.env.VITE_API_PORT || '5000');

/**
 * useWebSocket hook — connects to backend WebSocket with JWT auth
 * 
 * Usage:
 *   const { isConnected, lastMessage, notifications, unreadCount } = useWebSocket({
 *     onNotification: (notif) => console.log('New notification:', notif),
 *     onLeadUpdate: (update) => console.log('Lead updated:', update),
 *   });
 */
export function useWebSocket({ onNotification, onLeadUpdate, onConnect, onDisconnect } = {}) {
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Get token from auth state
  const token = useSelector((state) => state.auth?.token);

  const connect = useCallback(() => {
    if (!token) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(`${WS_BASE}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          setLastMessage(msg);

          switch (msg.type) {
            case 'CONNECTED':
              console.log('[WS] Authenticated:', msg.payload?.userId);
              break;

            case 'NOTIFICATION':
              setNotifications((prev) => [msg.payload, ...prev].slice(0, 50));
              setUnreadCount((prev) => prev + 1);
              onNotification?.(msg.payload);
              break;

            case 'LEAD_UPDATE':
              onLeadUpdate?.(msg.payload);
              break;

            case 'PONG':
              // Heartbeat response
              break;

            default:
              console.log('[WS] Message:', msg.type, msg.payload);
          }
        } catch (e) {
          console.warn('[WS] Failed to parse message:', e);
        }
      };

      ws.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;
        onDisconnect?.();

        // Auto-reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts && token) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current += 1;
          console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };
    } catch (error) {
      console.error('[WS] Connection failed:', error);
    }
  }, [token, onNotification, onLeadUpdate, onConnect, onDisconnect]);

  // Send heartbeat every 30s to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'PING' }));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected]);

  // Connect when token is available
  useEffect(() => {
    if (token) {
      connect();
    }

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [token, connect]);

  // Mark notification as read locally
  const markAsRead = useCallback((notifId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  // Clear all notifications locally
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return {
    isConnected,
    lastMessage,
    notifications,
    unreadCount,
    setUnreadCount,
    markAsRead,
    clearAll,
  };
}

export default useWebSocket;
