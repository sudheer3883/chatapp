import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Map());

  // Call management states
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Connect to Socket.io server with cookie authentication
    const backendUrl = import.meta.env.VITE_BACKEND_URL || (window.location.port === '5173' ? 'http://localhost:5000' : window.location.origin);
    const newSocket = io(backendUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("[Socket] Connected with ID:", newSocket.id);
    });

    // Real-time status/presence listener
    newSocket.on("user:status_changed", ({ userId, isOnline, lastSeen }) => {
      setOnlineUsers((prev) => {
        const updated = new Map(prev);
        updated.set(userId, { isOnline, lastSeen });
        return updated;
      });
    });

    // Incoming WebRTC Call Alert
    newSocket.on("call:incoming", (callData) => {
      console.log("[Socket] Received incoming call:", callData);
      setIncomingCall(callData);
    });

    newSocket.on("call:ended", () => {
      setIncomingCall(null);
      setActiveCall(null);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        onlineUsers,
        incomingCall,
        setIncomingCall,
        activeCall,
        setActiveCall,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context)
    throw new Error("useSocket must be used within a SocketProvider");
  return context;
};
