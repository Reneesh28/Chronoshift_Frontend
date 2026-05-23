import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { timelineService } from '../services/timelineService';
import { branchService } from '../services/branchService';
import { aiService } from '../services/aiService';
import { simulationService } from '../services/simulationService';
import { useWebSocket } from '../hooks/useWebSocket';
import {
  Play,
  Activity,
  Layers,
  ChevronRight,
  ChevronLeft,
  Send,
  Cpu,
  Brain,
  Terminal,
  Grid,
  CheckCircle,
  HelpCircle,
  Maximize2,
  AlertTriangle,
  TrendingUp,
  Shield,
  Target,
  Clock,
  Zap,
  ArrowRight,
  X,
  ExternalLink
} from 'lucide-react';
import TerminalLoader from '../components/TerminalLoader';
import { motion, AnimatePresence } from 'framer-motion';

export default function TimelineExplorer() {
  const { id: timelineId } = useParams();
  const navigate = useNavigate();

  // Core Data States
  const [timeline, setTimeline] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form States
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchDecision, setNewBranchDecision] = useState('');
  const [submittingBranch, setSubmittingBranch] = useState(false);
  const [creationError, setCreationError] = useState('');

  // Simulation Running State
  const [simulating, setSimulating] = useState(false);

  // AI Narrative states â€” full structured report object
  const [aiReport, setAiReport] = useState(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [fetchingReport, setFetchingReport] = useState(false);

  // Hover states for interactive tooltips
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [aiReportsCache, setAiReportsCache] = useState({});

  // Sidebar visibility states
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

  // AI Intelligence Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerReport, setDrawerReport] = useState(null);
  const [drawerBranch, setDrawerBranch] = useState(null);

  // Simulation Telemetry Logs
  const [consoleLogs, setConsoleLogs] = useState([
    `[ OK ] COCKPIT INTERACTIVE INTERFACE LOADED FOR TIMELINE ${timelineId}`,
    '[ INFO ] WAITING FOR GRAPH WEB-SOCKET DECK INTEGRATIONS...'
  ]);

  // Viewport and D3 refs
  const logRef = useRef(null);
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const simulationRef = useRef(null);
  const hoverTimeoutRef = useRef(null);

  const addLog = (message) => {
    setConsoleLogs((prev) => [...prev, `[ ${new Date().toLocaleTimeString()} ] ${message}`]);
  };

  // Scroll logs to bottom automatically
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [consoleLogs]);

  // Load timeline and branches from database
  const loadTimelineData = async () => {
    try {
      const tlData = await timelineService.getDetail(timelineId);
      setTimeline(tlData);

      // Attempt to load associated branches (fallback to root if empty list returned)
      const mockBranches = tlData.branches || [
        { id: 'root', branch_name: 'Main Root Core', decision: 'Baseline operational scope' }
      ];

      // Ensure all elements have normalized id keys
      const normalizedBranches = mockBranches.map(b => ({
        ...b,
        id: b.id || b._id
      }));

      setBranches(normalizedBranches);

      // Set initial selected branch
      if (normalizedBranches.length > 0) {
        setSelectedBranch(normalizedBranches[0]);
      }
      addLog('TIMELINE SCHEMA LOADED: SYNCING DATABASE MEMORY...');
    } catch (err) {
      setError('Could not retrieve timeline cockpit data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimelineData();
  }, [timelineId]);

  // Setup reactive WebSocket stream using custom useWebSocket hook
  const handleWebSocketMessage = useCallback(async (payload) => {
    console.log('[WebSocket Signal Received]', payload);

    if (payload.event === 'branch_created') {
      addLog(`[WS BROADCAST] PARALLEL BRANCH SPLIT OBSERVED: ID "${payload.branch_id}"`);
      try {
        const fullBranch = await branchService.getDetail(payload.branch_id);
        const syncedBranch = {
          ...fullBranch,
          id: fullBranch.branch_id || fullBranch._id
        };
        setBranches((prev) => {
          // Avoid duplicate appends
          if (prev.some(b => b.id === syncedBranch.id || b._id === syncedBranch.id)) return prev;
          return [...prev, syncedBranch];
        });
        addLog(`[SUCCESS] DYNAMICAL NODE LOADED IN CANVAS: "${syncedBranch.branch_name}"`);
      } catch (err) {
        console.error('Failed to sync incoming WS branch:', err);
      }
    } else if (payload.event === 'simulation_updated') {
      addLog(`[WS SIGNAL] FastAPI PROCESSING TICK: ${payload.progress}% (${payload.status.toUpperCase()})`);
    } else if (payload.event === 'simulation_completed') {
      addLog(`[WS SUCCESS] FastAPI COMPLETE: GENERATED BRANCHES RENDERED.`);
      // Reload database to sync completely
      loadTimelineData();
    } else if (payload.event === 'divergence_changed') {
      addLog(`[WS METRIC] SHIFT DETECTED: BRANCH "${payload.branch_id}" DIVERGENCE SCORE IS NOW ${payload.divergence_score}`);
      setBranches((prev) => prev.map(b => {
        if (b.id === payload.branch_id || b._id === payload.branch_id) {
          return { ...b, divergence_score: payload.divergence_score };
        }
        return b;
      }));
    } else if (payload.event === 'ai_summary_ready') {
      addLog(`[WS AI] NARRATIVE REPORT READY FOR BRANCH "${payload.branch_id}"`);
      // Invalidate cache for this branch so hover fetches fresh data
      setAiReportsCache(prev => {
        const next = { ...prev };
        delete next[payload.branch_id];
        return next;
      });
      // Auto-refresh the AI panel if the updated branch matches the selected one
      const selId = selectedBranch?.id || selectedBranch?._id;
      if (payload.branch_id === selId) {
        fetchBranchReport(payload.branch_id);
      }
    }
  }, [timelineId, selectedBranch]);

  const { isConnected } = useWebSocket(timelineId, handleWebSocketMessage);

  // Fetch AI Report on Hover
  useEffect(() => {
    if (!hoveredNode) return;
    const branchId = hoveredNode.id || hoveredNode._id;
    if (!branchId) return;

    if (aiReportsCache[branchId]) return;

    setAiReportsCache(prev => ({ ...prev, [branchId]: { loading: true } }));

    aiService.getSummaryByBranch(branchId)
      .then(report => {
        setAiReportsCache(prev => ({ ...prev, [branchId]: { loading: false, data: report } }));
      })
      .catch(err => {
        setAiReportsCache(prev => ({ ...prev, [branchId]: { loading: false, error: true } }));
      });
  }, [hoveredNode, aiReportsCache[hoveredNode?.id || hoveredNode?._id]]);

  // Setup D3 Force-Directed Simulation and Interactive Viewport Canvas
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || branches.length === 0) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 500;

    const svg = d3.select(svgRef.current);
    const zoomContainer = svg.select(".zoom-container");

    // Clear previously rendered dynamic halos to refresh cleanly
    zoomContainer.selectAll(".selected-halo").remove();

    // Map React state branches to D3 nodes with physical variables
    const nodesData = branches.map((b, idx) => {
      const isUpper = (idx % 2 === 0);
      return {
        id: b.id || b._id,
        name: b.branch_name,
        divergence: b.divergence_score || 0,
        depth: b.depth_level || 1,
        status: b.status || "active",
        decision: b.decision_trigger || b.decision || "",
        isUpper,
        branchData: b
      };
    });

    // Generate physical links/edges
    const linksData = [];
    nodesData.forEach(node => {
      if (node.branchData.parent_branch_id) {
        const parent = nodesData.find(p => p.id === node.branchData.parent_branch_id);
        if (parent) {
          linksData.push({
            source: parent.id,
            target: node.id
          });
        }
      }
    });

    // Custom horizontal force simulation constraints
    const spacingX = 180;
    const simulation = d3.forceSimulation(nodesData)
      .force("link", d3.forceLink(linksData).id(d => d.id).distance(spacingX * 0.95).strength(1.0))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("collide", d3.forceCollide().radius(40)) // wider radius for intelligence density
      .force("x", d3.forceX().x(d => d.depth * spacingX).strength(1.2))
      .force("y", d3.forceY().y(d => {
        const centerY = height / 2;
        if (d.depth === 1) return centerY;
        // Asymmetric multiplier based on depth or node name hash to make branches split wildly and unequally (Priority 2)
        const asymmetry = 1.0 + (d.id.charCodeAt(d.id.length - 1) % 4) * 0.15;
        const verticalMultiplier = d.isUpper ? -1.25 * asymmetry : 1.05 * asymmetry;

        // Increase vertical separation based on divergence score + constant split push
        const baselineSplit = 80; // guaranteed separation
        const divergenceSpread = d.divergence * 260; // wider separation

        return centerY + ((baselineSplit + divergenceSpread) * verticalMultiplier);
      }).strength(1.1));

    simulationRef.current = simulation;

    // Define Zoom Behavior
    const zoom = d3.zoom()
      .scaleExtent([0.15, 3.0])
      .on("zoom", (event) => {
        zoomContainer.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Initial position framing - center root node
    const rootNode = nodesData.find(n => n.depth === 1);
    if (rootNode) {
      svg.call(zoom.transform, d3.zoomIdentity.translate(80, 0).scale(0.95));
    }

    // DRAW TEMPORAL LANES / DEPTH BINDINGS (Priority 7 â€” Replay Visual Hooks)
    let lanesGroup = zoomContainer.select(".lanes-group");
    if (lanesGroup.empty()) {
      lanesGroup = zoomContainer.insert("g", ":first-child").attr("class", "lanes-group");
    }
    const depthLanes = Array.from({ length: 15 }, (_, i) => i + 1);
    const laneLines = lanesGroup.selectAll(".temporal-lane")
      .data(depthLanes);

    laneLines.exit().remove();
    laneLines.enter()
      .append("line")
      .attr("class", "temporal-lane")
      .attr("x1", d => d * spacingX)
      .attr("y1", -1500)
      .attr("x2", d => d * spacingX)
      .attr("y2", 1500)
      .attr("stroke", "#1F2937")
      .attr("stroke-width", 0.75)
      .attr("stroke-dasharray", "3,6")
      .attr("stroke-opacity", 0.45);

    const laneLabels = lanesGroup.selectAll(".temporal-lane-label")
      .data(depthLanes);
    laneLabels.exit().remove();
    laneLabels.enter()
      .append("text")
      .attr("class", "temporal-lane-label font-mono")
      .attr("x", d => d * spacingX)
      .attr("y", -30)
      .attr("text-anchor", "middle")
      .attr("fill", "#4B5563")
      .attr("font-size", "7px")
      .attr("letter-spacing", "0.1em")
      .text(d => `T-SEG ${String(d).padStart(2, '0')}`);

    // DRAW EDGES (Curved Beziers with glowing multi-layer flow, Priority 1)
    const linksGroup = zoomContainer.select(".links-group");
    const link = linksGroup.selectAll(".link-group")
      .data(linksData, d => `${d.source.id || d.source}-${d.target.id || d.target}`);

    link.exit().remove();

    const linkEnter = link.enter()
      .append("g")
      .attr("class", "link-group");

    // Faint holographic / glow trail base
    linkEnter.append("path")
      .attr("class", "timeline-link-glow")
      .attr("fill", "none")
      .attr("stroke", "url(#cyber-link-gradient)")
      .attr("stroke-width", 4.5)
      .attr("stroke-opacity", 0.2)
      .style("filter", "url(#neon-glow-cyan)")
      .style("pointer-events", "none");

    // Dynamic high-speed data flow packet trail
    linkEnter.append("path")
      .attr("class", "timeline-link animate-flow")
      .attr("fill", "none")
      .attr("stroke", "url(#cyber-link-gradient)")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.85)
      .style("filter", "url(#neon-glow-cyan)")
      .style("pointer-events", "none");

    const linkMerged = linkEnter.merge(link);

    // DRAW NODES
    const nodesGroup = zoomContainer.select(".nodes-group");
    const node = nodesGroup.selectAll(".node-group")
      .data(nodesData, d => d.id);

    node.exit().remove();

    const nodeEnter = node.enter()
      .append("g")
      .attr("class", "node-group cursor-pointer")
      .on("click", (event, d) => {
        if (event.defaultPrevented) return;
        setSelectedBranch(d.branchData);
        addLog(`SYNC SWITCH: CONSOLE SELECTED BRANCH "${d.name}"`);
      })
      .on("mouseenter", (event, d) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setHoveredNode(d.branchData);
        // Position relative to viewport container
        const containerRect = containerRef.current.getBoundingClientRect();
        setTooltipPos({
          x: event.clientX - containerRect.left,
          y: event.clientY - containerRect.top
        });
      })
      .on("mousemove", (event) => {
        const containerRect = containerRef.current.getBoundingClientRect();
        setTooltipPos({
          x: event.clientX - containerRect.left,
          y: event.clientY - containerRect.top
        });
      })
      .on("mouseleave", () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
          setHoveredNode(null);
        }, 300);
      })
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
      );

    // Sonar radar pulse ring around all nodes (Priority 1)
    nodeEnter.append("circle")
      .attr("class", "node-radar-pulse")
      .attr("r", 9)
      .attr("fill", "none")
      .attr("stroke", d => d.depth === 1 ? "#06B6D4" : d.divergence > 0.6 ? "#D946EF" : "#F59E0B")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.8)
      .style("pointer-events", "none")
      .append("animate")
      .attr("attributeName", "r")
      .attr("values", "9;22;9")
      .attr("dur", (d, i) => `${2 + (i % 3) * 0.75}s`)
      .attr("repeatCount", "indefinite");

    nodeEnter.select(".node-radar-pulse")
      .append("animate")
      .attr("attributeName", "stroke-opacity")
      .attr("values", "0.8;0;0.8")
      .attr("dur", (d, i) => `${2 + (i % 3) * 0.75}s`)
      .attr("repeatCount", "indefinite");

    // Outer Circle Border (Glowing Stroke)
    nodeEnter.append("circle")
      .attr("class", "node-circle")
      .attr("r", 9)
      .attr("fill", "#0B0F19")
      .attr("stroke-width", 2)
      .attr("stroke", d => {
        if (d.depth === 1) return "#06B6D4"; // Cyan
        if (d.divergence > 0.6) return "#D946EF"; // Magenta
        return "#F59E0B"; // Gold
      })
      .style("filter", d => {
        if (d.depth === 1) return "url(#neon-glow-cyan)";
        if (d.divergence > 0.6) return "url(#neon-glow-magenta)";
        return "url(#neon-glow-gold)";
      });

    // Inner Glowing Core dot (pulsing node cores)
    nodeEnter.append("circle")
      .attr("r", 3.5)
      .attr("fill", d => {
        if (d.depth === 1) return "#06B6D4";
        if (d.divergence > 0.6) return "#D946EF";
        return "#F59E0B";
      });

    // Node Intelligence Density (Priority 3)
    const labels = nodeEnter.append("text")
      .attr("class", "node-label font-mono")
      .attr("text-anchor", "middle")
      .attr("fill", "#E5E7EB")
      .style("pointer-events", "none")
      .style("font-size", "8.5px");

    // Line 1: Title (Cyan / Gold / Magenta)
    labels.append("tspan")
      .attr("x", 0)
      .attr("dy", 22)
      .attr("font-weight", "bold")
      .attr("fill", d => d.depth === 1 ? "#06B6D4" : d.divergence > 0.6 ? "#D946EF" : "#F59E0B")
      .text(d => d.name.toUpperCase());

    // Line 2: Risk Score
    labels.append("tspan")
      .attr("x", 0)
      .attr("dy", 12)
      .attr("fill", "#9CA3AF")
      .text(d => {
        const risk = d.depth === 1 ? "0.00" : (d.divergence * 0.85).toFixed(2);
        return `Risk: ${risk}`;
      });

    // Line 3: Confidence Score
    labels.append("tspan")
      .attr("x", 0)
      .attr("dy", 11)
      .attr("fill", "#9CA3AF")
      .text(d => {
        const conf = d.depth === 1 ? "1.00" : (0.95 - d.divergence * 0.3).toFixed(2);
        return `Confidence: ${conf}`;
      });

    // Line 4: AI & Simulation Status
    labels.append("tspan")
      .attr("x", 0)
      .attr("dy", 11)
      .attr("fill", d => d.divergence > 0.6 ? "#EF4444" : "#06B6D4")
      .attr("font-weight", "600")
      .text(d => {
        if (d.depth === 1) return "Status: ACTIVE";
        const status = d.divergence > 0.6 ? "VOLATILE" : "ACTIVE";
        const divPercent = (d.divergence * 100).toFixed(0);
        return `Status: ${status} [${divPercent}%]`;
      });

    const nodeMerged = nodeEnter.merge(node);

    // Draw active glowing halos dynamically around selected nodes
    nodeMerged.each(function (d) {
      const isSel = (d.id === selectedBranch?.id || d.id === selectedBranch?._id);
      const g = d3.select(this);

      if (isSel) {
        // Base glowing selected halo
        g.insert("circle", ":first-child")
          .attr("class", "selected-halo")
          .attr("r", 14)
          .attr("fill", "none")
          .attr("stroke", d.depth === 1 ? "#06B6D4" : d.divergence > 0.6 ? "#D946EF" : "#F59E0B")
          .attr("stroke-width", 2)
          .attr("stroke-opacity", 0.8)
          .style("filter", d.depth === 1 ? "url(#neon-glow-cyan)" : d.divergence > 0.6 ? "url(#neon-glow-magenta)" : "url(#neon-glow-gold)")
          .append("animate")
          .attr("attributeName", "r")
          .attr("values", "10;17;10")
          .attr("dur", "2.5s")
          .attr("repeatCount", "indefinite");

        // Faint underlying shadow glow
        g.insert("circle", ":first-child")
          .attr("class", "selected-halo shadow-halo")
          .attr("r", 18)
          .attr("fill", d.depth === 1 ? "rgba(6, 182, 212, 0.05)" : "rgba(217, 70, 239, 0.05)")
          .style("pointer-events", "none");

        // Faint rotating holographic rings / ghost trails (Priority 7 â€” Replay Visual Hooks)
        g.insert("circle", ":first-child")
          .attr("class", "selected-halo echo-halo")
          .attr("r", 24)
          .attr("fill", "none")
          .attr("stroke", d.depth === 1 ? "#06B6D4" : d.divergence > 0.6 ? "#D946EF" : "#F59E0B")
          .attr("stroke-width", 0.5)
          .attr("stroke-opacity", 0.3)
          .style("stroke-dasharray", "2,4")
          .append("animate")
          .attr("attributeName", "stroke-dashoffset")
          .attr("values", "0;20")
          .attr("dur", "6s")
          .attr("repeatCount", "indefinite");

        // Temporal event pulse waves radiating outwards (Priority 7 â€” Replay Visual Hooks)
        const wave = g.insert("circle", ":first-child")
          .attr("class", "selected-halo event-pulse-wave")
          .attr("r", 10)
          .attr("fill", "none")
          .attr("stroke", d.depth === 1 ? "#06B6D4" : d.divergence > 0.6 ? "#D946EF" : "#F59E0B")
          .attr("stroke-width", 0.75)
          .style("pointer-events", "none");

        wave.append("animate")
          .attr("attributeName", "r")
          .attr("values", "10;50")
          .attr("dur", "2.5s")
          .attr("repeatCount", "indefinite");

        wave.append("animate")
          .attr("attributeName", "stroke-opacity")
          .attr("values", "0.8;0")
          .attr("dur", "2.5s")
          .attr("repeatCount", "indefinite");
      }
    });

    // Math calculation for curved link connections (Horizontal Bezier)
    const linkGenerator = d3.linkHorizontal()
      .x(d => d.x)
      .y(d => d.y);

    const startTime = Date.now();

    // Ticks callback mapping coordinates to SVG elements (breathing effect, Priority 1)
    simulation.on("tick", () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const breatheOffset = Math.sin(elapsed * 1.5) * 5; // breathing wave

      // Apply subtle breathing to alternate node coordinates
      nodesData.forEach(d => {
        if (d.depth > 1) {
          const factor = d.isUpper ? 1 : -1;
          d.y += breatheOffset * 0.12 * factor;
        }
      });

      linkMerged.selectAll("path").attr("d", linkGenerator);
      nodeMerged.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Drag simulation helpers
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    const handleResize = () => {
      if (!containerRef.current || !simulation) return;
      const h = containerRef.current.clientHeight || 500;
      simulation.force("y", d3.forceY().y(d => {
        const centerY = h / 2;
        if (d.depth === 1) return centerY;
        const asymmetry = 1.0 + (d.id.charCodeAt(d.id.length - 1) % 4) * 0.15;
        const verticalMultiplier = d.isUpper ? -1.25 * asymmetry : 1.05 * asymmetry;
        const baselineSplit = 80;
        const divergenceSpread = d.divergence * 260;
        return centerY + ((baselineSplit + divergenceSpread) * verticalMultiplier);
      }).strength(1.1));
      simulation.alpha(0.3).restart();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      simulation.stop();
      window.removeEventListener("resize", handleResize);
    };
  }, [branches, selectedBranch, leftSidebarOpen, rightSidebarOpen]);

  // Reset zoom viewport back to baseline center
  const handleResetZoom = () => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom()
      .scaleExtent([0.15, 3.0])
      .on("zoom", (event) => {
        svg.select(".zoom-container").attr("transform", event.transform);
      });

    svg.transition().duration(600).call(
      zoom.transform,
      d3.zoomIdentity.translate(80, 0).scale(0.95)
    );
    addLog("TELEMETRY VIEWPORT RESET TO BASELINE ORIGIN.");
  };

  // Trigger Parallel Branch Splitting
  const handleBranchCreation = async (e) => {
    e.preventDefault();
    if (!newBranchName) return;
    setSubmittingBranch(true);
    setCreationError('');
    addLog(`INITIALIZING GRAPH SPLIT: BINDING NEW BRANCH "${newBranchName}"...`);
    try {
      const parentId = selectedBranch?.id || selectedBranch?._id;
      const cleanParentId = parentId && parentId !== 'root' ? parentId : null;

      const response = await branchService.create({
        timeline_id: timelineId,
        parent_branch_id: cleanParentId,
        branch_name: newBranchName,
        decision: newBranchDecision || 'Splitting operational vector.'
      });

      const newBranch = {
        ...response.branch,
        id: response.branch_id || response.branch._id
      };

      // Update state and prevent duplicates
      setBranches((prev) => {
        if (prev.some(b => b.id === newBranch.id || b._id === newBranch.id)) return prev;
        return [...prev, newBranch];
      });

      setSelectedBranch(newBranch);
      setNewBranchName('');
      setNewBranchDecision('');
      addLog(`[ SUCCESS ] BRANCH RENDERED: "${newBranch.branch_name}" COMMITTED TO CLUSTER.`);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || err.message || 'Unknown network error';
      setCreationError(errorMsg);
      addLog(`[ FAILED ] GRAPH SPLIT DENIED: ${errorMsg.toUpperCase()}`);
    } finally {
      setSubmittingBranch(false);
    }
  };

  // Run Async Simulator Ticks (FastAPI Service)
  const handleRunSimulation = async () => {
    if (!selectedBranch) return;
    setSimulating(true);
    addLog(`DISPATCHING SIGNAL TO PARALLEL SIMULATOR NODES: RUNNING BRANCH "${selectedBranch.branch_name}"...`);
    try {
      const response = await simulationService.run({
        timeline_id: timelineId,
        branch_id: selectedBranch.id || selectedBranch._id || 'root',
        decision: selectedBranch.decision_trigger || selectedBranch.decision || 'Baseline parameter delta.'
      });
      addLog(`[ RUNNING ] FastAPI Thread Triggered. Task ID: ${response.task_id || 'MOCK_TASK_ID'}`);

      // Poll/Mock outcome
      setTimeout(() => {
        addLog('[ COMPLETED ] SIMULATION COMPLETED SECURELY: WRITING MATRIX DIVERGENCE.');
        setSimulating(false);
      }, 2000);
    } catch (err) {
      addLog('[ FAILED ] SIMULATOR COMPILATION MAPPED ERROR.');
      setSimulating(false);
    }
  };

  // Fetch pre-cached branch report from Flask AI Engine
  const fetchBranchReport = async (branchId) => {
    setFetchingReport(true);
    try {
      const report = await aiService.getSummaryByBranch(branchId);
      setAiReport(report);
      setAiReportsCache(prev => ({ ...prev, [branchId]: { loading: false, data: report } }));
      addLog(`[AI LOADED] CACHED REPORT FETCHED FOR BRANCH "${branchId}"`);
    } catch (err) {
      // No cached report available — silently ignore, user can manually compile
      setAiReport(null);
    } finally {
      setFetchingReport(false);
    }
  };

  // Auto-fetch AI report whenever the selected branch changes
  useEffect(() => {
    if (!selectedBranch) return;
    const branchId = selectedBranch.id || selectedBranch._id;
    if (!branchId) {
      setAiReport(null);
      return;
    }
    fetchBranchReport(branchId);
  }, [selectedBranch?.id, selectedBranch?._id]);

  // Generate AI Summaries (Flask Service) — manual fallback
  const handleGenerateSummary = async () => {
    if (!selectedBranch) return;
    const branchId = selectedBranch.id || selectedBranch._id;
    setGeneratingAi(true);
    setAiReport(null);
    addLog('REQUESTING PARALLEL COGNITIVE SUMMARY: BOOTING COGNITIVE PHI-2 ENGINE...');
    try {
      const response = await aiService.generateSummary({
        timeline_id: timelineId,
        branch_id: branchId || 'root',
        simulation_id: 'default'
      });
      setAiReport(response);
      if (branchId) {
        setAiReportsCache(prev => ({ ...prev, [branchId]: { loading: false, data: response } }));
      }
      addLog('[ SUCCESS ] COGNITIVE REPORT READY: GRAPH PLOT INTEGRATED.');
    } catch (err) {
      setAiReport({ summary: 'Error resolving AI summarization node. Ensure Flask AI Engine is online on Port 8003.' });
      addLog('[ FAILED ] COGNITIVE REPORT FAILED.');
    } finally {
      setGeneratingAi(false);
    }
  };

  if (loading) {
    return <TerminalLoader />;
  }

  if (error) {
    return (
      <div className="p-8 text-center text-cyber-crimson font-mono max-w-xl mx-auto mt-20 border border-cyber-crimson/35 rounded bg-cyber-crimson-glow">
        <span className="font-bold font-mono uppercase text-sm">[!] CRITICAL INTERACTION FAULT</span>
        <p className="mt-2 text-xs text-slate-350">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-5 px-4 py-2 border border-cyber-crimson hover:bg-cyber-crimson hover:text-white rounded uppercase text-[10px] font-bold tracking-widest cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-row overflow-hidden font-mono text-[11px] select-none animate-fadeIn">
      {/* 1. Left Controls HUD Panel */}
      <motion.aside
        initial={{ width: 320, opacity: 1 }}
        animate={{ 
          width: leftSidebarOpen ? 320 : 0, 
          opacity: leftSidebarOpen ? 1 : 0 
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="border-r border-obsidian-border bg-obsidian-900/10 flex flex-col justify-between shrink-0 overflow-y-auto scrollbar-thin h-full overflow-hidden"
      >
        {/* Timeline Header Info */}
        <div className="p-5 border-b border-obsidian-border">
          <div className="flex items-center space-x-2 text-cyber-cyan uppercase font-bold tracking-wider mb-2">
            <Activity className="w-4 h-4" />
            <span>Simulation Parameters</span>
          </div>
          <h2 className="text-white font-bold text-xs uppercase truncate">{timeline?.title}</h2>
          <p className="text-[10px] text-slate-400 font-sans mt-1.5 leading-normal">
            {timeline?.description || 'Operational baseline vectors.'}
          </p>
        </div>

        {/* Dynamic Branch Selector list */}
        <div className="p-5 flex-1 border-b border-obsidian-border max-h-56 overflow-y-auto scrollbar-thin">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">Branch Vectors ({branches.length})</div>
          <div className="space-y-1.5">
            {branches.map((b) => {
              const isSelected = selectedBranch?.id === b.id || selectedBranch?._id === b._id;
              return (
                <div
                  key={b.id || b._id}
                  onClick={() => {
                    setSelectedBranch(b);
                    addLog(`SYNC SWITCH: CONSOLE SELECTED BRANCH "${b.branch_name}"`);
                  }}
                  className={`p-2.5 rounded border transition-all cursor-pointer flex items-center justify-between ${isSelected
                    ? 'bg-cyber-cyan/5 border-cyber-cyan/35 text-cyber-cyan shadow-sm shadow-cyber-cyan/5'
                    : 'bg-obsidian-900/50 border-obsidian-border text-slate-400 hover:text-white'
                    }`}
                >
                  <span className="font-bold truncate pr-2 flex items-center">
                    {isSelected && (
                      <span className="relative flex h-1.5 w-1.5 mr-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-cyan opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyber-cyan"></span>
                      </span>
                    )}
                    <span>{b.branch_name.toUpperCase()}</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Split Event Decision Form */}
        <form onSubmit={handleBranchCreation} className="p-5 space-y-4">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Vector Graph Split</div>

          {creationError && (
            <div className="p-2.5 border border-cyber-crimson/35 bg-cyber-crimson-glow text-cyber-crimson text-[10px] uppercase rounded font-bold tracking-wider leading-relaxed animate-fadeIn">
              [!] SPLIT ERROR: {creationError}
            </div>
          )}

          <div>
            <label className="block text-[9px] text-slate-450 uppercase mb-1">BRANCH NAME</label>
            <input
              type="text"
              required
              disabled={submittingBranch}
              value={newBranchName}
              onChange={(e) => { setNewBranchName(e.target.value); setCreationError(''); }}
              className="w-full bg-obsidian-900 border border-obsidian-border rounded px-2.5 py-1.5 text-white placeholder-slate-650 focus:outline-hidden focus:border-cyber-cyan transition-colors"
              placeholder="e.g. Scarcity Shift Beta"
            />
          </div>

          <div>
            <label className="block text-[9px] text-slate-450 uppercase mb-1">INJECTED PASSCODE/DECISION</label>
            <input
              type="text"
              disabled={submittingBranch}
              value={newBranchDecision}
              onChange={(e) => { setNewBranchDecision(e.target.value); setCreationError(''); }}
              className="w-full bg-obsidian-900 border border-obsidian-border rounded px-2.5 py-1.5 text-white placeholder-slate-650 focus:outline-hidden focus:border-cyber-cyan transition-colors"
              placeholder="Baseline parameter delta"
            />
          </div>

          <button
            type="submit"
            disabled={submittingBranch || !newBranchName}
            className="w-full py-2 bg-cyber-cyan/15 border border-cyber-cyan text-cyber-cyan hover:bg-cyber-cyan hover:text-obsidian-950 font-bold uppercase rounded transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            <span>SPLIT TIMELINE</span>
          </button>
        </form>
      </motion.aside>

      {/* 2. Center Graph Viewport */}
      <div ref={containerRef} className="flex-1 flex flex-col min-w-0 bg-obsidian-950 relative overflow-hidden select-none">
        {/* Left Sidebar Toggle Button */}
        <button
          onClick={() => {
            setLeftSidebarOpen(!leftSidebarOpen);
            setTimeout(() => window.dispatchEvent(new Event('resize')), 310);
          }}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-30 p-1.5 bg-obsidian-900/90 hover:bg-cyber-cyan/15 border-y border-r border-obsidian-border hover:border-cyber-cyan text-slate-400 hover:text-white rounded-r-md transition-all cursor-pointer shadow-md"
          title={leftSidebarOpen ? "Collapse Left Panel" : "Expand Left Panel"}
        >
          {leftSidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {/* Right Sidebar Toggle Button */}
        <button
          onClick={() => {
            setRightSidebarOpen(!rightSidebarOpen);
            setTimeout(() => window.dispatchEvent(new Event('resize')), 310);
          }}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-30 p-1.5 bg-obsidian-900/90 hover:bg-cyber-cyan/15 border-y border-l border-obsidian-border hover:border-cyber-cyan text-slate-400 hover:text-white rounded-l-md transition-all cursor-pointer shadow-md"
          title={rightSidebarOpen ? "Collapse Right Panel" : "Expand Right Panel"}
        >
          {rightSidebarOpen ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Glowing Graph HUD Overlay */}
        <div className="absolute top-4 left-4 z-10 bg-obsidian-900/80 backdrop-blur-md border border-obsidian-border/40 px-3.5 py-2 rounded-md flex items-center space-x-3 shadow-lg">
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-cyber-cyan pulse-node-cyan' : 'bg-cyber-crimson animate-pulse'}`} />
          <div className="flex flex-col">
            <span className="font-bold text-[10px] text-white tracking-widest uppercase">Visual telemetry Graph Canvas</span>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-[8px] text-slate-500 uppercase tracking-wider">
                {isConnected ? 'ASGI Socket Online - Realtime Sync Active' : 'ASGI Socket Disconnected'}
              </span>
              {isConnected && (
                <svg className="w-8 h-2.5 text-cyber-cyan opacity-80" viewBox="0 0 40 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M0,5 L10,5 L13,1 L17,9 L20,3 L23,5 L40,5" strokeDasharray="40" strokeDashoffset="40">
                    <animate attributeName="stroke-dashoffset" values="40;0" dur="1.5s" repeatCount="indefinite" />
                  </path>
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* HUD Viewport Actions (Reset Origin + Trigger Sim) */}
        <div className="absolute top-4 right-4 z-10 flex items-center space-x-2">
          <button
            onClick={handleResetZoom}
            title="Reset Viewport Origin"
            className="hud-control-btn p-2 rounded-md border border-obsidian-border text-slate-400 hover:text-white cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleRunSimulation}
            disabled={simulating || !selectedBranch}
            className="px-3.5 py-1.5 bg-cyber-gold/10 border border-cyber-gold/30 hover:border-cyber-gold hover:bg-cyber-gold hover:text-obsidian-950 text-cyber-gold text-[10px] font-bold uppercase rounded-md transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{simulating ? 'SIMULATING...' : 'RUN SIMULATION'}</span>
          </button>
        </div>

        {/* D3 SVG Canvas Container */}
        <div className="flex-1 w-full h-full relative">
          {/* Ambient Center Radial Glow (Priority 6) */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.12),transparent_70%)] pointer-events-none" />

          {/* Layered Grid Opacities (Priority 6) */}
          <div className="absolute inset-0 panel-grid-overlay opacity-15 pointer-events-none" style={{ transform: 'scale(1.15)' }} />
          <div className="absolute inset-0 panel-grid-overlay opacity-30 pointer-events-none" />

          {/* Scanline Sweep Animation (Priority 6) */}
          <div className="absolute inset-0 scanline-effect pointer-events-none opacity-20" />

          {/* Realtime Simulation Overlay (Priority 4) */}
          <AnimatePresence>
            {simulating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-obsidian-950/70 backdrop-blur-xs flex flex-col items-center justify-center z-20 font-mono"
              >
                <div className="w-80 p-4 border border-cyber-gold/45 bg-obsidian-900/95 rounded shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 progress-shimmer" />

                  <div className="flex items-center space-x-2 text-cyber-gold uppercase font-bold tracking-wider mb-2 text-[10px]">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-gold opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber-gold"></span>
                    </span>
                    <span>[ RUNNING MONTE CARLO DIVERGENCE ]</span>
                  </div>

                  <div className="text-[9px] text-slate-400 space-y-1 mt-3">
                    <div className="flex justify-between">
                      <span>VECTOR BINDINGS:</span>
                      <span className="text-white font-bold">{selectedBranch?.branch_name.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SIMULATOR CORE:</span>
                      <span className="text-cyber-cyan font-bold">FastAPI Simulator</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ITERATION MATRIX:</span>
                      <span className="text-cyber-magenta font-bold">10,000 runs</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-obsidian-border/50 text-[8px] text-slate-500 flex items-center justify-between">
                    <span className="animate-pulse">DECRYPTING CO-FLOW SYNC...</span>
                    <span>99.2% SIM VEL</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <svg ref={svgRef} className="w-full h-full block focus:outline-hidden cursor-grab active:cursor-grabbing">
            <defs>
              {/* Cyan Pulse Glow Filter */}
              <filter id="neon-glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Magenta Pulse Glow Filter */}
              <filter id="neon-glow-magenta" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Gold Pulse Glow Filter */}
              <filter id="neon-glow-gold" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Curved Connection Line Gradient */}
              <linearGradient id="cyber-link-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#D946EF" stopOpacity="0.4" />
              </linearGradient>
            </defs>

            <g className="zoom-container">
              {/* Render background telemetry HUD circles */}
              <g className="hud-telemetry-decorations opacity-10" style={{ pointerEvents: 'none' }}>
                <circle cx="200" cy="50%" r="220" fill="none" stroke="#06B6D4" strokeWidth="0.5" strokeDasharray="4,6" />
                <circle cx="200" cy="50%" r="120" fill="none" stroke="#06B6D4" strokeWidth="0.5" />
                <line x1="0" y1="50%" x2="2000" y2="50%" stroke="#06B6D4" strokeWidth="0.5" strokeDasharray="3,9" />
              </g>

              {/* Links are placed underneath nodes */}
              <g className="links-group" />
              <g className="nodes-group" />
            </g>
          </svg>
          {/* Compact Intelligence Card â€” Hover Popup */}
          <AnimatePresence>
            {hoveredNode && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 4 }}
                transition={{ duration: 0.12 }}
                style={{
                  left: Math.min(tooltipPos.x + 16, (containerRef.current?.clientWidth || 800) - 280),
                  top: Math.min(tooltipPos.y + 16, (containerRef.current?.clientHeight || 600) - 300),
                }}
                onMouseEnter={() => {
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                }}
                onMouseLeave={() => {
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                  hoverTimeoutRef.current = setTimeout(() => {
                    setHoveredNode(null);
                  }, 200);
                }}
                className="absolute z-50 w-[260px] border border-obsidian-border/60 bg-obsidian-900/95 backdrop-blur-lg rounded p-0 shadow-2xl font-sans select-none overflow-hidden pointer-events-auto"
              >
                {/* Header Bar */}
                <div className="px-3.5 pt-3 pb-2 border-b border-obsidian-border/40">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-white uppercase text-[10px] truncate max-w-[140px] tracking-wide">
                      {hoveredNode.branch_name}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold tracking-widest ${hoveredNode.depth_level === 1
                      ? 'bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/25'
                      : hoveredNode.divergence_score > 0.6
                        ? 'bg-cyber-crimson/10 text-cyber-crimson border border-cyber-crimson/25'
                        : 'bg-cyber-gold/10 text-cyber-gold border border-cyber-gold/25'
                      }`}>
                      {hoveredNode.depth_level === 1 ? 'BASELINE' : `LVL ${hoveredNode.depth_level}`}
                    </span>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="px-3.5 py-2.5 grid grid-cols-3 gap-2 border-b border-obsidian-border/30">
                  <div>
                    <span className="text-[7px] text-slate-500 uppercase tracking-widest block">Divergence</span>
                    <span className={`text-[11px] font-bold block mt-0.5 ${hoveredNode.divergence_score > 0.6 ? 'text-cyber-crimson' : hoveredNode.divergence_score > 0.2 ? 'text-cyber-gold' : 'text-cyber-cyan'
                      }`}>
                      {((hoveredNode.divergence_score || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[7px] text-slate-500 uppercase tracking-widest block">Risk</span>
                    <span className={`text-[11px] font-bold block mt-0.5 ${(aiReportsCache[hoveredNode.id || hoveredNode._id]?.data?.risk_score || 0) > 0.6 ? 'text-cyber-crimson'
                      : (aiReportsCache[hoveredNode.id || hoveredNode._id]?.data?.risk_score || 0) > 0.3 ? 'text-cyber-gold'
                        : 'text-cyber-cyan'
                      }`}>
                      {aiReportsCache[hoveredNode.id || hoveredNode._id]?.data?.risk_score != null
                        ? (aiReportsCache[hoveredNode.id || hoveredNode._id].data.risk_score).toFixed(2)
                        : 'â€”'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[7px] text-slate-500 uppercase tracking-widest block">Confidence</span>
                    <span className="text-[11px] font-bold text-white block mt-0.5">
                      {aiReportsCache[hoveredNode.id || hoveredNode._id]?.data?.confidence_score != null
                        ? `${(aiReportsCache[hoveredNode.id || hoveredNode._id].data.confidence_score * 100).toFixed(0)}%`
                        : 'â€”'}
                    </span>
                  </div>
                </div>

                {/* AI Preview Snippet */}
                <div className="px-3.5 py-2.5">
                  {aiReportsCache[hoveredNode.id || hoveredNode._id]?.loading ? (
                    <div className="flex items-center space-x-1.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-cyan opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyber-cyan"></span>
                      </span>
                      <span className="text-slate-500 text-[8px] animate-pulse uppercase tracking-wider">Loading intelligence...</span>
                    </div>
                  ) : aiReportsCache[hoveredNode.id || hoveredNode._id]?.data ? (
                    <p className="text-slate-400 leading-relaxed line-clamp-2 text-[9px]">
                      {aiReportsCache[hoveredNode.id || hoveredNode._id].data.future_outlook || aiReportsCache[hoveredNode.id || hoveredNode._id].data.summary || 'Summary compiled.'}
                    </p>
                  ) : hoveredNode.depth_level === 1 ? (
                    <span className="text-slate-600 text-[8px] italic">Compile insight to generate AI intelligence.</span>
                  ) : (
                    <span className="text-slate-600 text-[8px] italic">Run simulation to generate AI intelligence.</span>
                  )}
                </div>

                {/* View Full Summary Button */}
                {aiReportsCache[hoveredNode.id || hoveredNode._id]?.data && (
                  <div className="px-3.5 pb-3">
                    <button
                      className="w-full py-1.5 bg-cyber-cyan/8 border border-cyber-cyan/25 hover:bg-cyber-cyan/15 hover:border-cyber-cyan/50 text-cyber-cyan text-[8px] font-bold uppercase tracking-widest rounded transition-all flex items-center justify-center space-x-1.5 cursor-pointer pointer-events-auto"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                        const branchId = hoveredNode.id || hoveredNode._id;
                        const cached = aiReportsCache[branchId];
                        setDrawerBranch(hoveredNode);
                        setDrawerReport(cached?.data || null);
                        setDrawerOpen(true);
                        setHoveredNode(null);
                      }}
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      <span>View Full AI Summary</span>
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* AI INTELLIGENCE DRAWER â€” Full Slide-Out Panel     */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <AnimatePresence>
        {drawerOpen && drawerReport && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-obsidian-950/60 backdrop-blur-sm z-40"
              onClick={() => setDrawerOpen(false)}
            />

            {/* Drawer Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-[480px] max-w-[90vw] bg-obsidian-900 border-l border-obsidian-border z-50 flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="px-6 py-4 border-b border-obsidian-border flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2.5">
                  <Brain className="w-4.5 h-4.5 text-cyber-magenta" />
                  <div>
                    <span className="text-white font-bold text-xs uppercase tracking-wider block">AI Intelligence Report</span>
                    <span className="text-slate-500 text-[9px] uppercase tracking-widest">
                      {drawerBranch?.branch_name || 'Unknown Branch'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {drawerReport.branch_type && (
                    <span className={`px-2 py-0.5 rounded text-[7px] font-bold tracking-widest border ${drawerReport.branch_type === 'stable_growth' ? 'bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30'
                      : drawerReport.branch_type === 'high_risk_growth' ? 'bg-cyber-gold/10 text-cyber-gold border-cyber-gold/30'
                        : drawerReport.branch_type === 'systemic_collapse' ? 'bg-cyber-crimson/10 text-cyber-crimson border-cyber-crimson/30'
                          : 'bg-cyber-magenta/10 text-cyber-magenta border-cyber-magenta/30'
                      }`}>
                      {drawerReport.branch_type === 'stable_growth' ? 'STABLE'
                        : drawerReport.branch_type === 'high_risk_growth' ? 'HIGH RISK'
                          : drawerReport.branch_type === 'systemic_collapse' ? 'COLLAPSE'
                            : 'REPORT'}
                    </span>
                  )}
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="p-1.5 rounded hover:bg-obsidian-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">

                {/* Telemetry Metrics Grid */}
                <div className="bg-obsidian-950/80 border border-cyber-magenta/20 rounded p-4 font-mono relative overflow-hidden">
                  <div className="absolute inset-y-0 right-0 w-0.5 bg-cyber-magenta opacity-30 animate-[pulse_1.5s_infinite]" />
                  <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold border-b border-obsidian-border/40 pb-2 mb-3 flex items-center justify-between">
                    <span>ALTERNATE TIMELINE REPORT</span>
                    <span className="text-[7px] bg-cyber-magenta/15 px-1.5 rounded text-cyber-magenta">SECURE V.14</span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-[10px]">
                    <div>
                      <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Target Branch</span>
                      <span className="text-cyber-cyan font-bold uppercase truncate block mt-0.5 text-[9px]">
                        {drawerBranch?.branch_name || 'BASELINE'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Divergence</span>
                      <span className={`font-bold block mt-0.5 ${(drawerBranch?.divergence_score || 0) > 0.6 ? 'text-cyber-magenta' : 'text-cyber-cyan'
                        }`}>
                        {((drawerBranch?.divergence_score || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Risk Score</span>
                      <span className={`font-bold block mt-0.5 ${(drawerReport.risk_score || 0) > 0.6 ? 'text-cyber-crimson' : (drawerReport.risk_score || 0) > 0.3 ? 'text-cyber-gold' : 'text-cyber-cyan'
                        }`}>
                        {(drawerReport.risk_score || 0).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Confidence</span>
                      <span className="text-white font-bold block mt-0.5">
                        {((drawerReport.confidence_score || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Future Outlook */}
                {drawerReport.future_outlook && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="bg-obsidian-950/60 border border-obsidian-border/30 rounded p-4">
                    <div className="flex items-center space-x-1.5 mb-2">
                      <Target className="w-3.5 h-3.5 text-cyber-cyan" />
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Future Outlook</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed font-sans">{drawerReport.future_outlook}</p>
                  </motion.div>
                )}

                {/* Event Evolution Timeline */}
                {drawerReport.event_evolution && drawerReport.event_evolution.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-obsidian-950/60 border border-obsidian-border/30 rounded p-4">
                    <div className="flex items-center space-x-1.5 mb-3">
                      <Clock className="w-3.5 h-3.5 text-cyber-gold" />
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Event Evolution</span>
                    </div>
                    <div className="relative pl-4">
                      <div className="absolute left-[5px] top-1 bottom-1 w-px bg-gradient-to-b from-cyber-cyan via-cyber-gold to-cyber-magenta opacity-40" />
                      {drawerReport.event_evolution.map((evt, idx) => (
                        <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + idx * 0.1 }}
                          className="relative mb-3.5 last:mb-0">
                          <div className={`absolute -left-4 top-1 w-2.5 h-2.5 rounded-full border-2 ${evt.status === 'stable' ? 'border-cyber-cyan bg-cyber-cyan/20'
                            : evt.status === 'active' ? 'border-cyber-gold bg-cyber-gold/20'
                              : evt.status === 'warning' ? 'border-amber-400 bg-amber-400/20'
                                : evt.status === 'volatile' ? 'border-cyber-magenta bg-cyber-magenta/20'
                                  : evt.status === 'critical' ? 'border-cyber-crimson bg-cyber-crimson/20'
                                    : evt.status === 'collapsed' ? 'border-red-600 bg-red-600/30'
                                      : 'border-slate-500 bg-slate-500/20'
                            }`} />
                          <div className="ml-2">
                            <div className="flex items-center space-x-2 mb-0.5">
                              <span className="text-[10px] font-bold text-cyber-cyan tracking-wider">{evt.timeframe}</span>
                              <ArrowRight className="w-2.5 h-2.5 text-slate-600" />
                              <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${evt.status === 'stable' ? 'bg-cyber-cyan/10 text-cyber-cyan'
                                : evt.status === 'active' ? 'bg-cyber-gold/10 text-cyber-gold'
                                  : evt.status === 'warning' ? 'bg-amber-400/10 text-amber-400'
                                    : evt.status === 'volatile' ? 'bg-cyber-magenta/10 text-cyber-magenta'
                                      : evt.status === 'critical' ? 'bg-cyber-crimson/10 text-cyber-crimson'
                                        : evt.status === 'collapsed' ? 'bg-red-600/10 text-red-500'
                                          : 'bg-slate-600/10 text-slate-400'
                                }`}>{evt.status}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed font-sans">{evt.state}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Risk Analysis */}
                {drawerReport.risk_analysis && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                    className="bg-obsidian-950/60 border border-obsidian-border/30 rounded p-4">
                    <div className="flex items-center space-x-1.5 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-cyber-crimson" />
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Risk Analysis</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{drawerReport.risk_analysis}</p>
                  </motion.div>
                )}

                {/* Opportunity Analysis */}
                {drawerReport.opportunity_analysis && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="bg-obsidian-950/60 border border-obsidian-border/30 rounded p-4">
                    <div className="flex items-center space-x-1.5 mb-2">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Opportunity Analysis</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{drawerReport.opportunity_analysis}</p>
                  </motion.div>
                )}

                {/* Timeline Stability */}
                {drawerReport.timeline_stability && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                    className="bg-obsidian-950/60 border border-obsidian-border/30 rounded p-4">
                    <div className="flex items-center space-x-1.5 mb-2">
                      <Shield className="w-3.5 h-3.5 text-cyber-gold" />
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Timeline Stability</span>
                    </div>
                    <p className={`text-[11px] font-bold leading-relaxed ${drawerReport.timeline_stability.startsWith('HIGH') ? 'text-cyber-cyan'
                      : drawerReport.timeline_stability.startsWith('MODERATE') ? 'text-cyber-gold'
                        : 'text-cyber-crimson'
                      }`}>{drawerReport.timeline_stability}</p>
                  </motion.div>
                )}

                {/* Divergence Reason */}
                {drawerReport.divergence_reason && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                    className="bg-obsidian-950/60 border border-obsidian-border/30 rounded p-4">
                    <div className="flex items-center space-x-1.5 mb-2">
                      <Zap className="w-3.5 h-3.5 text-cyber-magenta" />
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Divergence Reason</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{drawerReport.divergence_reason}</p>
                  </motion.div>
                )}

                {/* Strategic Recommendation */}
                {drawerReport.strategic_outlook && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
                    className={`rounded p-4 border ${drawerReport.strategic_outlook.startsWith('RECOMMENDED') ? 'bg-cyber-cyan/5 border-cyber-cyan/25'
                      : drawerReport.strategic_outlook.startsWith('CONDITIONAL') ? 'bg-cyber-gold/5 border-cyber-gold/25'
                        : drawerReport.strategic_outlook.startsWith('NOT RECOMMENDED') ? 'bg-cyber-crimson/5 border-cyber-crimson/25'
                          : 'bg-obsidian-950/60 border-obsidian-border/30'
                      }`}>
                    <div className="flex items-center space-x-1.5 mb-2">
                      <CheckCircle className={`w-3.5 h-3.5 ${drawerReport.strategic_outlook.startsWith('RECOMMENDED') ? 'text-cyber-cyan'
                        : drawerReport.strategic_outlook.startsWith('CONDITIONAL') ? 'text-cyber-gold'
                          : 'text-cyber-crimson'
                        }`} />
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Strategic Recommendation</span>
                    </div>
                    <p className={`text-[11px] font-bold leading-relaxed ${drawerReport.strategic_outlook.startsWith('RECOMMENDED') ? 'text-cyber-cyan'
                      : drawerReport.strategic_outlook.startsWith('CONDITIONAL') ? 'text-cyber-gold'
                        : drawerReport.strategic_outlook.startsWith('NOT RECOMMENDED') ? 'text-cyber-crimson'
                          : 'text-slate-300'
                      }`}>{drawerReport.strategic_outlook}</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 3. Right Utility Panel (Compile + Cockpit Logs) */}
      <motion.aside
        initial={{ width: 288, opacity: 1 }}
        animate={{ 
          width: rightSidebarOpen ? 288 : 0, 
          opacity: rightSidebarOpen ? 1 : 0 
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="border-l border-obsidian-border bg-obsidian-900/10 flex flex-col shrink-0 h-full overflow-hidden"
      >
        {/* Selected Branch Quick Info */}
        <div className="p-4 border-b border-obsidian-border">
          <div className="flex items-center space-x-2 text-cyber-magenta uppercase font-bold tracking-wider mb-3">
            <Brain className="w-4 h-4" />
            <span className="text-[10px]">Intelligence</span>
          </div>

          {selectedBranch ? (
            <div className="space-y-2.5">
              <div className="bg-obsidian-950/60 border border-obsidian-border/30 rounded p-3">
                <span className="text-[8px] text-slate-500 uppercase tracking-widest block mb-1">Selected Branch</span>
                <span className="text-cyber-cyan font-bold text-[10px] uppercase truncate block">{selectedBranch.branch_name}</span>
              </div>

              {/* Open Drawer Button — if we have a report for this branch */}
              {(aiReportsCache[selectedBranch.id || selectedBranch._id]?.data || aiReport) && (
                <button
                  onClick={() => {
                    setDrawerBranch(selectedBranch);
                    setDrawerReport(aiReportsCache[selectedBranch.id || selectedBranch._id]?.data || aiReport);
                    setDrawerOpen(true);
                  }}
                  className="w-full py-2 bg-cyber-cyan/8 border border-cyber-cyan/25 hover:bg-cyber-cyan/15 hover:border-cyber-cyan/50 text-cyber-cyan text-[9px] font-bold uppercase tracking-widest rounded transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open AI Report</span>
                </button>
              )}
            </div>
          ) : (
            <div className="text-slate-600 text-[9px] italic text-center py-4">
              Select a branch node to begin.
            </div>
          )}
        </div>

        {/* Compile Cognitive Insight Button */}
        <div className="p-4 border-b border-obsidian-border">
          <button
            onClick={handleGenerateSummary}
            disabled={generatingAi || !selectedBranch}
            className="w-full py-2 bg-cyber-magenta/10 border border-cyber-magenta text-cyber-magenta hover:bg-cyber-magenta hover:text-obsidian-950 font-bold uppercase rounded transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 text-[9px]"
          >
            <Brain className="w-3.5 h-3.5" />
            <span>{generatingAi ? 'ANALYZING...' : 'COMPILE INSIGHT'}</span>
          </button>
        </div>

        {/* Real-time Telemetry Logs Box */}
        <div className="p-4 flex-1 bg-obsidian-950/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 uppercase tracking-widest font-bold mb-2">
            <span className="flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5" />
              <span className="text-[9px]">COCKPIT LOGS</span>
            </span>
            <span className="text-[7px] px-1 bg-obsidian-900 border border-obsidian-border rounded">STABLE</span>
          </div>

          <div ref={logRef} className="flex-1 overflow-y-auto font-mono text-[9px] text-slate-450 leading-relaxed space-y-1.5 scrollbar-thin pr-1">
            {consoleLogs.map((log, index) => (
              <div key={index} className="truncate">
                {log}
              </div>
            ))}
          </div>
        </div>
      </motion.aside>
    </div>
  );
}

