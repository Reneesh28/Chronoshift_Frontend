import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { timelineService } from '../services/timelineService';
import { Plus, Terminal, RefreshCw, Layers, ShieldAlert, AlertTriangle, Trash2, Cpu } from 'lucide-react';
import TerminalLoader from '../components/TerminalLoader';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard() {
  const navigate = useNavigate();
  const [timelines, setTimelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New Timeline Form States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load timelines from local Daphne ASGI MongoDB store
  const fetchTimelines = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await timelineService.list();
      setTimelines(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Could not retrieve timelines. Core service offline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimelines();
  }, []);

  const handleCreateTimeline = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await timelineService.create(newTitle, newDescription);
      setNewTitle('');
      setNewDescription('');
      setShowCreateModal(false);
      await fetchTimelines();
    } catch (err) {
      setError('Failed to create timeline scope.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTimeline = async (id, e) => {
    e.stopPropagation(); // Avoid triggering route navigation
    if (!confirm('Are you sure you want to terminate this operational simulation scope?')) return;
    try {
      await timelineService.delete(id);
      await fetchTimelines();
    } catch (err) {
      setError('Failed to terminate timeline scope.');
    }
  };

  if (loading && timelines.length === 0) {
    return <TerminalLoader />;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.35, ease: "easeOut" }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-8 max-w-7xl w-full mx-auto space-y-8 font-mono text-xs select-none"
    >
      {/* HUD Quick Diagnostics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Timelines */}
        <motion.div variants={itemVariants} className="hud-glass-panel rounded-sm border-cyber-cyan/15 p-4 flex items-center justify-between">
          <div>
            <div className="text-slate-500 uppercase tracking-widest text-[9px]">Active Scopes</div>
            <div className="text-2xl font-bold text-white mt-1">{timelines.length}</div>
          </div>
          <Layers className="w-8 h-8 text-cyber-cyan/35" />
        </motion.div>

        {/* Global Cluster State */}
        <motion.div variants={itemVariants} className="hud-glass-panel rounded-sm border-cyber-cyan/15 p-4 flex items-center justify-between">
          <div>
            <div className="text-slate-500 uppercase tracking-widest text-[9px]">Cluster State</div>
            <div className="text-sm font-bold text-cyber-cyan mt-2">DYNAMICS OK</div>
          </div>
          <Cpu className="w-8 h-8 text-cyber-cyan/20 animate-pulse" />
        </motion.div>

        {/* Total Branches */}
        <motion.div variants={itemVariants} className="hud-glass-panel rounded-sm border-cyber-gold/15 p-4 flex items-center justify-between">
          <div>
            <div className="text-slate-500 uppercase tracking-widest text-[9px]">Telemetry Feed</div>
            <div className="text-sm font-bold text-cyber-gold mt-2">SYS_LISTENING</div>
          </div>
          <AlertTriangle className="w-8 h-8 text-cyber-gold/20" />
        </motion.div>

        {/* System Diagnostics */}
        <motion.div variants={itemVariants} className="hud-glass-panel rounded-sm border-slate-800 p-4 flex items-center justify-between">
          <div>
            <div className="text-slate-500 uppercase tracking-widest text-[9px]">Core Security</div>
            <div className="text-sm font-bold text-white mt-2">AES_ENCRYPTED</div>
          </div>
          <ShieldAlert className="w-8 h-8 text-slate-700" />
        </motion.div>
      </div>

      {error && (
        <div className="p-4 bg-cyber-crimson-glow border border-cyber-crimson/30 rounded text-cyber-crimson flex items-start space-x-3">
          <span className="font-bold">[!]</span>
          <div>
            <span className="font-bold uppercase">System Notification: </span>
            <span className="text-slate-350">{error}</span>
          </div>
        </div>
      )}

      {/* Timelines Workspace Panel */}
      <motion.div variants={itemVariants} className="hud-glass-panel rounded-sm border-cyber-cyan/10 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-obsidian-border pb-4 mb-6 gap-4">
          <div>
            <h2 className="text-sm font-bold text-white tracking-widest uppercase flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-cyber-cyan" />
              <span>Simulated Operational Scopes</span>
            </h2>
            <p className="text-[10px] text-slate-500 mt-1">Select a core simulation timeline matrix to launch operational dashboard controls.</p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchTimelines}
              className="p-2 bg-obsidian-900 border border-obsidian-border text-slate-400 hover:text-cyber-cyan hover:border-cyber-cyan/45 rounded transition-all cursor-pointer"
              title="Refresh Scope Matrix"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-cyber-cyan/10 border border-cyber-cyan text-cyber-cyan hover:bg-cyber-cyan hover:text-obsidian-950 font-bold uppercase rounded transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>CREATE SCOPE</span>
            </button>
          </div>
        </div>

        {/* Timelines List Table */}
        {timelines.length === 0 ? (
          <div className="py-12 text-center text-slate-500 border border-dashed border-obsidian-border rounded">
            NO SIMULATION TIMELINES CONFIGURED. INITIALIZE A SCOPE TO COMMENCE OPERATION.
          </div>
        ) : (
          <div className="border border-obsidian-border rounded overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 bg-obsidian-900 border-b border-obsidian-border p-3.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <div className="col-span-3">Timeline ID / Scope</div>
              <div className="col-span-6">Description Matrix</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            {/* Table Rows */}
            <motion.div variants={containerVariants} className="divide-y divide-obsidian-border bg-obsidian-900/10">
              {timelines.map((tl) => (
                <motion.div
                  key={tl.id || tl._id}
                  variants={itemVariants}
                  onClick={() => navigate(`/timeline/${tl.id || tl._id}`)}
                  className="grid grid-cols-12 p-4 text-slate-350 hover:bg-cyber-cyan/5 border-l-2 border-l-transparent hover:border-l-cyber-cyan transition-all items-center cursor-pointer"
                >
                  <div className="col-span-3 pr-4">
                    <div className="font-bold text-white tracking-wide truncate">{tl.title}</div>
                    <div className="text-[9px] text-slate-500 font-mono mt-0.5 select-all">{tl.id || tl._id}</div>
                  </div>
                  <div className="col-span-6 pr-4 text-[11px] text-slate-400 font-sans truncate">
                    {tl.description || 'No operational narrative parameters registered.'}
                  </div>
                  <div className="col-span-3 text-right flex items-center justify-end space-x-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/timeline/${tl.id || tl._id}`);
                      }}
                      className="px-3 py-1 bg-cyber-cyan/10 border border-cyber-cyan/40 text-cyber-cyan hover:bg-cyber-cyan hover:text-obsidian-950 font-bold text-[10px] rounded transition-all cursor-pointer"
                    >
                      ENTER COCKPIT
                    </button>
                    <button
                      onClick={(e) => handleDeleteTimeline(tl.id || tl._id, e)}
                      className="p-1 text-slate-550 hover:text-cyber-crimson hover:bg-cyber-crimson/10 rounded transition-all cursor-pointer"
                      title="Terminate Scope"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}
      </motion.div>

      {/* Scope Creation Modal Drawer */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/75 backdrop-blur-xs"
              onClick={() => setShowCreateModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full max-w-lg bg-obsidian-950 border border-cyber-cyan/30 rounded shadow-2xl relative z-10 p-6 font-mono text-xs"
            >
              <h3 className="text-sm font-bold text-cyber-cyan uppercase tracking-widest border-b border-obsidian-border pb-3 mb-4 flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Register New Simulation Scope</span>
              </h3>

              <form onSubmit={handleCreateTimeline} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5">TIMELINE TITLE</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-obsidian-900 border border-obsidian-border rounded px-3 py-2 text-white placeholder-slate-600 focus:outline-hidden focus:border-cyber-cyan transition-colors"
                    placeholder="Matrix Alpha Sector"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5">DESCRIPTION / SCOPE PARAMETERS</label>
                  <textarea
                    required
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full bg-obsidian-900 border border-obsidian-border rounded px-3 py-2 text-white placeholder-slate-650 focus:outline-hidden focus:border-cyber-cyan transition-colors min-h-24 resize-none font-sans"
                    placeholder="Analyze resource elasticities and temporal scarcity deviations..."
                  />
                </div>

                <div className="flex justify-end items-center space-x-3 pt-3 border-t border-obsidian-border">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-obsidian-900 border border-obsidian-border text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-cyber-cyan/15 border border-cyber-cyan text-cyber-cyan hover:bg-cyber-cyan hover:text-obsidian-950 font-bold uppercase rounded transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'RECONSTRUCTING CORES...' : 'INITIALIZE SIMULATION'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
