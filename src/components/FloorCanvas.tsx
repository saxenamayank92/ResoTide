'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Circle, Text, Group, Transformer, Line, Ellipse } from 'react-konva';
import { useTableTide } from '../context/TableTideContext';
import { Table, JoinedGroup, Reservation } from '../types';

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
  } = useTableTide();

  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track selected nodes for transformer
  const [selectedNodes, setSelectedNodes] = useState<any[]>([]);

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
        fill = '#f0fdf4'; // Soft emerald background
        stroke = '#15803d'; // Thick Forest Green border
        shadowColor = 'rgba(21, 128, 61, 0.2)';
        textColor = '#166534';
        guestTextColor = '#0f172a';
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

    // C. Multi-select / Single-select Logic
    const isShiftPressed = e.evt.shiftKey;
    const targetId = table.id;

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
                draggable={!readOnly && !table.isJoined}
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
                  y={isCircle ? table.width / 2 - (res ? 26 : 18) : table.height / 2 - (res ? 26 : 18)}
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
                      fill="#0f172a"
                      align="center"
                      fontStyle="bold"
                      ellipsis={true}
                    />
                  )}
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
          {!readOnly && (
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
    </div>
  );
}
