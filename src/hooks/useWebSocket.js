import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * A highly resilient WebSocket hook for ChronoShift.
 * Supports automatic reconnection with exponential backoff, heartbeats, and safe state tracking.
 */
export function useWebSocket(timelineId, onMessageCallback) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectDelayRef = useRef(1000); // Start reconnect delay at 1s
  const maxReconnectDelay = 30000; // Max reconnect delay 30s

  const connect = useCallback(() => {
    if (!timelineId) return;

    // Clean up previous socket if exists
    if (socketRef.current) {
      socketRef.current.close();
    }

    const baseApiUrl = import.meta.env.VITE_DJANGO_API_URL || 'http://127.0.0.1:8000';
    const wsBaseUrl = baseApiUrl.replace(/^http/, 'ws');
    const wsUrl = `${wsBaseUrl}/ws/timeline/${timelineId}`;
    console.log(`[WebSocket] Connecting to ${wsUrl}...`);
    
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log(`[WebSocket] Connection established for timeline: ${timelineId}`);
      setIsConnected(true);
      reconnectDelayRef.current = 1000; // Reset delay on successful connection

      // Set up keep-alive heartbeat ping every 10 seconds to keep Daphne ASGI alive
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 10000);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'pong') {
          // Heartbeat answer from ASGI consumer
          return;
        }
        if (onMessageCallback) {
          onMessageCallback(payload);
        }
      } catch (err) {
        console.error('[WebSocket] Error parsing incoming message:', err);
      }
    };

    ws.onclose = (event) => {
      console.log(`[WebSocket] Disconnected from timeline ${timelineId} (code: ${event.code})`);
      setIsConnected(false);
      cleanupHeartbeat();

      // Trigger automatic reconnection if it wasn't closed intentionally
      if (event.code !== 1000) {
        scheduleReconnect();
      }
    };

    ws.onerror = (err) => {
      console.error('[WebSocket] Socket error observed:', err);
      ws.close();
    };
  }, [timelineId, onMessageCallback]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) return;

    const delay = reconnectDelayRef.current;
    console.log(`[WebSocket] Scheduling reconnection in ${delay}ms...`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      // Exponential backoff
      reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, maxReconnectDelay);
      connect();
    }, delay);
  }, [connect]);

  const cleanupHeartbeat = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  };

  const cleanupReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    connect();

    return () => {
      cleanupHeartbeat();
      cleanupReconnect();
      if (socketRef.current) {
        socketRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [timelineId, connect]);

  const sendMessage = useCallback((payload) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
      return true;
    }
    console.warn('[WebSocket] Cannot send message, socket is closed');
    return false;
  }, []);

  return { isConnected, sendMessage };
}
