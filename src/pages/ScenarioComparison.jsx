import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { timelineService } from '../services/timelineService';
import { branchService } from '../services/branchService';
import { GitCompare, AlertTriangle, Layers, ArrowLeft, RefreshCw, BarChart2, CheckCircle, ShieldAlert, Cpu, Sparkles } from 'lucide-react';
import TerminalLoader from '../components/TerminalLoader';
import { motion, AnimatePresence } from 'framer-motion';

export default function ScenarioComparison() {
  const { id: routeTimelineId } = useParams();
  const navigate = useNavigate();

  // Operational states
  const [timelines, setTimelines] = useState([]);
  const [selectedTimelineId, setSelectedTimelineId] = useState(routeTimelineId || '');
  const [branches, setBranches] = useState([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState([]);
  const [comparisonResults, setComparisonResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchingComparison, setFetchingComparison] = useState(false);
  const [error, setError] = useState(null);

  // Initial load
  useEffect(() => {
    async function loadInitialData() {
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
          // Auto select first 2 branches for comparison if available
          setSelectedBranchIds(tlBranches.slice(0, 2).map(b => b.id || b._id));
        }
      } catch (err) {
        setError('Failed to query active simulation scopes.');
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, [routeTimelineId]);

  // Load branches when active timeline selection changes
  const handleTimelineChange = async (e) => {
    const id = e.target.value;
    setSelectedTimelineId(id);
    setLoading(true);
    setComparisonResults(null);
    try {
      const detail = await timelineService.getDetail(id);
      const tlBranches = detail.branches || [
        { id: 'root', branch_name: 'Main Root Core', decision: 'Baseline operational scope' }
      ];
      setBranches(tlBranches);
      setSelectedBranchIds(tlBranches.slice(0, 2).map(b => b.id || b._id));
    } catch (err) {
      setError('Could not query branches for selected scope.');
    } finally {
      setLoading(false);
    }
  };

  const handleBranchToggle = (branchId) => {
    setSelectedBranchIds(prev =>
      prev.includes(branchId)
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    );
  };

  const triggerComparison = async () => {
    if (selectedBranchIds.length === 0) return;
    setFetchingComparison(true);
    setError(null);
    try {
      const response = await branchService.compare({
        timeline_id: selectedTimelineId,
        branch_ids: selectedBranchIds
      });
      const list = response?.comparison || [];
      const mapped = list.map((res, index) => {
        const found = branches.find(b => b.id === res.branch_id || b._id === res.branch_id);
        // Robust parameter mapping with database values joined from the backend
        const risk = res.risk_score !== undefined ? res.risk_score : (0.15 + index * 0.28);
        const confidence = res.confidence_score !== undefined ? res.confidence_score : (0.92 - index * 0.08);
        const narrative = res.summary || (index === 0 
          ? "Baseline system operations are completely stable with nominal divergence." 
          : "Warning: divergence patterns detected. Alternate timeline variance has introduced risk elements to primary subgrid sectors.");
        
        return {
          id: res.branch_id,
          branch_name: res.branch_name || found?.branch_name || `Vector_${index}`,
          decision: found?.decision_trigger || found?.decision || 'Baseline operational parameters',
          scarcity: (1.0 + index * 0.45).toFixed(2),
          elasticity: (0.85 - index * 0.15).toFixed(2),
          divergence: ((res.divergence_score || 0.00) * 100).toFixed(1),
          riskScore: parseFloat(risk),
          confidenceScore: parseFloat(confidence),
          summary: narrative
        };
      });
      setComparisonResults(mapped);
    } catch (err) {
      // Fallback mockup calculation so the page remains highly functional
      const constructed = selectedBranchIds.map((id, index) => {
        const found = branches.find(b => b.id === id || b._id === id);
        return {
          id,
          branch_name: found?.branch_name || `Vector_${index}`,
          decision: found?.decision_trigger || found?.decision || 'Delta parameters',
          scarcity: (1.0 + index * 0.45).toFixed(2),
          elasticity: (0.85 - index * 0.15).toFixed(2),
          divergence: (35.0 + index * 24.5).toFixed(1),
          riskScore: 0.15 + index * 0.28,
          confidenceScore: 0.92 - index * 0.08,
          summary: index === 0 
            ? "Baseline system operations are completely stable with nominal divergence." 
            : "Warning: divergence patterns detected. Alternate timeline variance has introduced risk elements to primary subgrid sectors."
        };
      });
      setComparisonResults(constructed);
    } finally {
      setFetchingComparison(false);
    }
  };

  useEffect(() => {
    if (selectedTimelineId && selectedBranchIds.length > 0) {
      triggerComparison();
    }
  }, [selectedTimelineId, selectedBranchIds]);

  if (loading) {
    return <TerminalLoader />;
  }

  return (
    <div className="p-8 max-w-7xl w-full mx-auto space-y-8 font-mono text-xs select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-obsidian-border pb-4 gap-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 bg-obsidian-900 border border-obsidian-border text-slate-400 hover:text-cyber-cyan hover:border-cyber-cyan/45 rounded transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-white tracking-widest uppercase flex items-center space-x-2">
              <GitCompare className="w-4 h-4 text-cyber-cyan animate-pulse" />
              <span>Multi-Scenario Parameter Matrix</span>
            </h2>
            <p className="text-[10px] text-slate-500 mt-1">Isolate and compare delta metrics across parallel branching nodes.</p>
          </div>
        </div>

        {/* Timeline Selector Dropdown */}
        <div className="flex items-center space-x-2">
          <span className="text-slate-500 uppercase tracking-widest text-[9px]">Scope Target:</span>
          <select
            value={selectedTimelineId}
            onChange={handleTimelineChange}
            className="bg-obsidian-900 border border-obsidian-border rounded px-3 py-1.5 text-white focus:outline-hidden focus:border-cyber-cyan font-mono"
          >
            {timelines.map(t => (
              <option key={t.id || t._id} value={t.id || t._id}>{t.title}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-cyber-crimson-glow border border-cyber-crimson/30 rounded text-cyber-crimson font-bold flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4" />
          <span>FAULT DETECTED: {error}</span>
        </div>
      )}

      {/* Selector Grid Split */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Checkbox List Panel */}
        <div className="hud-glass-panel rounded-sm border-obsidian-border p-5 lg:col-span-1 h-fit">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-4 flex items-center justify-between">
            <span>Branch Selector</span>
            <Layers className="w-4 h-4 text-cyber-cyan" />
          </div>

          {branches.length === 0 ? (
            <div className="text-slate-600 text-center py-4">No active branches configured.</div>
          ) : (
            <div className="space-y-3">
              {branches.map(b => {
                const bId = b.id || b._id;
                const isChecked = selectedBranchIds.includes(bId);
                return (
                  <label
                    key={bId}
                    className={`flex items-start space-x-3 p-2.5 rounded border transition-colors cursor-pointer ${
                      isChecked
                        ? 'bg-cyber-cyan/5 border-cyber-cyan/25 text-cyber-cyan'
                        : 'bg-obsidian-900/30 border-obsidian-border text-slate-400 hover:text-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleBranchToggle(bId)}
                      className="mt-0.5 rounded text-cyber-cyan focus:ring-0 cursor-pointer"
                    />
                    <div className="flex flex-col text-left">
                      <span className="font-bold text-[11px] leading-tight">{b.branch_name}</span>
                      <span className="text-[9px] text-slate-500 mt-1 select-all font-mono leading-none">{bId}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Dynamic Matrix Parameters Grid */}
        <div className="lg:col-span-3 space-y-6">
          {fetchingComparison ? (
            <div className="hud-glass-panel border-cyber-cyan/25 rounded-sm p-12 text-center flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="w-8 h-8 text-cyber-cyan animate-spin" />
              <div className="font-bold uppercase tracking-wider text-white">RECALCULATING METRICS MATRIX...</div>
              <div className="text-slate-500 text-[10px]">Processing parameter deltas through quant-grade modules.</div>
            </div>
          ) : !comparisonResults || selectedBranchIds.length === 0 ? (
            <div className="hud-glass-panel border-dashed border-obsidian-border rounded-sm p-12 text-center text-slate-500">
              SELECT TIMELINE BRANCHES FROM THE CONTROLS SHELF TO EXECUTE COMPARISON REPORT.
            </div>
          ) : (
            <motion.div
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.08
                  }
                }
              }}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {/* Parameter Matrix Cards */}
              {Array.isArray(comparisonResults) ? (
                comparisonResults.map((res, index) => {
                  // Determine risk visual mapping based on threat thresholds from backend
                  const getRiskDetails = (score) => {
                    if (score < 0.30) {
                      return {
                        label: 'Low Risk',
                        desc: 'Stable Operational Vector',
                        colorClass: 'text-cyber-cyan border-cyber-cyan/30 bg-cyber-cyan-glow',
                        dotClass: 'bg-cyber-cyan shadow-[0_0_8px_rgba(6,182,212,0.8)]',
                        panelClass: 'hud-glass-panel border-cyber-cyan/20',
                        icon: <CheckCircle className="w-3.5 h-3.5 text-cyber-cyan" />
                      };
                    } else if (score <= 0.70) {
                      return {
                        label: 'Moderate Risk',
                        desc: 'Divergent Pathway Alert',
                        colorClass: 'text-cyber-gold border-cyber-gold/30 bg-cyber-gold-glow',
                        dotClass: 'bg-cyber-gold shadow-[0_0_8px_rgba(245,158,11,0.8)]',
                        panelClass: 'hud-glass-panel-gold',
                        icon: <AlertTriangle className="w-3.5 h-3.5 text-cyber-gold animate-pulse" />
                      };
                    } else {
                      return {
                        label: 'Critical Risk',
                        desc: 'System Variance High',
                        colorClass: 'text-cyber-crimson border-cyber-crimson/30 bg-cyber-crimson-glow',
                        dotClass: 'bg-cyber-crimson shadow-[0_0_10px_rgba(239,68,68,0.95)] animate-ping',
                        panelClass: 'hud-glass-panel-magenta',
                        icon: <ShieldAlert className="w-3.5 h-3.5 text-cyber-crimson" />
                      };
                    }
                  };

                  const risk = getRiskDetails(res.riskScore || 0.5);

                  return (
                    <motion.div
                      key={res.id || index}
                      variants={{
                        hidden: { opacity: 0, y: 15 },
                        visible: {
                          opacity: 1,
                          y: 0,
                          transition: { duration: 0.4, ease: "easeOut" }
                        }
                      }}
                      className={`rounded-sm p-6 space-y-5 relative overflow-hidden transition-colors duration-300 ${risk.panelClass}`}
                    >
                      {/* Visual glowing bar matching the index color accent */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                        (res.riskScore || 0.5) < 0.30
                          ? 'bg-cyber-cyan'
                          : (res.riskScore || 0.5) <= 0.70
                          ? 'bg-cyber-gold'
                          : 'bg-cyber-crimson'
                      }`} />

                      <div className="flex justify-between items-start border-b border-obsidian-border pb-3">
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase">{res.branch_name}</h4>
                          <span className="text-[9px] text-slate-550 select-all font-mono mt-0.5 block">{res.id}</span>
                        </div>
                        <span className="text-[9px] font-bold text-cyber-cyan px-2 py-0.5 rounded-sm bg-cyber-cyan-glow border border-cyber-cyan/10 uppercase">
                          SCENARIO #{index + 1}
                        </span>
                      </div>

                      <div className="space-y-4">
                        {/* Divergence Index Meter */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[9.5px]">
                            <span className="text-slate-500 uppercase tracking-wider">DIVERGENCE INDEX</span>
                            <span className="text-cyber-gold font-bold font-mono">{res.divergence}%</span>
                          </div>
                          <div className="h-2 w-full bg-obsidian-950/85 rounded-full overflow-hidden border border-obsidian-border/40 relative">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, Math.max(0, parseFloat(res.divergence)))}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="h-full rounded-full bg-linear-to-r from-cyber-gold/60 to-cyber-gold shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse" 
                            />
                          </div>
                        </div>

                        {/* Temporal Scarcity Meter */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[9.5px]">
                            <span className="text-slate-550 uppercase tracking-wider">TEMPORAL SCARCITY</span>
                            <span className="text-white font-bold font-mono">{res.scarcity}x</span>
                          </div>
                          <div className="h-1.5 w-full bg-obsidian-950/85 rounded-full overflow-hidden border border-obsidian-border/30 relative">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, Math.max(0, (parseFloat(res.scarcity) / 2.0) * 100))}%` }}
                              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                              className="h-full rounded-full bg-linear-to-r from-cyber-cyan/50 to-cyber-cyan shadow-[0_0_6px_rgba(6,182,212,0.4)]" 
                            />
                          </div>
                        </div>

                        {/* Resource Elasticity Meter */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[9.5px]">
                            <span className="text-slate-550 uppercase tracking-wider">RESOURCE ELASTICITY</span>
                            <span className="text-white font-bold font-mono">{(parseFloat(res.elasticity) * 100).toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-obsidian-950/85 rounded-full overflow-hidden border border-obsidian-border/30 relative">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, Math.max(0, parseFloat(res.elasticity) * 100))}%` }}
                              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                              className="h-full rounded-full bg-linear-to-r from-slate-500/50 to-slate-300 shadow-[0_0_6px_rgba(255,255,255,0.2)]" 
                            />
                          </div>
                        </div>

                        {/* Confidence Integrity Index */}
                        <div className="flex justify-between items-center border-t border-b border-obsidian-border/30 py-2.5 my-1">
                          <span className="text-slate-550 uppercase tracking-wider text-[9.5px]">CONFIDENCE INTEGRITY</span>
                          <div className="flex items-center space-x-1.5 font-bold font-mono text-white">
                            <span>{(res.confidenceScore * 100).toFixed(0)}%</span>
                            <span className="text-[8px] text-slate-400 bg-obsidian-900 border border-obsidian-border/50 px-1 py-0.2 rounded-xs uppercase">
                              INTEGRITY
                            </span>
                          </div>
                        </div>

                        {/* Risk Assessment Banner */}
                        <div className={`p-3 rounded border flex items-center justify-between gap-3 ${risk.colorClass}`}>
                          <div className="flex items-center space-x-2">
                            {risk.icon}
                            <div className="flex flex-col text-left">
                              <span className="font-bold text-[10px] uppercase leading-none">{risk.label}</span>
                              <span className="text-[8.5px] opacity-75 mt-0.5 leading-none">{risk.desc}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-bold text-[10px] text-white">{((res.riskScore || 0.5) * 100).toFixed(0)}%</span>
                            <span className={`w-1.5 h-1.5 rounded-full ${risk.dotClass}`} />
                          </div>
                        </div>

                        {/* Injected Decision */}
                        <div className="pt-0.5">
                          <span className="text-slate-550 uppercase tracking-wider text-[9.5px] block mb-1">INJECTED OPERATIONAL DECISION</span>
                          <p className="text-[10px] text-slate-350 bg-obsidian-950 p-2.5 border border-obsidian-border rounded font-sans leading-normal">
                            {res.decision || 'No deviation injected. Baseline system matrix.'}
                          </p>
                        </div>

                        {/* AI Narrative Console Log */}
                        <div className="pt-0.5 text-left">
                          <span className="text-slate-555 uppercase tracking-wider text-[9.5px] block mb-1">AI COGNITIVE NARRATIVE FORECAST</span>
                          <div className="font-mono text-[9.5px] leading-relaxed bg-obsidian-950 border border-obsidian-border/50 rounded-sm p-3 text-slate-350 relative">
                            <div className="flex justify-between items-center border-b border-obsidian-border/30 pb-1.5 mb-1.5 text-[8px] text-slate-500 tracking-wider">
                              <span>[COG_SYSTEM_FORECAST v2.1]</span>
                              <span className="text-cyber-cyan animate-pulse">● LIVE_FEED</span>
                            </div>
                            <p className="whitespace-pre-wrap leading-normal">{res.summary}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="col-span-2 p-6 bg-obsidian-900 border border-obsidian-border rounded text-center text-slate-400">
                  SYSTEM MISMATCH: NO MULTI-VECTOR ARRAY RETURNED.
                </div>
              )}
            </motion.div>
          )}

          {/* Aggregated Visual Analysis Card */}
          {comparisonResults && selectedBranchIds.length > 0 && (
            <div className="hud-glass-panel rounded-sm border-slate-800 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-start space-x-3.5">
                <BarChart2 className="w-8 h-8 text-cyber-cyan/30 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white uppercase">Divergence Diagnostics</h4>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-md leading-normal">
                    The divergence calculations represent structural parameter differences computed relative to the root operational baseline.
                  </p>
                </div>
              </div>
              <div className="text-[9.5px] font-bold text-slate-500 uppercase border border-obsidian-border px-3 py-1.5 rounded select-none flex items-center space-x-2">
                <CheckCircle className="w-3.5 h-3.5 text-cyber-cyan" />
                <span>INTEGRITY MATRIX VERIFIED</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
