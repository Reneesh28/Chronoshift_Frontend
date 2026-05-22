import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { timelineService } from '../services/timelineService';
import { replayService } from '../services/replayService';
import { Play, Pause, RotateCcw, AlertTriangle, ArrowLeft, Terminal, Cpu, Clock } from 'lucide-react';
import TerminalLoader from '../components/TerminalLoader';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReplayDeck() {
  const { id: routeTimelineId } = useParams();
  const navigate = useNavigate();

  // Operational states
  const [timelines, setTimelines] = useState([]);
  const [selectedTimelineId, setSelectedTimelineId] = useState(routeTimelineId || '');
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  const [totalTicks, setTotalTicks] = useState(100);
  const [playbackSpeed, setPlaybackSpeed] = useState(300); // ms per tick
  const [activeReplayId, setActiveReplayId] = useState(null);

  // Tick records
  const [tickEvents, setTickEvents] = useState([]);
  const [events, setEvents] = useState([]);

  // Sequence player
  const playerRef = useRef(null);
  const logContainerRef = useRef(null);

  // Scroll logs to bottom automatically
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [currentTick]);

  // Initial load
  useEffect(() => {
    async function loadData() {
      try {
        const tlList = await timelineService.list();
        setTimelines(tlList);

        const targetId = routeTimelineId && routeTimelineId !== 'default' ? routeTimelineId : (tlList[0]?.id || tlList[0]?._id || '');
        setSelectedTimelineId(targetId);

        if (targetId) {
          const detail = await timelineService.getDetail(targetId);
          const tlBranches = detail.branches || [
            { id: 'root', branch_name: 'Main Root Core', decision: 'Baseline operational scope' }
          ];
          setBranches(tlBranches);
          setSelectedBranchId(tlBranches[0]?.id || tlBranches[0]?._id || '');
        }
      } catch (err) {
        setError('Failed to query active session parameters.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [routeTimelineId]);

  // Handle active scope switch
  const handleTimelineChange = async (e) => {
    const id = e.target.value;
    setSelectedTimelineId(id);
    setLoading(true);
    setIsPlaying(false);
    setCurrentTick(0);
    try {
      const detail = await timelineService.getDetail(id);
      const tlBranches = detail.branches || [
        { id: 'root', branch_name: 'Main Root Core', decision: 'Baseline operational scope' }
      ];
      setBranches(tlBranches);
      setSelectedBranchId(tlBranches[0]?.id || tlBranches[0]?._id || '');
    } catch (err) {
      setError('Could not query branches for selected scope.');
    } finally {
      setLoading(false);
    }
  };

  // Configure active session
  const initializePlayback = async () => {
    if (!selectedTimelineId || !selectedBranchId) return;
    setError(null);
    setIsPlaying(false);
    setCurrentTick(0);

    try {
      const response = await replayService.start({
        timeline_id: selectedTimelineId,
        branch_id: selectedBranchId
      });
      
      const replayId = response.replay_id || 'MOCK_REPLAY_100';
      setActiveReplayId(replayId);
      
      const loadedEvents = response.events || [];
      setEvents(loadedEvents);
      
      if (loadedEvents.length > 0) {
        setTotalTicks(loadedEvents.length);
        const logs = loadedEvents.map((ev) => {
          const time = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
          const operator = ev.created_by ? `Operator ${ev.created_by}` : 'System';
          return `[ ${time} ] [ EVENT: ${String(ev.event_type || 'decision').toUpperCase()} ] Injected value: "${ev.event_value || ev.decision || ''}" (via ${operator})`;
        });
        setTickEvents(logs);
      } else {
        setTotalTicks(10);
        const bootstrapLogs = Array.from({ length: 11 }, (_, idx) => {
          if (idx === 0) return '[ INITIALIZED ] Core workspace loaded. Awaiting playback stream.';
          if (idx === 1) return '[ BOOTSTRAP ] Core scope contains no manual events. Simulating baseline telemetry.';
          if (idx === 2) return '[ SYNC ] Core state synchronized. Parallel simulation pathways verified.';
          if (idx % 4 === 0) return `[ TICK ${idx} ] Diagnostics status: Core temperature stable. Velocity nominal.`;
          if (idx % 3 === 0) return `[ TICK ${idx} ] Matrix elasticity coefficient remains at baseline threshold (0.50).`;
          return `[ TICK ${idx} ] Parallel path diagnostic checkpoint synced cleanly.`;
        });
        setTickEvents(bootstrapLogs);
      }
    } catch (err) {
      console.error(err);
      setError('Could not establish secure connection to the replay service. Running mock diagnostics.');
      setActiveReplayId('MOCK_REPLAY_100');
      setTotalTicks(10);
      const mockLogs = Array.from({ length: 11 }, (_, idx) => {
        if (idx === 0) return '[ INITIALIZED ] Backup emergency dashboard session active.';
        if (idx === 1) return '[ WARNING ] Service offline. Simulating local baseline path ticks.';
        if (idx % 3 === 0) return `[ TICK ${idx} ] Simulation check: Delta divergence score +${(idx * 0.12).toFixed(2)}%.`;
        return `[ TICK ${idx} ] System operational telemetry frame compiled.`;
      });
      setTickEvents(mockLogs);
      setEvents([]);
    }
  };

  useEffect(() => {
    if (selectedTimelineId && selectedBranchId) {
      initializePlayback();
    }
  }, [selectedTimelineId, selectedBranchId]);

  // Scrubber player ticker
  useEffect(() => {
    if (isPlaying) {
      playerRef.current = setInterval(() => {
        setCurrentTick((prev) => {
          if (prev >= totalTicks) {
            setIsPlaying(false);
            clearInterval(playerRef.current);
            return totalTicks;
          }
          return prev + 1;
        });
      }, playbackSpeed);
    } else {
      if (playerRef.current) clearInterval(playerRef.current);
    }

    return () => {
      if (playerRef.current) clearInterval(playerRef.current);
    };
  }, [isPlaying, playbackSpeed, totalTicks]);

  const activeEvent = currentTick > 0 && currentTick <= events.length ? events[currentTick - 1] : null;

  if (loading) {
    return <TerminalLoader />;
  }

  return (
    <div className="p-8 max-w-7xl w-full mx-auto space-y-8 font-mono text-xs select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-obsidian-border pb-4 gap-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 bg-obsidian-900 border border-obsidian-border text-slate-400 hover:text-cyber-magenta hover:border-cyber-magenta/45 rounded transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-white tracking-widest uppercase flex items-center space-x-2">
              <Clock className="w-4 h-4 text-cyber-magenta animate-pulse" />
              <span>Chronological Replay Deck</span>
            </h2>
            <p className="text-[10px] text-slate-500 mt-1">Scrub and replay dynamic timeline parameters sequentially.</p>
          </div>
        </div>

        {/* Inputs */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Timeline select */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 uppercase tracking-widest text-[9px]">Scope:</span>
            <select
              value={selectedTimelineId}
              onChange={handleTimelineChange}
              className="bg-obsidian-900 border border-obsidian-border rounded px-3 py-1 text-white focus:outline-hidden focus:border-cyber-magenta font-mono"
            >
              {timelines.map(t => (
                <option key={t.id || t._id} value={t.id || t._id}>{t.title}</option>
              ))}
            </select>
          </div>

          {/* Branch select */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 uppercase tracking-widest text-[9px]">Branch:</span>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-obsidian-900 border border-obsidian-border rounded px-3 py-1 text-white focus:outline-hidden focus:border-cyber-magenta font-mono"
            >
              {branches.map(b => (
                <option key={b.id || b._id} value={b.id || b._id}>{b.branch_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-cyber-crimson-glow border border-cyber-crimson/30 rounded text-cyber-crimson font-bold flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4" />
          <span>FAULT DETECTED: {error}</span>
        </div>
      )}

      {/* Main Scrubber Control Board */}
      <div className="hud-glass-panel rounded-sm border-cyber-magenta/15 p-6 space-y-6">
        {/* Scrubber Playback Controls */}
        <div className="bg-obsidian-900/60 border border-obsidian-border p-5 rounded-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <div className="relative">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`w-10 h-10 rounded-full border transition-all flex items-center justify-center cursor-pointer relative z-10 ${isPlaying
                    ? 'bg-cyber-magenta text-obsidian-950 border-cyber-magenta'
                    : 'bg-cyber-magenta/15 text-cyber-magenta border-cyber-magenta/30 hover:bg-cyber-magenta hover:text-obsidian-950'
                  }`}
              >
                {isPlaying ? <Pause className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5 fill-current ml-0.5" />}
              </button>
              {isPlaying && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.5 }}
                  animate={{ scale: 1.4, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full border border-cyber-magenta pointer-events-none z-0"
                />
              )}
            </div>

            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentTick(0);
              }}
              className="w-10 h-10 rounded-full bg-obsidian-850 border border-obsidian-border text-slate-400 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="text-left font-mono">
              <div className="text-[9px] text-slate-500 uppercase tracking-widest leading-none">Playback Tick</div>
              <div className="text-white font-bold leading-normal mt-1.5 text-sm">
                TICK: {String(currentTick).padStart(3, '0')} / {totalTicks}
              </div>
            </div>
          </div>

          {/* Core Scrubber Range Input */}
          <div className="flex-1 w-full flex items-center space-x-4">
            <input
              type="range"
              min="0"
              max={totalTicks}
              value={currentTick}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentTick(parseInt(e.target.value));
              }}
              className="w-full accent-cyber-magenta h-1 bg-obsidian-950 rounded-lg cursor-pointer"
            />
          </div>

          {/* Speed Selector */}
          <div className="flex items-center space-x-2 text-[10px] font-mono border-l border-obsidian-border pl-5">
            <span className="text-slate-500 uppercase">Speed:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseInt(e.target.value))}
              className="bg-obsidian-950 border border-obsidian-border rounded px-2.5 py-1 text-white focus:outline-hidden focus:border-cyber-magenta font-mono"
            >
              <option value="600">0.5x</option>
              <option value="300">1.0x</option>
              <option value="150">2.0x</option>
            </select>
          </div>
        </div>

        {/* Multi-Pane Ticks Log & Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* left: scrolling ticks telemetry */}
          <div className="md:col-span-2 space-y-4">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5" />
              <span>Tick Telemetry Stream</span>
            </div>

            <div ref={logContainerRef} className="bg-obsidian-950 border border-obsidian-border p-4 rounded-sm font-mono text-[10.5px] leading-relaxed text-slate-350 h-56 overflow-y-auto scrollbar-thin space-y-2">
              <AnimatePresence initial={false}>
                {tickEvents.slice(0, currentTick).map((ev, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-start space-x-2"
                  >
                    <span className="text-cyber-magenta select-none">&gt;&gt;</span>
                    <span className="text-slate-200">{ev}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {currentTick === 0 && (
                <div className="text-slate-655 italic">SYSTEM STAGED. PRESS PLAY OR SCRUB TIMELINE TO RENDER STREAM.</div>
              )}
            </div>
          </div>

          {/* right: calculated stats */}
          <div className="space-y-4">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center space-x-1.5">
              <Cpu className="w-3.5 h-3.5" />
              <span>Parameter Telemetry</span>
            </div>

            <div className="hud-glass-panel border-obsidian-border rounded-sm p-4 space-y-3.5 h-56 flex flex-col justify-center text-[10.5px]">
              <div className="flex justify-between border-b border-obsidian-border/50 pb-2">
                <span className="text-slate-500 uppercase">Session Key:</span>
                <span className="text-white font-bold font-mono truncate max-w-[120px]">{activeReplayId || 'MOCK_ID'}</span>
              </div>
              <div className="flex justify-between border-b border-obsidian-border/50 pb-2">
                <span className="text-slate-500 uppercase">Injections:</span>
                <span className="text-white font-bold">{currentTick} / {totalTicks}</span>
              </div>
              <div className="flex justify-between border-b border-obsidian-border/50 pb-2">
                <span className="text-slate-500 uppercase">Matrix Delta Gap:</span>
                <span className="text-cyber-magenta font-bold">
                  +{(currentTick * 0.42).toFixed(2)}%
                </span>
              </div>
              {activeEvent && (
                <div className="flex justify-between border-b border-obsidian-border/50 pb-2">
                  <span className="text-slate-500 uppercase">Active Action:</span>
                  <span className="text-cyber-magenta font-bold truncate max-w-[120px]" title={activeEvent.event_type}>
                    {activeEvent.event_type.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex justify-between pb-1">
                <span className="text-slate-550 uppercase">Telemetry state:</span>
                <span className="text-cyber-cyan font-bold uppercase tracking-widest">
                  {isPlaying ? 'PLAYING' : currentTick === totalTicks ? 'COMPLETED' : 'STAGED'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
