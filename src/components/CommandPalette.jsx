import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Terminal, ArrowRight, CornerDownLeft, Eye, ShieldAlert, Sliders } from 'lucide-react';

export default function CommandPalette({ isOpen, onClose, onToggleSidebar }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const commands = [
    {
      id: 'go-dashboard',
      title: 'Go to Operations Dashboard',
      description: 'Navigate to primary workspace desk',
      icon: Terminal,
      category: 'NAVIGATION',
      action: () => navigate('/'),
    },
    {
      id: 'toggle-sidebar',
      title: 'Toggle Left Sidebar HUD',
      description: 'Expand or collapse navigation layout',
      icon: Eye,
      category: 'LAYOUT',
      action: () => onToggleSidebar && onToggleSidebar(),
    },
    {
      id: 'go-compare',
      title: 'Go to Scenario Comparison Grid',
      description: 'Load multi-branch divergence timelines',
      icon: Sliders,
      category: 'NAVIGATION',
      action: () => navigate('/compare/default'),
    },
    {
      id: 'go-replay',
      title: 'Go to Chronological Replay Deck',
      description: 'Open historical session scrubbers',
      icon: Sliders,
      category: 'NAVIGATION',
      action: () => navigate('/replay/default'),
    },
    {
      id: 'force-expiry',
      title: 'Diagnostic: Force Token Expiry Event',
      description: 'Dispatches session-expired event to test system safety',
      icon: ShieldAlert,
      category: 'DIAGNOSTICS',
      action: () => {
        setTimeout(() => {
          window.dispatchEvent(new Event('auth_session_expired'));
        }, 150);
      },
    },
  ];

  // Filter commands by active query
  const filtered = commands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(search.toLowerCase()) ||
      cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  // Bind hotkeys
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // If closed, open (handled by parent context toggle)
        // Let's rely on standard parent trigger instead
        window.dispatchEvent(new CustomEvent('toggle_command_palette'));
      }

      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIndex]) {
          filtered[activeIndex].action();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, activeIndex, onClose, navigate]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          {/* Backdrop Blur Mask */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-xs"
          />

          {/* Command Card */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full max-w-xl bg-obsidian-950/90 border border-cyber-cyan/35 rounded-lg shadow-2xl shadow-cyan-950/10 overflow-hidden font-mono z-10"
          >
            {/* Input Header */}
            <div className="flex items-center px-4 border-b border-obsidian-border">
              <Search className="w-4 h-4 text-cyber-cyan select-none" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setActiveIndex(0);
                }}
                className="w-full px-3 py-4 bg-transparent text-white border-0 focus:outline-hidden text-sm placeholder-slate-650"
                placeholder="Search operational console commands..."
              />
              <span className="text-[10px] text-slate-550 border border-obsidian-border px-1.5 py-0.5 rounded select-none">
                ESC
              </span>
            </div>

            {/* Results Grid */}
            <div className="max-h-72 overflow-y-auto p-2 scrollbar-thin">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  NO OPERATIONAL ACTIONS MATCHING QUERY.
                </div>
              ) : (
                filtered.map((cmd, index) => {
                  const Icon = cmd.icon;
                  const isActive = index === activeIndex;
                  return (
                    <div
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        onClose();
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-sm cursor-pointer select-none transition-colors ${
                        isActive
                          ? 'bg-cyber-cyan/10 border border-cyber-cyan/20'
                          : 'border border-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className={`p-1.5 rounded-sm ${isActive ? 'bg-cyber-cyan/20 text-cyber-cyan' : 'bg-obsidian-900 text-slate-550'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-white">{cmd.title}</span>
                            <span className="text-[9px] px-1 text-slate-500 bg-obsidian-900 border border-obsidian-border rounded">
                              {cmd.category}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{cmd.description}</div>
                        </div>
                      </div>
                      {isActive && (
                        <div className="flex items-center space-x-1 text-[10px] text-cyber-cyan">
                          <span>EXECUTE</span>
                          <CornerDownLeft className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Console Footer */}
            <div className="border-t border-obsidian-border px-4 py-2 bg-obsidian-900/50 flex justify-between items-center text-[9px] text-slate-550 select-none">
              <span>Use Arrow Keys to navigate, Enter to fire</span>
              <span>ChronoShift Command Core v1</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
