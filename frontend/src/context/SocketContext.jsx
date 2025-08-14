import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { toast } from 'react-hot-toast';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, token } = useAuth();

  useEffect(() => {
    if (user && token) {
      // Initialize socket connection
      const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
        auth: {
          token: token,
          userId: user._id,
          userType: user.role
        }
      });

      // Connection events
      newSocket.on('connect', () => {
        console.log('Socket connected');
        setIsConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
      });

      // Real-time event handlers
      newSocket.on('new_alert', (alert) => {
        if (user.role === 'donor') {
          toast.success(`New blood alert: ${alert.bloodType} needed at ${alert.hospital?.profile?.name}`, {
            duration: 5000
          });
        }
      });

      newSocket.on('alert_response', (response) => {
        if (user.role === 'hospital') {
          toast.info(`Donor ${response.status} alert for ${response.bloodType}`, {
            duration: 4000
          });
        }
      });

      newSocket.on('inventory_update', (update) => {
        if (user.role === 'hospital') {
          toast.info(`Inventory updated: ${update.bloodType} - ${update.quantity} units available`, {
            duration: 3000
          });
        }
      });

      newSocket.on('critical_shortage', (shortage) => {
        toast.error(`Critical shortage: ${shortage.bloodType} at ${shortage.hospital?.profile?.name}`, {
          duration: 6000
        });
      });

      newSocket.on('donation_scheduled', (donation) => {
        if (user.role === 'hospital') {
          toast.success(`New donation scheduled: ${donation.bloodType} from ${donation.donor?.profile?.fullName}`, {
            duration: 4000
          });
        }
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [user, token]);

  const emitEvent = (eventName, data) => {
    if (socket && isConnected) {
      socket.emit(eventName, data);
    }
  };

  const joinRoom = (roomName) => {
    if (socket && isConnected) {
      socket.emit('join_room', roomName);
    }
  };

  const leaveRoom = (roomName) => {
    if (socket && isConnected) {
      socket.emit('leave_room', roomName);
    }
  };

  const value = {
    socket,
    isConnected,
    emitEvent,
    joinRoom,
    leaveRoom
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
