import io from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect(token) {
    if (this.socket) {
      this.disconnect();
    }

    const socketURL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    
    this.socket = io(socketURL, {
      auth: {
        token: token
      },
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  joinRoom(data) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-room', data);
    }
  }

  // Hospital events
  onAlertCreated(callback) {
    if (this.socket) {
      this.socket.on('alert-created', callback);
    }
  }

  onAlertResponse(callback) {
    if (this.socket) {
      this.socket.on('alert-response', callback);
    }
  }

  onInventoryUpdated(callback) {
    if (this.socket) {
      this.socket.on('inventory-updated', callback);
    }
  }

  onCriticalShortage(callback) {
    if (this.socket) {
      this.socket.on('critical-shortage', callback);
    }
  }

  onAlertShared(callback) {
    if (this.socket) {
      this.socket.on('alert-shared', callback);
    }
  }

  onShareResponse(callback) {
    if (this.socket) {
      this.socket.on('share-response', callback);
    }
  }

  // General events
  onAlertStatusUpdated(callback) {
    if (this.socket) {
      this.socket.on('alert-status-updated', callback);
    }
  }

  onBulkInventoryUpdated(callback) {
    if (this.socket) {
      this.socket.on('bulk-inventory-updated', callback);
    }
  }

  onComponentsUpdated(callback) {
    if (this.socket) {
      this.socket.on('components-updated', callback);
    }
  }

  onCriticalShortageAlert(callback) {
    if (this.socket) {
      this.socket.on('critical-shortage-alert', callback);
    }
  }

  onShortageResolved(callback) {
    if (this.socket) {
      this.socket.on('shortage-resolved', callback);
    }
  }

  // Cleanup method to remove all listeners
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  // Check if socket is connected
  isSocketConnected() {
    return this.socket && this.isConnected;
  }

  // Get socket instance
  getSocket() {
    return this.socket;
  }
}

// Export singleton instance
export default new SocketService();
