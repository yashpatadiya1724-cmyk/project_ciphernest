'use strict';
/**
 * CipherNest Socket Service
 * Manages Socket.IO instance and provides typed event emitters.
 * Phase 4.2 — adds threat:new, sim:event, latency:update channels.
 */
let io;

const initSocket = (server) => {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
        : ['http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => io;

// Generic emitter — used by simulation, honeypot, etc.
const emitEvent = (event, data) => {
  if (io) io.emit(event, data);
};

// 4.2 — Typed emitters for Phase 4 channels
const emitThreat    = (threat)  => emitEvent('threat:new',      threat);
const emitSimEvent  = (payload) => emitEvent('sim:event',       payload);
const emitLatency   = (stats)   => emitEvent('latency:update',  stats);
const emitFeedFetch = (threats) => emitEvent('intel:feed',      threats);

module.exports = { initSocket, getIO, emitEvent, emitThreat, emitSimEvent, emitLatency, emitFeedFetch };
