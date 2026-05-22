import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TerminalLoader from './TerminalLoader';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  // Show premium console-boot animation while silent refresh runs
  if (loading) {
    return <TerminalLoader />;
  }

  // Intercept unauthorized requests and send back to the credential handshake portal
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
