'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Circle, Text, Group, Transformer, Line, Ellipse } from 'react-konva';
import { useTableTide } from '../context/TableTideContext';
import { Table, JoinedGroup, Reservation } from '../types';
import { Clock, Users, X, AlertTriangle, Plus, CheckCircle2, User } from 'lucide-react';
import canvasConfetti from 'canvas-confetti';

interface FloorCanvasProps {
  readOnly?: boolean;
}

export default function FloorCanvas({ readOnly = false }: FloorCanvasProps) {
  const {
    tables,
    joinedGroups,
    reservations,
    selectedTableIds,
    setSelectedTableIds,
    activeReservationId,
    isAssigningMode,
    assignReservationToTable,
    updateTable,
    activeDate,
    seatWalkIn,
    updateReservation,
    isLayoutEditMode,
  } = useTableTide();

  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track selected nodes for transformer
  const [selectedNodes, setSelectedNodes] = useState<any[]>([]);

  // Periodic tick to force re-render of active timers every 10 seconds
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const [activeTableModal, setActiveTableModal] = useState<Table | null>(null);
  const [walkInCovers, setWalkInCovers] = useState<number>(2);

  // Sync walk-in covers state whenever active table modal opens
  useEffect(() => {
    if (activeTableModal) {
      const modalGroup = activeTableModal.parentId 
        ? joinedGroups.find((g) => g.id === activeTableModal.parentId) 
        : null;
      const defaultCapacity = modalGroup ? modalGroup.capacity : activeTableModal.capacity;
      setWalkInCovers(defaultCapacity);
    }
  }, [activeTableModal, joinedGroups]);

  // Fluid responsive stage variables relative to the 1380px baseline coordinate blueprint
  const [dimensions, setDimensions] = useState({ width: 1380, height: 500 });
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const handleResize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const parentWidth = rect.width;
      
      // Calculate responsive ratio relative to base coordinate width (1380px)
      const paddedWidth = Math.max(300, parentWidth - 32);
      const newScale = paddedWidth / 1380;
      
      setScale(newScale);
      setDimensions({
        width: paddedWidth,
        height: 500 * newScale,
      });
    };

    handleResize();
    
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // 1. Snapping constants
  const GRID_SIZE = 20;

  // 2. Helper to find reservation assigned to a table / group today
  const getTableReservation = (table: Table): Reservation | undefined => {
    const targetId = table.parentId || table.id;
    return reservations.find(
      (r) => r.tableId === targetId && r.date === activeDate
    );
  };

  // 3. Helper to determine color schemes based on table status
  const getTableColors = (table: Table, isSelected: boolean) => {
    const res = getTableReservation(table);
    
    // Sunlight-Readable Status Colors: Neutral, Assigned, Seated, Completed
    let fill = '#ffffff';
    let stroke = '#1e293b'; // Strong dark slate borders
    let shadowColor = 'transparent';
    let textColor = '#475569';
    let guestTextColor = '#1d4ed8'; // Royal Blue for active guest assignments

    if (res) {
      if (res.status === 'Pending') {
        fill = '#fffbeb'; // Soft Amber background
        stroke = '#d97706'; // Strong Amber Gold border
        shadowColor = 'rgba(217, 119, 6, 0.2)';
        textColor = '#92400e';
        guestTextColor = '#0f172a';
      } else if (res.status === 'Seated') {
        // Calculate elapsed time for red warning status (1 hour 45 minutes)
        const elapsed = res.seatedAtTimestamp ? Math.floor((Date.now() - res.seatedAtTimestamp) / 60000) : 0;
        const isWarning = elapsed >= 105;

        if (isWarning) {
          fill = '#fef2f2'; // Soft red background
          stroke = '#dc2626'; // Bold crimson border
          shadowColor = 'rgba(220, 38, 38, 0.45)'; // High-visibility red glowing aura for outdoor glare
          textColor = '#991b1b'; // Deep red
          guestTextColor = '#7f1d1d';
        } else {
          fill = '#f0fdf4'; // Soft emerald background
          stroke = '#15803d'; // Thick Forest Green border
          shadowColor = 'rgba(21, 128, 61, 0.2)';
          textColor = '#166534';
          guestTextColor = '#0f172a';
        }
      } else if (res.status === 'Completed') {
        fill = '#f8fafc'; // Faint gray
        stroke = '#cbd5e1'; // Muted grey border
        textColor = '#94a3b8';
        guestTextColor = '#94a3b8';
      }
    }

    // Glowing border when in active selection or active assigning mode
    if (isSelected) {
      stroke = '#0f172a'; // Navy Blue selection ring
      shadowColor = 'rgba(15, 23, 42, 0.25)';
    } else if (isAssigningMode && !res) {
      stroke = '#d97706'; // Pulsing gold guides
      shadowColor = 'rgba(217, 119, 6, 0.25)';
    }

    return { fill, stroke, shadowColor, textColor, guestTextColor };
  };

  // 4. Update selected nodes in Transformer when selections change
  useEffect(() => {
    if (readOnly || !transformerRef.current || !stageRef.current) return;

    const selectedIds = selectedTableIds;
    const nodes = selectedIds
      .map((id) => stageRef.current.findOne(`#group-${id}`))
      .filter(Boolean);

    setSelectedNodes(nodes);
    transformerRef.current.nodes(nodes);
    transformerRef.current.getLayer().batchDraw();
  }, [selectedTableIds, tables, readOnly]);

  // 5. Handle clicks on Canvas Background
  const handleStageClick = (e: any) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      setSelectedTableIds([]);
      setSelectedNodes([]);
    }
  };

  // 6. Handle click on a Table Group
  const handleTableClick = (e: any, table: Table) => {
    e.cancelBubble = true;

    // A. Assign mode logic
    if (isAssigningMode && activeReservationId) {
      const targetId = table.parentId || table.id;
      assignReservationToTable(activeReservationId, targetId);
      return;
    }

    // B. Read-only mode logic
    if (readOnly) return;

    const targetId = table.id;

    // If layout lock is ACTIVE (normal hostess operation mode, isLayoutEditMode is false)
    if (!isLayoutEditMode) {
      setSelectedTableIds([]);
      setActiveTableModal(table);
      return;
    }

    // C. Multi-select / Single-select Logic (Only in layout edit mode)
    const isShiftPressed = e.evt.shiftKey;

    if (table.isJoined && table.parentId) {
      const group = joinedGroups.find((g) => g.id === table.parentId);
      if (group) {
        if (isShiftPressed) {
          const allInGroupSelected = group.tableIds.every((id) =>
            selectedTableIds.includes(id)
          );
          if (allInGroupSelected) {
            setSelectedTableIds(
              selectedTableIds.filter((id) => !group.tableIds.includes(id))
            );
          } else {
            setSelectedTableIds([
              ...Array.from(new Set([...selectedTableIds, ...group.tableIds])),
            ]);
          }
        } else {
          setSelectedTableIds([...group.tableIds]);
        }
      }
    } else {
      if (isShiftPressed) {
        if (selectedTableIds.includes(targetId)) {
          setSelectedTableIds(selectedTableIds.filter((id) => id !== targetId));
        } else {
          setSelectedTableIds([...selectedTableIds, targetId]);
        }
      } else {
        setSelectedTableIds([targetId]);
      }
    }
  };

  // 7. Grid snap drag handlers
  const handleDragEnd = (e: any, tableId: string) => {
    const node = e.target;
    const snapX = Math.round(node.x() / GRID_SIZE) * GRID_SIZE;
    const snapY = Math.round(node.y() / GRID_SIZE) * GRID_SIZE;
    
    node.x(snapX);
    node.y(snapY);

    updateTable(tableId, { x: snapX, y: snapY });
  };

  // 8. Handle Resizing Transform
  const handleTransformEnd = (e: any, tableId: string) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    let newWidth = Math.max(40, Math.round((table.width * scaleX) / GRID_SIZE) * GRID_SIZE);
    let newHeight = Math.max(40, Math.round((table.height * scaleY) / GRID_SIZE) * GRID_SIZE);

    if (table.shape === 'round') {
      const size = Math.max(40, Math.round((table.width * scaleX) / GRID_SIZE) * GRID_SIZE);
      newWidth = size;
      newHeight = size;
    }

    const snapX = Math.round(node.x() / GRID_SIZE) * GRID_SIZE;
    const snapY = Math.round(node.y() / GRID_SIZE) * GRID_SIZE;

    node.x(snapX);
    node.y(snapY);

    updateTable(tableId, {
      x: snapX,
      y: snapY,
      width: newWidth,
      height: newHeight,
    });
  };

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[500px] flex items-start justify-start overflow-auto rounded-xl border border-zinc-200 bg-[#f8fafc] grid-canvas-bg p-4 no-select shadow-sm">
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        scaleX={scale}
        scaleY={scale}
        ref={stageRef}
        onClick={handleStageClick}
        onTouchEnd={handleStageClick}
      >
        <Layer>
          {/* Static Decorative BAR (Oakville Yacht Club theme) */}
          <Group x={30} y={35}>
            <Rect
              width={277}
              height={55}
              fill="#fae8ff"
              stroke="#d946ef"
              strokeWidth={2}
              cornerRadius={6}
              shadowBlur={3}
              shadowColor="rgba(217, 70, 239, 0.1)"
            />
            <Text
              text="BAR"
              width={277}
              y={20}
              fontSize={14}
              fontFamily="Inter, system-ui"
              fill="#a21caf"
              align="center"
              fontStyle="bold"
            />
          </Group>

          {/* Static Decorative DOCKSIDE Ellipse Shoreline */}
          <Group x={170} y={430}>
            <Ellipse
              radiusX={130}
              radiusY={30}
              fill="#dcfce7"
              stroke="#16a34a"
              strokeWidth={2}
              shadowBlur={3}
              shadowColor="rgba(22, 163, 74, 0.1)"
            />
            <Text
              text="DOCKSIDE"
              x={-130}
              y={-7}
              width={260}
              fontSize={14}
              fontFamily="Inter, system-ui"
              fill="#15803d"
              align="center"
              fontStyle="bold"
            />
          </Group>

          {/* A. RENDER TABLES */}
          {tables.map((table) => {
            const isSelected = selectedTableIds.includes(table.id);
            const { fill, stroke, shadowColor, textColor, guestTextColor } =
              getTableColors(table, isSelected);

            const res = getTableReservation(table);
            const isCircle = table.shape === 'round';

            return (
              <Group
                key={table.id}
                id={`group-${table.id}`}
                x={table.x}
                y={table.y}
                draggable={!readOnly && isLayoutEditMode && !table.isJoined}
                onDragEnd={(e) => handleDragEnd(e, table.id)}
                onClick={(e) => handleTableClick(e, table)}
                onTouchStart={(e) => handleTableClick(e, table)}
                onTransformEnd={(e) => handleTransformEnd(e, table.id)}
              >
                {/* 1. Base Table Shape */}
                {isCircle ? (
                  <Circle
                    radius={table.width / 2}
                    x={table.width / 2}
                    y={table.width / 2}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={2.5}
                    shadowBlur={shadowColor !== 'transparent' ? 10 : 0}
                    shadowColor={shadowColor}
                  />
                ) : (
                  <Rect
                    width={table.width}
                    height={table.height}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={2.5}
                    cornerRadius={8}
                    shadowBlur={shadowColor !== 'transparent' ? 10 : 0}
                    shadowColor={shadowColor}
                  />
                )}

                {/* 2. Text Labels inside shape */}
                <Group
                  x={0}
                  y={isCircle 
                    ? table.width / 2 - (res ? (res.status === 'Seated' ? 32 : 26) : 18) 
                    : table.height / 2 - (res ? (res.status === 'Seated' ? 32 : 26) : 18)
                  }
                  width={table.width}
                >
                  {/* Table ID label (Thick dark text for sunlight readability) */}
                  <Text
                    text={table.name}
                    width={table.width}
                    fontSize={isCircle ? 15 : 16}
                    fontFamily="Inter, system-ui"
                    fill={res?.status === 'Completed' ? '#94a3b8' : '#0f172a'}
                    align="center"
                    fontStyle="bold"
                  />
                  
                  {/* Capacity label */}
                  <Text
                    text={`${table.capacity} Pax`}
                    width={table.width}
                    y={isCircle ? 18 : 20}
                    fontSize={isCircle ? 10 : 11}
                    fontFamily="Inter, system-ui"
                    fill={textColor}
                    align="center"
                    fontStyle="bold"
                  />

                  {/* Guest name display (if assigned) */}
                  {res && (
                    <Text
                      text={res.guestName}
                      width={table.width}
                      y={isCircle ? 32 : 36}
                      fontSize={isCircle ? 11 : 12}
                      fontFamily="Inter, system-ui"
                      fill={res.status === 'Seated' && res.seatedAtTimestamp && Math.floor((Date.now() - res.seatedAtTimestamp) / 60000) >= 105 ? '#991b1b' : '#0f172a'}
                      align="center"
                      fontStyle="bold"
                      ellipsis={true}
                    />
                  )}

                  {/* Real-time countdown timer */}
                  {res && res.status === 'Seated' && res.seatedAtTimestamp && (() => {
                    const elapsed = Math.floor((Date.now() - res.seatedAtTimestamp) / 60000);
                    const isStool = parseInt(table.id, 10) >= 10 && parseInt(table.id, 10) <= 15;
                    const duration = isStool ? 90 : 120;
                    const remaining = Math.max(0, duration - elapsed);
                    const isWarning = elapsed >= 105;

                    let tText = '';
                    if (elapsed >= duration) {
                      tText = `+${elapsed - duration}m`;
                    } else {
                      const hrs = Math.floor(remaining / 60);
                      const mins = remaining % 60;
                      tText = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                    }

                    return (
                      <Text
                        text={tText}
                        width={table.width}
                        y={isCircle ? 44 : 50}
                        fontSize={isCircle ? 9 : 10}
                        fontFamily="Inter, system-ui"
                        fill={isWarning ? '#dc2626' : '#16a34a'}
                        align="center"
                        fontStyle="bold"
                      />
                    );
                  })()}
                </Group>

                {/* Group locked icon overlay */}
                {table.isJoined && !readOnly && (
                  <Text
                    text="🔗"
                    x={table.width - 20}
                    y={5}
                    fontSize={11}
                  />
                )}
              </Group>
            );
          })}

          {/* B. RENDER JOINED GROUP CONNECTION LINES & CENTER LABELS */}
          {joinedGroups.map((group) => {
            const groupTables = tables.filter((t) => group.tableIds.includes(t.id));
            if (groupTables.length < 2) return null;

            // Calculate center points to connect
            const points: number[] = [];
            let totalX = 0;
            let totalY = 0;

            groupTables.forEach((t) => {
              const centerX = t.x + t.width / 2;
              const centerY = t.y + t.height / 2;
              points.push(centerX, centerY);
              totalX += centerX;
              totalY += centerY;
            });

            const midX = totalX / groupTables.length;
            const midY = totalY / groupTables.length;

            const res = reservations.find(
              (r) => r.tableId === group.id && r.date === activeDate
            );

            // Group outline glow if reservation active
            let lineColor = 'rgba(15, 23, 42, 0.35)'; // Strong navy dashed line
            let badgeBg = '#ffffff';
            let badgeBorder = '#cbd5e1';
            let textAccent = '#0f172a';

            if (res) {
              if (res.status === 'Pending') {
                lineColor = 'rgba(217, 119, 6, 0.65)';
                badgeBorder = '#d97706';
                textAccent = '#92400e';
              } else if (res.status === 'Seated') {
                lineColor = 'rgba(21, 128, 61, 0.65)';
                badgeBorder = '#15803d';
                textAccent = '#166534';
              } else if (res.status === 'Completed') {
                lineColor = 'rgba(148, 163, 184, 0.3)';
                badgeBorder = '#cbd5e1';
                textAccent = '#94a3b8';
              }
            }

            return (
              <Group key={group.id}>
                {/* Visual Connection Web */}
                <Line
                  points={points}
                  stroke={lineColor}
                  strokeWidth={3.5}
                  dash={[8, 8]}
                  lineCap="round"
                  tension={0.2}
                />
                
                {/* Bounding group label badge */}
                <Group x={midX - 55} y={midY - 22}>
                  <Rect
                    width={110}
                    height={44}
                    fill={badgeBg}
                    cornerRadius={6}
                    stroke={badgeBorder}
                    strokeWidth={2}
                    shadowBlur={6}
                    shadowColor="rgba(15,23,42,0.06)"
                  />
                  <Text
                    text={group.name}
                    width={110}
                    y={10}
                    fontSize={11}
                    fontFamily="Inter, system-ui"
                    fill={textAccent}
                    align="center"
                    fontStyle="bold"
                  />
                  <Text
                    text={`${group.capacity} Pax`}
                    width={110}
                    y={24}
                    fontSize={10}
                    fontFamily="Inter, system-ui"
                    fill="#475569"
                    align="center"
                    fontStyle="bold"
                  />
                </Group>
              </Group>
            );
          })}

          {/* C. RENDER TRANSFORMER HANDLES */}
          {!readOnly && isLayoutEditMode && (
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 40 || newBox.height < 40) {
                  return oldBox;
                }
                return newBox;
              }}
              enabledAnchors={[
                'top-left',
                'top-right',
                'bottom-left',
                'bottom-right',
              ]}
              rotateEnabled={false}
              keepRatio={false}
              anchorCornerRadius={3}
              anchorSize={8}
              anchorColor="#0f172a"
              anchorStroke="#ffffff"
              borderStroke="#0f172a"
              borderDash={[3, 3]}
            />
          )}
        </Layer>
      </Stage>
      
      {/* Floating Canvas Hint Overlays */}
      {isAssigningMode && (
        <div className="absolute top-4 left-4 right-4 py-2 bg-amber-500/10 border border-amber-500/30 backdrop-blur-md rounded-lg flex items-center justify-center gap-2 text-sm text-amber-800 font-bold animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
          Click any table (or joined group) to assign this cover booking
        </div>
      )}

      {/* Walk-in & Table Operations Modal */}
      {activeTableModal && (() => {
        const modalRes = getTableReservation(activeTableModal);
        const modalGroup = activeTableModal.parentId 
          ? joinedGroups.find((g) => g.id === activeTableModal.parentId) 
          : null;
        
        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-sm w-full overflow-hidden flex flex-col">
              
              {/* Header */}
              <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-md font-black text-slate-900 leading-tight">
                    {modalGroup ? `Group: ${modalGroup.name}` : `Table ${activeTableModal.name}`}
                  </h3>
                  <p className="text-[10px] text-amber-700 uppercase tracking-widest font-mono font-extrabold mt-0.5">
                    Capacity: {modalGroup ? modalGroup.capacity : activeTableModal.capacity} Pax
                  </p>
                </div>
                <button 
                  onClick={() => setActiveTableModal(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5">
                {!modalRes ? (
                  /* WALK-IN QUICK SEAT VIEW */
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-slate-700">
                      <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600 flex items-center justify-center">
                        <Plus className="w-4 h-4 stroke-[3]" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800">Seat Walk-In Guest</h4>
                        <p className="text-[10px] text-slate-400">Select covers to seat instantly. Starts 2h dining timer.</p>
                      </div>
                    </div>

                    {/* Fast Covers Dropdown */}
                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                        Select Covers
                      </label>
                      <select
                        value={walkInCovers}
                        onChange={(e) => setWalkInCovers(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-zinc-300 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 cursor-pointer shadow-sm"
                      >
                        {Array.from({ 
                          length: Math.max(30, modalGroup ? modalGroup.capacity : activeTableModal.capacity) 
                        }, (_, i) => i + 1).map((num) => (
                          <option key={num} value={num}>
                            {num} {num === 1 ? 'Guest (Cover)' : 'Guests (Covers)'}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Manual/Larger Seating Trigger */}
                    <div className="pt-2 flex justify-between gap-2.5">
                      <button
                        onClick={() => {
                          seatWalkIn(modalGroup ? modalGroup.id : activeTableModal.id, walkInCovers);
                          setActiveTableModal(null);
                        }}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-950 text-white text-[11px] font-extrabold py-2.5 px-3 rounded-lg transition active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                        Confirm & Seat Walk-in
                      </button>
                      <button
                        onClick={() => setActiveTableModal(null)}
                        className="px-3 py-2.5 border border-zinc-200 text-slate-500 text-[11px] font-extrabold rounded-lg hover:bg-slate-50 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* TABLE STATUS & ACTIVE TIMER VIEW */
                  <div className="space-y-4">
                    
                    {/* Seated Info */}
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl border flex items-center justify-center ${
                        modalRes.status === 'Pending' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                        modalRes.status === 'Seated' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                        'bg-slate-50 border-zinc-200 text-slate-500'
                      }`}>
                        <User className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] bg-slate-100 border border-zinc-200 rounded px-1 py-0.5 font-extrabold text-slate-500 uppercase tracking-widest font-mono">
                          {modalRes.status}
                        </span>
                        <h4 className="text-sm font-black text-slate-900 mt-1 truncate">{modalRes.guestName}</h4>
                        <p className="text-[10px] text-slate-500 font-bold font-mono mt-0.5">
                          {modalRes.pax} Covers • Seated at {modalRes.time}
                        </p>
                      </div>
                    </div>

                    {/* Timer Countdown Card */}
                    {modalRes.status === 'Seated' && modalRes.seatedAtTimestamp && (() => {
                      const elapsed = Math.floor((Date.now() - modalRes.seatedAtTimestamp) / 60000);
                      const isStool = parseInt(activeTableModal.id, 10) >= 10 && parseInt(activeTableModal.id, 10) <= 15;
                      const duration = isStool ? 90 : 120;
                      const remaining = Math.max(0, duration - elapsed);
                      const isWarning = elapsed >= 105;

                      return (
                        <div className={`p-3.5 rounded-xl border flex items-center justify-between shadow-sm ${
                          isWarning 
                            ? 'bg-rose-50 border-rose-200 text-rose-800 animate-pulse' 
                            : 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
                        }`}>
                          <div className="flex items-center gap-2.5">
                            <Clock className={`w-4 h-4 ${isWarning ? 'text-rose-600' : 'text-emerald-600'}`} />
                            <div>
                              <span className="text-[9px] uppercase font-bold tracking-wider font-mono block opacity-75">
                                {isWarning ? 'Limit Exceeded' : 'Dining Timer'}
                              </span>
                              <span className="text-sm font-black font-mono leading-none mt-0.5 block">
                                {elapsed >= duration ? `Over by ${elapsed - duration}m` : `${Math.floor(remaining / 60)}h ${remaining % 60}m remaining`}
                              </span>
                            </div>
                          </div>
                          {isWarning && (
                            <span className="flex items-center gap-0.5 bg-rose-600 text-white text-[8px] font-black uppercase tracking-wider py-0.5 px-1.5 rounded shadow-sm">
                              <AlertTriangle className="w-2.5 h-2.5" /> Red Warning
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-1">
                      <button
                        onClick={() => {
                          updateReservation(modalRes.id, { status: 'Completed' });
                          canvasConfetti({
                            particleCount: 80,
                            spread: 60,
                            origin: { y: 0.7 },
                            colors: ['#15803d', '#cbd5e1', '#0f172a'],
                          });
                          setActiveTableModal(null);
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 text-white font-extrabold py-2.5 px-3 rounded-lg transition active:scale-98 flex items-center justify-center gap-1 text-[11px]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Complete Booking (Free Table)
                      </button>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            updateReservation(modalRes.id, { tableId: null });
                            setActiveTableModal(null);
                          }}
                          className="flex-1 border border-zinc-200 text-slate-700 hover:bg-slate-50 font-extrabold py-2.5 px-3 rounded-lg text-[10px] transition flex items-center justify-center gap-1"
                        >
                          Unassign
                        </button>

                        <button
                          onClick={() => setActiveTableModal(null)}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 border border-zinc-200 text-slate-600 font-extrabold py-2.5 px-3 rounded-lg text-[10px] transition"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
