"use client";
import { useState, useEffect } from 'react';
import { CheckCircle2, Projector, User, Calendar, ArrowRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';

import { arc } from 'd3-shape';
import { animate, motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import LoadingOverlay from '../components/LoadingOverlay';
import { useAuth } from '../components/AuthProvider';

const AnimatedPath = ({ item, startAngle, endAngle, pathGenerator, tooltip, setTooltip }) => {
  // Start from 0 to create a "sweep-in" intro animation from the top (0 rad)
  const [sAngle, setSAngle] = useState(0);
  const [eAngle, setEAngle] = useState(0);

  useEffect(() => {
    // Animate from current (0 initially) to the target angles
    const c1 = animate(sAngle, startAngle, { type: "spring", bounce: 0, duration: 1.2, onUpdate: v => setSAngle(v) });
    const c2 = animate(eAngle, endAngle, { type: "spring", bounce: 0, duration: 1.2, onUpdate: v => setEAngle(v) });
    return () => { c1.stop(); c2.stop(); };
  }, [startAngle, endAngle]);

  // Protect against spring physics overshoots causing inverted arcs
  const safeEndAngle = Math.max(sAngle, eAngle);
  const d = pathGenerator({ startAngle: sAngle, endAngle: safeEndAngle });
  
  const isHovered = tooltip.show && tooltip.data?.name === item.name;

  return (
    <path
      d={d}
      fill={item.color}
      style={{
        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: 'pointer',
        transform: isHovered ? 'scale(1.03)' : 'scale(1)',
        transformOrigin: '0 0'
      }}
      onMouseEnter={(e) => setTooltip({ show: true, x: e.clientX, y: e.clientY, data: item })}
      onMouseMove={(e) => setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }))}
      onMouseLeave={() => setTooltip(prev => ({ ...prev, show: false }))}
    />
  );
};

const DonutChart = ({ data, centerText, centerSubtext }) => {
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, data: null });
  const total = Math.max(0.0001, data.reduce((acc, curr) => acc + curr.value, 0));
  let currentAngle = 0; // Angles in radians from 0 to 2*PI

  // D3 generates paths from center (0,0) with exact inner/outer radius and perfectly curved flat corners
  const pathGenerator = arc()
    .innerRadius(33) // stroke thickness roughly 10
    .outerRadius(48)
    .cornerRadius(1.8); // 'slight roundish' corner radius

  return (
    <>
      <div style={{ position: 'relative', width: '220px', height: '220px', margin: '0 auto' }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <g transform="translate(50, 50)">
            {data.map((item) => {
              const fraction = item.value / total;
              
              const sweep = fraction * 2 * Math.PI;
              // Introduce a small angle gap (~2.8 degrees) between pieces
              const gap = (fraction === 1 || fraction === 0) ? 0 : 0.05;
              
              const startAngle = currentAngle;
              let endAngle = currentAngle + sweep - gap;
              
              // Allow endAngle to equal startAngle so math collapses to 0 and hiding works
              if (endAngle < startAngle) {
                endAngle = startAngle;
              }
              
              currentAngle += sweep;
              
              return (
                <AnimatedPath
                  key={item.name}
                  item={item}
                  startAngle={startAngle}
                  endAngle={endAngle}
                  pathGenerator={pathGenerator}
                  tooltip={tooltip}
                  setTooltip={setTooltip}
                />
              );
            })}
          </g>
        </svg>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: '600', marginBottom: '4px' }}>{centerSubtext}</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--color-text-main)', lineHeight: 1 }}>{centerText}</div>
        </div>
      </div>

      {/* Tooltip Portal */}
      {tooltip.show && tooltip.data && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 15,
          top: tooltip.y + 15,
          backgroundColor: '#0f172a',
          padding: '10px 14px',
          borderRadius: '10px',
          pointerEvents: 'none',
          zIndex: 9999,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: tooltip.data.color }}></div>
          <div style={{ color: 'white', fontSize: '0.85rem', fontWeight: '600' }}>
            {tooltip.data.name}: <span style={{ color: 'var(--color-text-light)', marginLeft: '4px' }}>{tooltip.data.value} {tooltip.data.value === 1 ? 'Bugs' : 'Bugs'}</span>
          </div>
        </div>
      )}
    </>
  );
};

const PriorityTrendChart = ({ bugs }) => {
  const [hoverX, setHoverX] = useState(null);
  const [hoverBucketIdx, setHoverBucketIdx] = useState(null);
  const [hoveredPriorities, setHoveredPriorities] = useState([]);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  if (!bugs || bugs.length === 0) return (
    <div className="card" style={{ padding: '32px', backgroundColor: 'var(--chrome-bg-raised)', borderRadius: '24px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-light)', fontSize: '0.9rem' }}>
      No bug data to display.
    </div>
  );

  // Build 5 equal time-range buckets spanning all bug dates
  const now = new Date();
  let minDate = new Date();
  let maxDate = now; // Always set maxDate to NOW so the graph reflects the latest state
  bugs.forEach(b => {
    if (b.createdAt) {
      const d = new Date(b.createdAt);
      if (d < minDate) minDate = d;
    }
  });

  if (maxDate.getTime() - minDate.getTime() < 1000) {
    minDate = new Date(minDate.getTime() - 3 * 24 * 60 * 60 * 1000);
  }

  // Helper: determine bug state (status/priority) at a specific timestamp T
  const getBugStateAtTime = (bug, timestamp) => {
    let logs = [];
    try {
      logs = typeof bug.activityLog === 'string' ? JSON.parse(bug.activityLog) : (bug.activityLog || []);
    } catch (e) { logs = []; }

    // Use "Reverse Replay" strategy: Start with current state and undo changes that happened AFTER timestamp T
    let status = bug.status || 'Open';
    let priority = bug.priority || 'Low';

    // Find all logs that occurred AFTER the snapshot time T
    const futureLogs = logs
      .filter(l => new Date(l.date).getTime() > timestamp)
      .sort((a,b) => new Date(b.date) - new Date(a.date)); // Process logs newest-to-oldest

    // Undo each change to get back to the state at time T
    futureLogs.forEach(l => {
      if (l.fieldKey === 'status' && l.from !== undefined) status = l.from;
      if (l.fieldKey === 'priority' && l.from !== undefined) priority = l.from;
    });

    return { status, priority };
  };

  const NUM_BUCKETS = 5;
  const interval = (maxDate.getTime() - minDate.getTime()) / (NUM_BUCKETS - 1);

  // For each of the 5 time points, we'll take a complete "State of the World" snapshot
  const buckets = Array.from({ length: NUM_BUCKETS }, (_, i) => {
    const snapTime = minDate.getTime() + interval * i;
    const d = new Date(snapTime);
    const label = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
    
    const snapshot = {
      time: snapTime, label,
      Critical: 0, High: 0, Medium: 0, Low: 0,
      projectBreakdown: {}
    };

    // Evaluate every bug to see if it was active at this specific timestamp
    bugs.forEach(b => {
      const created = new Date(b.createdAt).getTime();
      if (created > snapTime) return; // Not yet created

      const state = getBugStateAtTime(b, snapTime);
      const isResolved = ['resolved', 'closed', 'fixed'].includes(state.status?.toLowerCase());
      if (!isResolved) {
        const p = ['Critical', 'High', 'Medium', 'Low'].includes(state.priority) ? state.priority : 'Low';
        const proj = b.project || 'General';

        snapshot[p]++;
        if (!snapshot.projectBreakdown[proj]) {
          snapshot.projectBreakdown[proj] = { Critical: 0, High: 0, Medium: 0, Low: 0 };
        }
        snapshot.projectBreakdown[proj][p]++;
      }
    });

    return snapshot;
  });

  let rawMax = 1;
  buckets.forEach(d => { rawMax = Math.max(rawMax, d.Critical, d.High, d.Medium, d.Low); });
  const maxY = Math.ceil(rawMax * 1.25);

  const W = 700, H = 280;
  const LEFT = 48, RIGHT = 160, TOP = 20, BOTTOM = 40;
  const chartW = W - LEFT - RIGHT;
  const chartH = H - TOP - BOTTOM;

  const getX = (i) => LEFT + (NUM_BUCKETS > 1 ? (i / (NUM_BUCKETS - 1)) * chartW : chartW / 2);
  const getY = (v) => TOP + chartH - (v / maxY) * chartH;

  const colors = { Critical: '#f43f5e', High: '#f97316', Medium: '#22c55e', Low: '#3b82f6' };
  const priorities = ['Low', 'Medium', 'High', 'Critical'];

  const buildCurve = (key) => {
    const pts = buckets.map((d, i) => ({ x: getX(i), y: getY(d[key]) }));
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1], curr = pts[i];
      const cpX = (prev.x + curr.x) / 2;
      d += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  };

  const yTicks = [];
  for (let i = 0; i <= 5; i++) yTicks.push(Math.round((maxY / 5) * i));

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const svgX = (mouseX / rect.width) * W;
    const svgY = (mouseY / rect.height) * H;

    if (svgX < LEFT || svgX > LEFT + chartW) {
      setHoverX(null); setHoverBucketIdx(null); setHoveredPriorities([]); return;
    }

    // Find nearest bucket on X axis
    let nearest = 0, nearestDist = Infinity;
    buckets.forEach((_, i) => {
      const dist = Math.abs(getX(i) - svgX);
      if (dist < nearestDist) { nearestDist = dist; nearest = i; }
    });

    // Find all priority lines on Y axis at this bucket that are near the mouse
    const nearbyPriorities = [];
    const yThreshold = 8; // Adjust this to control sensitivity of "binding"
    
    priorities.forEach(p => {
      const lineY = getY(buckets[nearest][p]);
      if (Math.abs(lineY - svgY) < yThreshold) {
        nearbyPriorities.push(p);
      }
    });

    // Fallback: If nothing is near, find the single closest one
    if (nearbyPriorities.length === 0) {
      let closest = priorities[0], minDist = Infinity;
      priorities.forEach(p => {
        const dist = Math.abs(getY(buckets[nearest][p]) - svgY);
        if (dist < minDist) { minDist = dist; closest = p; }
      });
      nearbyPriorities.push(closest);
    }

    setHoverX(getX(nearest));
    setHoverBucketIdx(nearest);
    setHoveredPriorities(nearbyPriorities);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const hoveredBucket = hoverBucketIdx !== null ? buckets[hoverBucketIdx] : null;

  // Build tooltip data for all hovered priorities
  const tooltipData = (() => {
    if (!hoveredBucket || hoveredPriorities.length === 0) return [];
    
    return hoveredPriorities.map(prio => {
      const rows = Object.entries(hoveredBucket.projectBreakdown)
        .map(([proj, counts]) => ({ proj, count: counts[prio] || 0 }))
        .filter(r => r.count > 0)
        .sort((a, b) => b.count - a.count);
      
      return { priority: prio, rows, total: hoveredBucket[prio] };
    });
  })();

  return (
    <motion.div 
      className="card" 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{ 
        position: 'relative',
        padding: '20px 24px',
        backgroundColor: 'var(--chrome-bg-raised)',
        borderRadius: '24px',
        border: '1px solid var(--color-border)',
        boxShadow: '0 4px 20px -4px rgba(0,0,0,0.06)',
        display: 'flex', 
        flexDirection: 'column' 
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Priority Timeline</div>
          <p style={{ color: 'var(--color-text-light)', fontSize: '0.8rem', marginTop: '4px' }}>Active (unresolved) bugs across all severity tiers.</p>
        </div>
      </div>

      {/* Rich HTML Tooltip — rendered outside SVG for full flexibility */}
      {/* DYNAMIC TOOLTIP (BINDING MULTIPLE PRIORITIES) - CRYSTAL WHITE THEME */}
      {hoverBucketIdx !== null && tooltipData.length > 0 && (
        <div style={{
          position: 'fixed', left: tooltipPos.x + 16, top: tooltipPos.y - 10,
          backgroundColor: 'var(--chrome-bg-raised)', color: 'var(--color-text-main)', padding: '16px', borderRadius: '20px',
          fontSize: '0.85rem', pointerEvents: 'none', zIndex: 1000,
          boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05)',
          backdropFilter: 'blur(12px)', border: '1px solid var(--color-border)',
          minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '16px'
        }}>
          <div style={{ paddingBottom: '10px', borderBottom: '1px solid var(--color-border-light)', fontWeight: '800', fontSize: '0.95rem', color: 'var(--color-text-main)' }}>
            {hoveredBucket.label} Baseline
          </div>
          
          {tooltipData.map((section, idx) => (
            <div key={section.priority} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '4px', backgroundColor: colors[section.priority] }}></div>
                  <span style={{ fontWeight: '900', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: colors[section.priority] }}>
                    {section.priority}
                  </span>
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: '900', color: 'var(--color-text-main)' }}>{section.total} <span style={{ fontWeight: '500', color: 'var(--color-text-muted)' }}>Active</span></span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {section.rows.map(row => (
                  <div key={row.proj} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: '500' }}>{row.proj}</span>
                    <span style={{ fontWeight: '800', color: 'var(--color-text-main)' }}>{row.count}</span>
                  </div>
                ))}
              </div>
              
              {idx < tooltipData.length - 1 && <div style={{ height: '1px', backgroundColor: 'var(--color-bg-body)', marginTop: '8px' }} />}
            </div>
          ))}
        </div>
      )}

      <div style={{ position: 'relative', width: '100%', minHeight: `${H}px` }}
           onMouseMove={handleMouseMove}
           onMouseLeave={() => { setHoverX(null); setHoverBucketIdx(null); setHoveredPriorities([]); }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
             style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}>

          {/* Horizontal grid lines + Y-axis labels */}
          {yTicks.map((val, i) => {
            const y = getY(val);
            return (
              <g key={`ytick-${i}`}>
                <line x1={LEFT} y1={y} x2={LEFT + chartW} y2={y} stroke="#f1f5f9" strokeWidth="1.5" />
                <text x={LEFT - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="11" fontWeight="600">{val}</text>
              </g>
            );
          })}

          {/* Hover crosshair */}
          {hoverX !== null && (
            <g>
              <polygon points={`${hoverX},${TOP - 2} ${hoverX - 5},${TOP - 10} ${hoverX + 5},${TOP - 10}`} fill="#0f172a" />
              <line x1={hoverX} y1={TOP} x2={hoverX} y2={TOP + chartH} stroke="#0f172a" strokeWidth="1.5" strokeDasharray="5,4" />
              <polygon points={`${hoverX},${TOP + chartH + 2} ${hoverX - 5},${TOP + chartH + 10} ${hoverX + 5},${TOP + chartH + 10}`} fill="#0f172a" />
              {/* Highlight circles on the hovered priority lines */}
              {hoveredBucket && hoveredPriorities.map(prio => (
                <circle key={`hover-circle-${prio}`} cx={hoverX} cy={getY(hoveredBucket[prio])} r="6" fill="white" stroke={colors[prio]} strokeWidth="2.5" />
              ))}
            </g>
          )}

          {/* Smooth Bézier Lines with DRAW ANIMATION */}
          {priorities.map(p => (
            <motion.path 
                  key={`line-${p}`} 
                  d={buildCurve(p)} 
                  fill="none" 
                  stroke={colors[p]}
                  strokeWidth={hoveredPriorities.includes(p) ? 4 : 3}
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: "easeInOut", delay: 0.1 }}
                  style={{ transition: 'stroke-width 0.15s' }} />
          ))}

          {/* Pill labels at line endings */}
          {/* Pill labels at line endings with collision detection */}
          {(() => {
            const lastBucket = buckets[NUM_BUCKETS - 1];
            const pillH = 26;
            const minDist = 28; // Standard vertical clearance for 26px pills
            
            // 1. Map labels to their preferred Y positions
            let pillPositions = priorities.map(p => ({
              priority: p,
              y: getY(lastBucket[p]),
              color: colors[p],
              width: p.length * 8 + 24
            }));
            
            // 2. Sort by Y to find neighbors
            pillPositions.sort((a, b) => a.y - b.y);
            
            // 3. Adjust overlapping positions (One-pass push logic)
            for (let i = 1; i < pillPositions.length; i++) {
              const prev = pillPositions[i - 1];
              const curr = pillPositions[i];
              if (curr.y - prev.y < minDist) {
                curr.y = prev.y + minDist;
              }
            }
            
            return pillPositions.map(p => (
              <g key={`pill-${p.priority}`}>
                <rect x={getX(NUM_BUCKETS - 1) + 12} y={p.y - pillH / 2} width={p.width} height={pillH} rx={pillH / 2} fill={p.color} />
                <text x={getX(NUM_BUCKETS - 1) + 12 + p.width / 2} y={p.y + 5} textAnchor="middle" fill="white" fontSize="12" fontWeight="700">{p.priority}</text>
              </g>
            ));
          })()}

          {/* X Axis Labels */}
          {buckets.map((d, i) => (
            <text key={`xlabel-${i}`} x={getX(i)} y={H - 8} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600">{d.label}</text>
          ))}
          {/* Final closing tag for motion.div Wrapper */}
        </svg>
      </div>
    </motion.div>
  );
};

export default function AnalyticsPage() {
  const { globalBugs } = useAuth();
  const [bugs, setBugs] = useState(() => Array.isArray(globalBugs) ? globalBugs : []);
  const [loading, setLoading] = useState(!(globalBugs && globalBugs.length > 0));
  const [hiddenProjects, setHiddenProjects] = useState(new Set());

  useEffect(() => {
    if (globalBugs && globalBugs.length > 0) {
      setBugs(globalBugs);
      setLoading(false);
    }
  }, [globalBugs]);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/bugs', { cache: 'no-store' });
      if (!res.ok) { setBugs([]); return; }
      const data = await res.json();
      const bugsArr = Array.isArray(data) ? data : (data.bugs || []);
      setBugs(bugsArr);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll silently every 1 second so graphs update immediately after resolving tickets
    const interval = setInterval(() => fetchData(true), 1000);
    return () => clearInterval(interval);
  }, []);

  const calculateStats = () => {
    // Calculate projectGroup from ALL bugs so legends are always fully preserved
    const projectGroup = bugs.reduce((acc, b) => {
      const p = b.project || 'General';
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {});

    // Global KPI values — always computed from ALL bugs, never affected by legend toggles
    const globalTotal = bugs.length;
    const resolvedTerms = ['resolved', 'closed', 'fixed'];
    const globalResolved = bugs.filter(b => resolvedTerms.includes(b.status?.toLowerCase())).length;
    
    // Critical & High should represent the ACTIVE (unresolved) load to guide immediate action
    const globalCritical = bugs.filter(b => 
      b.priority?.toLowerCase() === "critical" && 
      !resolvedTerms.includes(b.status?.toLowerCase())
    ).length;
    
    const globalHigh = bugs.filter(b => 
      b.priority?.toLowerCase() === "high" && 
      !resolvedTerms.includes(b.status?.toLowerCase())
    ).length;
    
    const globalResolutionRate = globalTotal > 0 ? Math.round((globalResolved / globalTotal) * 100) : 0;

    // Filter bugs for chart-specific views based on active legend toggles
    const visibleBugs = bugs.filter(b => {
      const p = b.project || 'General';
      return !hiddenProjects.has(p);
    });

    const priorityGroup = visibleBugs.reduce((acc, b) => {
      const p = b.priority || 'Low';
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {});

    // Resolution rate for the donut center — filtered by active project labels
    const visibleTotal = visibleBugs.length;
    const visibleResolved = visibleBugs.filter(b => b.status?.toLowerCase() === 'resolved').length;
    const visibleResolutionRate = visibleTotal > 0 ? Math.round((visibleResolved / visibleTotal) * 100) : 0;

    return {
      // Global (widget) stats
      total: globalTotal,
      resolved: globalResolved,
      critical: globalCritical,
      high: globalHigh,
      resolutionRate: globalResolutionRate,
      // Chart-specific (filtered) data
      visibleResolutionRate,
      visibleBugs,
      priorityGroup,
      projectGroup
    };
  };

  if (loading) return <LoadingOverlay message="Analyzing Bug Data" subtext="Synthesizing trend reports and project heatmaps..." />;

  const stats = calculateStats();

  const fallbackColors = ['#ec4899', '#f43f5e', '#14b8a6', '#0ea5e9'];
  let fallbackIdx = 0;

  const donutData = Object.keys(stats.projectGroup).map((key) => {
    let color;
    const nameLower = key.toLowerCase();

    if (nameLower.includes('hospital')) {
      color = '#36B189'; // Mint Green
    } else if (nameLower.includes('laborator')) {
      color = '#ef4444'; // Bright Red (ultra distinct)
    } else if (nameLower.includes('pharmac')) {
      color = '#F2AE40'; // Yellow Orange
    } else if (nameLower.includes('clinic')) {
      color = '#6C9BF5'; // Cornflower Blue
    } else {
      color = fallbackColors[fallbackIdx % fallbackColors.length];
      fallbackIdx++;
    }

    return {
      name: key,
      value: stats.projectGroup[key],
      color,
      originalValue: stats.projectGroup[key] // Keep track of original for other uses if needed
    };
  });

  // Zero-out the values for hidden projects instead of unmounting them so Framer Motion animates them cleanly to zero.
  const chartDisplayData = donutData.map(item => ({
     ...item,
     value: hiddenProjects.has(item.name) ? 0 : item.value
  }));

  const toggleProject = (name) => {
    setHiddenProjects(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <main style={{ maxWidth: 1400 }}>
      <PageHeader
        title="Analytics"
        subtitle="Project health and bug resolution trends across your workspace."
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        borderTop: '1px solid var(--chrome-border)',
        borderBottom: '1px solid var(--chrome-border)',
        marginBottom: 28
      }}>
        <StatCell label="Total Bugs"      value={stats.total} />
        <StatCell label="Resolution Rate" value={`${stats.resolutionRate}%`} tint={stats.resolutionRate >= 60 ? '#22c55e' : null} />
        <StatCell label="Critical"        value={stats.critical} tint={stats.critical > 0 ? '#ef4444' : null} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 2fr) minmax(380px, 1fr)', gap: '16px' }}>

        {/* PRIORITY TIMELINE TREND GRAPH */}
        <PriorityTrendChart bugs={bugs} />

        {/* PROJECT DISTRIBUTION SECTION - FADE IN ONLY */}
        <motion.div 
          className="card" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{ padding: '24px', backgroundColor: 'var(--chrome-bg-raised)', borderRadius: '24px', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-start', marginBottom: '20px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Project Distribution</div>
          </div>

          <DonutChart
            data={chartDisplayData}
            centerText={`${stats.visibleResolutionRate}%`}
            centerSubtext="Resolved"
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'center', marginTop: '40px' }}>
            {donutData.map(item => {
              const isHidden = hiddenProjects.has(item.name);
              return (
                <div 
                   key={item.name} 
                   onClick={() => toggleProject(item.name)}
                   style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      cursor: 'pointer',
                      opacity: isHidden ? 0.4 : 1,
                      transition: 'opacity 0.2s'
                   }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: isHidden ? '#cbd5e1' : item.color }}></div>
                  <span style={{ fontSize: '0.9rem', fontWeight: '600', color: isHidden ? 'var(--color-text-light)' : 'var(--color-text-main)', textDecoration: isHidden ? 'line-through' : 'none' }}>{item.name}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .loading-screen {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: var(--color-text-muted);
        }
        .pill-btn {
          border: 1px solid #e2e8f0;
          background: white;
          padding: 6px 16px;
          border-radius: 99px;
          font-size: 0.75rem;
          font-weight: 700;
          color: #64748b;
          cursor: pointer;
        }
        .pill-btn.active {
          background-color: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }
      `}</style>
    </main>
  );
}

function StatCell({ label, value, tint }) {
  return (
    <div style={{
      padding: '18px 20px',
      borderRight: '1px solid var(--chrome-border)',
      display: 'flex', flexDirection: 'column', gap: 6
    }}>
      <div style={{
        fontSize: '1.8rem', fontWeight: 600,
        color: tint || 'var(--color-text-main)',
        lineHeight: 1, letterSpacing: '-0.02em'
      }}>{value}</div>
      <div style={{
        fontSize: '0.72rem', fontWeight: 500,
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em'
      }}>{label}</div>
    </div>
  );
}
