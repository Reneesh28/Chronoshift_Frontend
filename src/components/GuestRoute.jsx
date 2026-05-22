import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TerminalLoader from './TerminalLoader';

export default function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  // Show premium console-boot animation while silent refresh runs
  if (loading) {
    return <TerminalLoader />;
  }

  // If already authenticated, redirect away from auth gates straight to the operations center
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}
