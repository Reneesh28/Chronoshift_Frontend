import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Cpu, ShieldAlert, Terminal } from 'lucide-react';

export default function TerminalLoader() {
  const [logs, setLogs] = useState([]);
  const [dots, setDots] = useState('');

  const bootMessages = [
    'CONNECTING TO CHRONOSHIFT LOCAL SERVICES...',
    'ESTABLISHING SECURE CONNECTION CO-FLOW WITH PORT 8000...',
    'VERIFYING REFRESH KEY IN-MEMORY SIGNATURES...',
    'HANDSHAKE SUCCESSFUL: SYNCHRONIZING REALTIME TIMELINES...',
    'READYING DISTRIBUTED PARALLEL SIMULATOR...'
  ];

  useEffect(() => {
    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx < bootMessages.length) {
        setLogs((prev) => [...prev, `[ OK ] ${bootMessages[currentIdx]}`]);
        currentIdx++;
      } else {
        clearInterval(interval);
      }
    }, 450);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 300);
    return () => clearInterval(dotsInterval);
  }, []);

  return (
    <div className="fixed inset-0 bg-obsidian-950 panel-grid-overlay flex items-center justify-center font-mono z-50 p-6">
      {/* HUD Scanner Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="w-full h-1/3 bg-linear-to-b from-cyber-cyan-glow to-transparent opacity-20 animate-pulse absolute top-0" style={{ animationDuration: '4s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-2xl hud-glass-panel border-cyber-cyan/30 rounded-lg p-6 relative overflow-hidden"
      >
        {/* Terminal Header */}
        <div className="flex items-center justify-between border-b border-obsidian-border pb-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-cyber-cyan pulse-node-cyan" />
            <span className="text-cyber-cyan font-bold tracking-wider text-sm select-none">CHRONOSHIFT CLIENT SYSTEM</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <Cpu className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '5s' }} />
            <span>SECURE CHANNEL v1.0.0</span>
          </div>
        </div>

        {/* Output Console Logs */}
        <div className="space-y-2.5 min-h-36 max-h-48 overflow-y-auto mb-6 text-xs leading-relaxed text-slate-350 scrollbar-thin">
          {logs.map((log, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start space-x-2"
            >
              <span className="text-cyber-cyan select-none">&gt;</span>
              <span>{log}</span>
            </motion.div>
          ))}
          <div className="flex items-center space-x-2 text-cyber-gold">
            <span className="select-none font-bold animate-pulse">&gt;</span>
            <span className="animate-pulse">DECRYPTING MEMORY CORES{dots}</span>
          </div>
        </div>

        {/* Footer Hardware State Info */}
        <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest pt-4 border-t border-obsidian-border">
          <div className="flex items-center space-x-2">
            <Terminal className="w-3 h-3 text-cyber-cyan" />
            <span>Node Cluster Connect: ACTIVE</span>
          </div>
          <div>
            <span>SYSTEM ENVELOPE RESTORED</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
