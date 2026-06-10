/**
 * SafeCampus Notification Service
 *
 * Centralizes all socket.io room management and notification delivery.
 * Solves the race condition where join-user/join-institution was emitted
 * before the socket was actually connected, causing rooms to be missed.
 */

import socket from './socket';
import { toast } from 'sonner';

export type NotificationItem = {
  id: string | number;
  type: string;
  message: string;
  description?: string;
  time: Date;
  read: boolean;
  url: string;
};

type NotificationCallback = (notif: NotificationItem) => void;

// ── Internal state ──────────────────────────────────────────────────────────
let _userId: string | null = null;
let _institutionId: string | null = null;
let _role: string | null = null;
let _subscribers: NotificationCallback[] = [];
let _isSetup = false;

// ── Permission request ──────────────────────────────────────────────────────
export const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (e) {
      console.warn('[notifications]: Permission request failed', e);
    }
  }
};

// ── OS-level notification ───────────────────────────────────────────────────
const fireOsNotification = (title: string, body: string, url: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body,
        icon: '/favicon.ico',
        silent: false,
      });
      n.onclick = () => {
        window.focus();
        if (url) window.location.href = url;
        n.close();
      };
    } catch (e) {
      console.warn('[notifications]: OS Notification failed', e);
    }
  }
};

// ── Audio alert ─────────────────────────────────────────────────────────────
const SOUND_URL = 'https://cdn.pixabay.com/audio/2022/03/15/audio_78330a877a.mp3';

const playSound = () => {
  try {
    const audio = new Audio(SOUND_URL);
    const p = audio.play();
    if (p !== undefined) {
      p.catch(e =>
        console.warn('[notifications]: Audio autoplay blocked (user must interact first):', e.message)
      );
    }
  } catch (e) {
    console.warn('[notifications]: Audio error', e);
  }
};

// ── URL resolver ─────────────────────────────────────────────────────────────
const resolveUrl = (data: any): string => {
  const type = data.type || '';
  const incidentId = data.data?.incidentId || data.id;

  // Buddy notifications
  if (type.startsWith('BUDDY')) return '/buddies';

  // Alert notifications (campus-wide broadcasts)
  if (type === 'ALERT') {
    // All users go to their respective dashboard which shows alerts
    if (_role === 'SECURITY') return '/security/dashboard';
    if (_role === 'SCHOOL_ADMIN') return '/admin';
    return '/dashboard';
  }

  // Incident / SOS notifications
  if (type === 'NEW_INCIDENT' || type === 'SOS_ALERT' || type === 'INCIDENT_UPDATE') {
    if (incidentId) {
      // Deep link to map with incident selected
      return `/map?incident=${incidentId}`;
    }
    if (_role === 'SECURITY') return '/security/dashboard';
    if (_role === 'SCHOOL_ADMIN') return '/admin';
    return '/dashboard';
  }

  return '';
};

// ── Role-based visibility filter ─────────────────────────────────────────────
// Returns true if the current role should see this notification
const shouldShow = (type: string): boolean => {
  // SOS and general alerts go to everyone
  if (type === 'SOS_ALERT' || type === 'ALERT') return true;
  // New incident notifications — students don't need to see them (they go to dashboard)
  if (type === 'NEW_INCIDENT') return _role !== 'STUDENT';
  // Everything else — show to all
  return true;
};

// ── Main dispatch ─────────────────────────────────────────────────────────────
const dispatch = (data: any) => {
  console.log('[notifications]: Incoming socket event →', data);

  const type = data.type || 'ALERT';

  // Role-based filtering
  if (!shouldShow(type)) return;

  const url = resolveUrl(data);
  const isCritical = type === 'SOS_ALERT' || data.priority === 'CRITICAL';

  const notif: NotificationItem = {
    id: data.id || `${type}-${Date.now()}`,
    type,
    message: data.title || data.message || 'New notification',
    description: data.description || data.message,
    time: new Date(),
    read: false,
    url,
  };

  // 1. Notify all UI subscribers (Navbar state, etc.)
  _subscribers.forEach(fn => fn(notif));

  // 2. Play sound
  playSound();

  // 3. OS notification (always fire for critical; otherwise only if tab is hidden)
  if (document.hidden || isCritical || type.startsWith('BUDDY')) {
    fireOsNotification(notif.message, notif.description || '', url);
  }

  // 4. In-app toast
  if (isCritical) {
    toast.error(`🚨 ${notif.message}`, {
      description: notif.description,
      duration: 8000,
      action: url ? { label: 'View', onClick: () => (window.location.href = url) } : undefined,
    });
  } else {
    toast(`🔔 ${notif.message}`, {
      description: notif.description,
      duration: 5000,
      action: url ? { label: 'View', onClick: () => (window.location.href = url) } : undefined,
    });
  }
};

// ── Room join (safe – waits for connection) ───────────────────────────────────
const joinRooms = () => {
  if (_userId) {
    socket.emit('join-user', _userId);
    console.log(`[notifications]: Joined personal room → user-${_userId}`);
  }
  if (_institutionId) {
    socket.emit('join-institution', _institutionId);
    console.log(`[notifications]: Joined institution room → institution-${_institutionId}`);
  }
  if (_role === 'SUPER_ADMIN') {
    socket.emit('join-super-admin');
    console.log('[notifications]: Joined super-admin-room');
  }
};

// ── Setup event listeners (idempotent) ───────────────────────────────────────
const setupListeners = () => {
  if (_isSetup) return;
  _isSetup = true;

  const onNotification = (data: any) => dispatch(data);
  const onNewIncident = (data: any) =>
    dispatch({ ...data, type: 'NEW_INCIDENT', title: data.title || 'New Incident Reported' });
  const onSos = (data: any) =>
    dispatch({ ...data, type: 'SOS_ALERT', title: data.title || '🚨 EMERGENCY SOS', priority: 'CRITICAL' });
  const onSystemAlert = (data: any) => dispatch(data);

  socket.on('notification', onNotification);
  socket.on('new-incident', onNewIncident);
  socket.on('sos-alert', onSos);
  socket.on('system-alert', onSystemAlert);
  socket.on('admin-activity', onNotification);
  socket.on('connect', () => {
    console.log(`[notifications]: Socket connected (id: ${socket.id}) — joining rooms`);
    joinRooms();
  });

  console.log('[notifications]: Socket event listeners registered');
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize the notification service for an authenticated user.
 * Safe to call multiple times; will reconnect rooms on re-mount.
 */
export const initNotifications = (user: {
  id: string;
  role: string;
  institution?: { id: string };
}) => {
  _userId = user.id;
  _role = user.role;
  _institutionId = user.institution?.id || null;

  requestNotificationPermission();
  setupListeners();

  if (socket.connected) {
    // Already connected — join rooms immediately
    joinRooms();
  } else {
    // Connect and join rooms only once connection succeeds
    socket.connect();
    // joinRooms will be called by the 'connect' listener in setupListeners
  }
};

/**
 * Subscribe to incoming notifications. Returns an unsubscribe function.
 */
export const subscribeToNotifications = (cb: NotificationCallback): (() => void) => {
  _subscribers.push(cb);
  return () => {
    _subscribers = _subscribers.filter(fn => fn !== cb);
  };
};

/**
 * Tear down — call on user logout.
 */
export const teardownNotifications = () => {
  socket.off('notification');
  socket.off('new-incident');
  socket.off('sos-alert');
  socket.off('system-alert');
  socket.off('admin-activity');
  socket.off('connect', joinRooms);
  socket.disconnect();
  _subscribers = [];
  _userId = null;
  _institutionId = null;
  _role = null;
  _isSetup = false;
  console.log('[notifications]: Torn down');
};
