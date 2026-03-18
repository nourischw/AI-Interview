/**
 * Electron Preload Script
 * Exposes secure IPC APIs to the renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Stealth mode
  stealth: {
    toggle: () => ipcRenderer.invoke('stealth:toggle'),
    hide: () => ipcRenderer.invoke('stealth:hide'),
    show: () => ipcRenderer.invoke('stealth:show'),
    getState: () => ipcRenderer.invoke('stealth:getState'),
    onChange: (callback) => {
      ipcRenderer.on('stealth-mode-changed', (event, state) => callback(state));
    },
  },

  // Window control
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  // Audio setup
  audio: {
    setupStereoMix: () => ipcRenderer.invoke('audio:setupStereoMix'),
  },

  // System info
  system: {
    getInfo: () => ipcRenderer.invoke('system:getInfo'),
    platform: process.platform,
    arch: process.arch,
  },

  // App info
  app: {
    version: process.versions.electron,
    nodeVersion: process.versions.node,
  },
});

// Type definitions for TypeScript
/**
 * @typedef {Object} ElectronAPI
 * @property {Object} stealth
 * @property {Function} stealth.toggle
 * @property {Function} stealth.hide
 * @property {Function} stealth.show
 * @property {Function} stealth.getState
 * @property {Function} stealth.onChange
 * @property {Object} window
 * @property {Function} window.minimize
 * @property {Function} window.maximize
 * @property {Function} window.close
 * @property {Object} audio
 * @property {Function} audio.setupStereoMix
 * @property {Object} system
 * @property {Function} system.getInfo
 * @property {string} system.platform
 * @property {string} system.arch
 * @property {Object} app
 * @property {string} app.version
 * @property {string} app.nodeVersion
 */
