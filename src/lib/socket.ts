import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,       // Limit reconnection attempts
  reconnectionDelay: 2000,       // Start with 2 second delay
  reconnectionDelayMax: 10000,   // Max delay 10 seconds
  timeout: 10000,                // Give up connection after 10 seconds
});

// Graceful error logging to prevent unhandled promise rejections or console spam
socket.on('connect_error', (err) => {
  console.warn('[socket]: Connection gracefully degraded.', err.message);
});

socket.on('disconnect', (reason) => {
  console.log('[socket]: Disconnected cleanly. Reason:', reason);
});

export const connectSocket = (institutionId: string) => {
  if (!socket.connected) {
    socket.connect();
  }
  socket.emit('join-institution', institutionId);
  console.log(`[socket]: Establishing secure channel to institution-${institutionId}`);
};

export const disconnectSocket = () => {
  socket.disconnect();
};

export const onNewIncident = (callback: (incident: any) => void) => {
  socket.on('new-incident', callback);
};

export const offNewIncident = (callback?: (incident: any) => void) => {
  if (callback) socket.off('new-incident', callback);
  else socket.off('new-incident');
};

export const onSOSAlert = (callback: (incident: any) => void) => {
  socket.on('sos-alert', callback);
};

export const offSOSAlert = (callback?: (incident: any) => void) => {
  if (callback) socket.off('sos-alert', callback);
  else socket.off('sos-alert');
};

export const onOfficerActivated = (callback: (data: { id: string, status: string }) => void) => {
  socket.on('officer-activated', callback);
};

export const offOfficerActivated = (callback?: (data: { id: string, status: string }) => void) => {
  if (callback) socket.off('officer-activated', callback);
  else socket.off('officer-activated');
};

export default socket;
