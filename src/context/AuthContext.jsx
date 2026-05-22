import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Attempt dynamic session restoration on cold boot
  useEffect(() => {
    async function restoreSession() {
      try {
        // Attempt silent rotation using HTTP-only cookies
        await authService.refresh();
        const profile = await authService.getProfile();
        setUser(profile);
      } catch (err) {
        // Safe to ignore on boot, means user is a guest
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  // Gracefully intercept token rotation failures sent from the HTTP layer
  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      setLoading(false);
      setError('Encryption session expired. Access revoked.');
    };

    window.addEventListener('auth_session_expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth_session_expired', handleSessionExpired);
    };
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      await authService.login(username, password);
      const profile = await authService.getProfile();
      setUser(profile);
      return profile;
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.detail || 'Handshake failed. Verify credentials.';
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const register = async (username, email, password) => {
    setLoading(true);
    setError(null);
    try {
      await authService.register(username, email, password);
      const profile = await authService.getProfile();
      setUser(profile);
      return profile;
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.detail || 'Registration handshake rejected.';
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
    } catch (err) {
      // Clean client anyway if API logout has a mismatch
    } finally {
      setUser(null);
      setError(null);
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    clearError: () => setError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be consumed within an AuthProvider wrapper.');
  }
  return context;
}
