import { io } from 'socket.io-client';

const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '/';

export const socket = io(SOCKET_URL, {
  withCredentials: true,
  autoConnect: true,
  reconnectionAttempts: 5
});

/**
 * Subscribe to multiple events with a single hook-like function
 */
export const useSocketEvents = (eventMap) => {
  // This is a helper, usage: useSocketEvents({ 'event': handler })
  // In React, it's better to use useEffect inside components.
};

socket.on('connect', () => {
  console.log('🔌 Connected to CipherNest Socket Server');
});

socket.on('disconnect', () => {
  console.log('🔌 Disconnected from Socket Server');
});

export default socket;
