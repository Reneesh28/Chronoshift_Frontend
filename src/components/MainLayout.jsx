import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CommandPalette from './CommandPalette';
import axios from 'axios';
import { DJANGO_BASE_URL, FASTAPI_BASE_URL, FLASK_BASE_URL } from '../services/api';
import {
  Terminal,
  ChevronLeft,
  ChevronRight,
  GitCompare,
  PlaySquare,
  LogOut,
  Cpu,
  Wifi,
  WifiOff,
  Command,
  HelpCircle
} from 'lucide-react';

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Cluster Status Monitoring States
  const [clusterStatuses, setClusterStatuses] = useState({
    django: 'CHECKING',
    fastapi: 'CHECKING',
    flask: 'CHECKING'
  });

  // Dynamic Ping Utility for Port Monitoring
  useEffect(() => {
    async function checkSystemIntegrity() {
      // 1. Django check
      try {
        await axios.get(`${DJANGO_BASE_URL}/api/auth/health/`, { timeout: 1500 });
        setClusterStatuses(prev => ({ ...prev, django: 'STABLE' }));
      } catch (err) {
        setClusterStatuses(prev => ({ ...prev, django: 'OFFLINE' }));
      }

      // 2. FastAPI check
      try {
        await axios.get(FASTAPI_BASE_URL, { timeout: 1500 });
        setClusterStatuses(prev => ({ ...prev, fastapi: 'STABLE' }));
      } catch (err) {
        // FastAPI might reject or return 404 on base index depending on route, but if we get a response, server is running
        if (err.code === 'ERR_NETWORK') {
          setClusterStatuses(prev => ({ ...prev, fastapi: 'OFFLINE' }));
        } else {
          setClusterStatuses(prev => ({ ...prev, fastapi: 'STABLE' }));
        }
      }

      // 3. Flask AI check
      try {
        await axios.get(FLASK_BASE_URL, { timeout: 1500 });
        setClusterStatuses(prev => ({ ...prev, flask: 'STABLE' }));
      } catch (err) {
        if (err.code === 'ERR_NETWORK') {
          setClusterStatuses(prev => ({ ...prev, flask: 'OFFLINE' }));
        } else {
          setClusterStatuses(prev => ({ ...prev, flask: 'STABLE' }));
        }
      }
    }

    checkSystemIntegrity();
    const interval = setInterval(checkSystemIntegrity, 12000);
    return () => clearInterval(interval);
  }, []);

  // Listen for global custom events to toggle command palette
  useEffect(() => {
    const handleToggle = () => setIsCommandPaletteOpen(prev => !prev);
    window.addEventListener('toggle_command_palette', handleToggle);
    return () => window.removeEventListener('toggle_command_palette', handleToggle);
  }, []);

  const navItems = [
    {
      path: '/',
      label: 'Operations Center',
      icon: Terminal,
      description: 'Simulation Dashboard & Console'
    },
    {
      path: '/compare/default',
      label: 'Scenario Comparison',
      icon: GitCompare,
      description: 'Compare divergence structures'
    },
    {
      path: '/replay/default',
      label: 'Chronological Replay',
      icon: PlaySquare,
      description: 'Historical session scrubbers'
    }
  ];

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate-200 font-sans flex flex-col overflow-hidden">
      {/* Dynamic Status Header */}
      <header className="h-14 border-b border-obsidian-border bg-obsidian-900/60 backdrop-blur-md px-5 flex items-center justify-between z-20 shrink-0 select-none">
        {/* Brand System */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-6 h-6 bg-cyber-cyan-glow border border-cyber-cyan/30 rounded flex items-center justify-center">
            <Terminal className="w-3.5 h-3.5 text-cyber-cyan" />
          </div>
          <span className="text-sm font-bold tracking-widest text-white font-mono uppercase">CHRONOSHIFT</span>
        </div>

        {/* Real-time System Port Monitors */}
        <div className="hidden lg:flex items-center space-x-6 text-[10px] font-mono">
          {/* Django Monitor */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 uppercase">Daphne Core (8000):</span>
            <span className={`px-2 py-0.5 rounded-sm border font-bold flex items-center space-x-1 ${
              clusterStatuses.django === 'STABLE'
                ? 'bg-cyber-cyan-glow text-cyber-cyan border-cyber-cyan/20'
                : 'bg-cyber-crimson-glow text-cyber-crimson border-cyber-crimson/20'
            }`}>
              {clusterStatuses.django === 'STABLE' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span>{clusterStatuses.django}</span>
            </span>
          </div>

          {/* FastAPI Monitor */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 uppercase">Simulator (8002):</span>
            <span className={`px-2 py-0.5 rounded-sm border font-bold flex items-center space-x-1 ${
              clusterStatuses.fastapi === 'STABLE'
                ? 'bg-cyber-cyan-glow text-cyber-cyan border-cyber-cyan/20'
                : 'bg-cyber-crimson-glow text-cyber-crimson border-cyber-crimson/20'
            }`}>
              {clusterStatuses.fastapi === 'STABLE' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span>{clusterStatuses.fastapi}</span>
            </span>
          </div>

          {/* Flask Monitor */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 uppercase">AI Core (8003):</span>
            <span className={`px-2 py-0.5 rounded-sm border font-bold flex items-center space-x-1 ${
              clusterStatuses.flask === 'STABLE'
                ? 'bg-cyber-cyan-glow text-cyber-cyan border-cyber-cyan/20'
                : 'bg-cyber-crimson-glow text-cyber-crimson border-cyber-crimson/20'
            }`}>
              {clusterStatuses.flask === 'STABLE' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span>{clusterStatuses.flask}</span>
            </span>
          </div>
        </div>

        {/* Global Toolbar Commands & Profile Info */}
        <div className="flex items-center space-x-4">
          {/* Command Palette Hotkey HUD */}
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center space-x-2 bg-obsidian-950 hover:bg-obsidian-800 border border-obsidian-border rounded px-2.5 py-1 text-[10px] font-mono text-slate-400 hover:text-cyber-cyan transition-all cursor-pointer"
          >
            <Command className="w-3.5 h-3.5" />
            <span>COMMANDS</span>
            <span className="bg-obsidian-900 border border-obsidian-border text-slate-500 px-1 py-0.2 rounded">Ctrl+K</span>
          </button>

          {/* Profile HUD */}
          <div className="flex items-center space-x-3 text-xs pl-3 border-l border-obsidian-border">
            <div className="flex flex-col text-right">
              <span className="text-white font-mono font-bold select-none">{user?.username || 'SYSTEM_GUEST'}</span>
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">OP LEVEL 4</span>
            </div>
            <button
              onClick={logout}
              title="Sign Out Session"
              className="p-1.5 rounded-sm hover:bg-cyber-crimson/10 border border-transparent hover:border-cyber-crimson/25 text-slate-450 hover:text-cyber-crimson transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Primary Layout Split Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Collapsible HUD Sidebar */}
        <aside className={`bg-obsidian-900/40 backdrop-blur-xs border-r border-obsidian-border flex flex-col justify-between shrink-0 select-none transition-all duration-300 font-mono ${
          isSidebarCollapsed ? 'w-16' : 'w-64'
        }`}>
          {/* Section: Links */}
          <div className="p-3 space-y-2">
            <div className={`text-[10px] text-slate-500 uppercase tracking-widest font-bold px-3 py-1 flex items-center justify-between ${
              isSidebarCollapsed ? 'opacity-0' : 'opacity-100'
            }`}>
              <span>Operational Desks</span>
              <Cpu className="w-3.5 h-3.5 text-cyber-cyan" />
            </div>

            <nav className="space-y-1.5 pt-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path.split('/')[1]));
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-sm border transition-all ${
                      isActive
                        ? 'bg-cyber-cyan/5 border-cyber-cyan/30 text-cyber-cyan font-bold shadow-xs shadow-cyan-950/5'
                        : 'border-transparent text-slate-400 hover:text-white hover:bg-obsidian-850'
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5 shrink-0" />
                    {!isSidebarCollapsed && (
                      <div className="flex flex-col text-left">
                        <span className="text-xs leading-normal">{item.label}</span>
                        <span className="text-[9px] text-slate-550 leading-none mt-0.5 font-normal tracking-tight font-sans">
                          {item.description}
                        </span>
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Section: Collapse Action */}
          <div className="p-3 border-t border-obsidian-border flex justify-between items-center text-[10px]">
            {!isSidebarCollapsed && (
              <span className="text-slate-650 flex items-center space-x-1">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Diagnostics OK</span>
              </span>
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`p-1.5 rounded-sm hover:bg-obsidian-850 hover:text-cyber-cyan transition-colors cursor-pointer ${
                isSidebarCollapsed ? 'mx-auto' : ''
              }`}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </aside>

        {/* Content Viewport Frame */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative scrollbar-thin">
          <Outlet />
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)}
      />
    </div>
  );
}
