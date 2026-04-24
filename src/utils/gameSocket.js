import { io } from 'socket.io-client';
import { SERVER_URL } from './api';

let socket = null;

export const getSocket = () => {
  if (socket && socket.connected) return socket;
  if (!socket) {
    socket = io(SERVER_URL, { transports: ['websocket', 'polling'], autoConnect: true });
  } else if (!socket.connected) {
    socket.connect();
  }
  return socket;
};

// Subscribe to a game event; returns an unsubscribe function
export const onGameEvent = (event, handler) => {
  const s = getSocket();
  s.on(event, handler);
  return () => s.off(event, handler);
};
