import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import MainLayout from './components/MainLayout';

// Import newly implemented page components
import Dashboard from './pages/Dashboard';
import TimelineExplorer from './pages/TimelineExplorer';
import ScenarioComparison from './pages/ScenarioComparison';
import ReplayDeck from './pages/ReplayDeck';

import { KeyRound, Loader2 } from 'lucide-react';

function LoginConsole() {
  const { login, register, error, clearError } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(username, email, password);
      } else {
        await login(username, password);
      }
    } catch (err) {
      // Handled by AuthContext error state
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-950 panel-grid-overlay flex items-center justify-center font-mono p-4">
      <div className="w-full max-w-md hud-glass-panel rounded-sm border-cyber-cyan/20 p-8 animate-fade-in">
        {/* Title and Icon */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-lg bg-cyber-cyan-glow border border-cyber-cyan/40 flex items-center justify-center mb-3">
            <KeyRound className="w-6 h-6 text-cyber-cyan animate-pulse" />
          </div>
          <h2 className="text-xl font-bold tracking-wider text-white">
            {isRegister ? 'OPERATOR ENROLL' : 'CHRONOSHIFT SECURITY'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">
            {isRegister ? 'Establish Parallel Access Cords' : 'Client Handshake Portal'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-cyber-crimson-glow border border-cyber-crimson/30 rounded text-xs text-cyber-crimson flex items-start space-x-2.5">
            <span className="font-bold select-none">[!]</span>
            <div>
              <p className="font-bold uppercase tracking-wider">
                {isRegister ? 'Enrollment Refused' : 'Handshake Refused'}
              </p>
              <p className="mt-0.5 text-slate-350">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-sm">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1.5 font-bold">OPERATOR USERNAME</label>
            <input
              type="text"
              required
              disabled={submitting}
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                clearError();
              }}
              className="w-full bg-obsidian-900 border border-obsidian-border rounded px-3 py-2 text-white placeholder-slate-650 focus:outline-hidden focus:border-cyber-cyan transition-colors"
              placeholder="operator_id"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1.5 font-bold">OPERATOR EMAIL</label>
              <input
                type="email"
                required
                disabled={submitting}
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                }}
                className="w-full bg-obsidian-900 border border-obsidian-border rounded px-3 py-2 text-white placeholder-slate-650 focus:outline-hidden focus:border-cyber-cyan transition-colors"
                placeholder="operator@chronoshift.net"
              />
            </div>
          )}

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1.5 font-bold">ACCESS PASSCODE</label>
            <input
              type="password"
              required
              disabled={submitting}
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError();
              }}
              className="w-full bg-obsidian-900 border border-obsidian-border rounded px-3 py-2 text-white placeholder-slate-650 focus:outline-hidden focus:border-cyber-cyan transition-colors"
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-cyber-cyan/15 border border-cyber-cyan text-cyber-cyan hover:bg-cyber-cyan hover:text-obsidian-950 font-bold uppercase tracking-wider rounded transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isRegister ? 'ENROLLING OPERATOR...' : 'RESOLVING CORES...'}</span>
              </>
            ) : (
              <span>{isRegister ? 'INITIALIZE ENROLLMENT' : 'INITIALIZE HANDSHAKE'}</span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-obsidian-border/40 pt-4">
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setIsRegister(!isRegister);
              setUsername('');
              setEmail('');
              setPassword('');
              clearError();
            }}
            className="text-xs text-cyber-cyan hover:text-white transition-colors uppercase tracking-widest cursor-pointer disabled:opacity-50 font-bold"
          >
            {isRegister ? 'Already Authorized? Handshake' : 'Request Access? Operator Registration'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginConsole />
              </GuestRoute>
            }
          />
          {/* Group secure views under unified MainLayout and ProtectedRoute */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/timeline/:id" element={<TimelineExplorer />} />
            <Route path="/compare/:id" element={<ScenarioComparison />} />
            <Route path="/replay/:id" element={<ReplayDeck />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
