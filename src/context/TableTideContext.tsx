'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Table, TableShape, JoinedGroup, Reservation, ReservationStatus } from '../types';
import canvasConfetti from 'canvas-confetti';

interface TableTideContextType {
  tables: Table[];
  joinedGroups: JoinedGroup[];
  reservations: Reservation[];
  selectedTableIds: string[];
  activeReservationId: string | null;
  isAssigningMode: boolean;
  activeDate: string;
  isMounted: boolean;
  
  // Table operations
  addTable: (shape: TableShape) => void;
  updateTable: (id: string, updates: Partial<Table>) => void;
  deleteTable: (id: string) => void;
  setSelectedTableIds: (ids: string[]) => void;
  
  // Join / Split operations
  joinSelectedTables: () => void;
  splitJoinedGroup: (groupId: string) => void;
  
  // Reservation operations
  addReservation: (reservation: Omit<Reservation, 'id' | 'date'>) => void;
  updateReservation: (id: string, updates: Partial<Reservation>) => void;
  deleteReservation: (id: string) => void;
  setActiveReservationId: (id: string | null) => void;
  assignReservationToTable: (reservationId: string, tableOrGroupId: string | null) => void;
  autoAssignAll: () => void;
  
  // Daily operations
  clearDay: () => void;
  changeDate: (dateStr: string) => void;
}

const TableTideContext = createContext<TableTideContextType | undefined>(undefined);

// Helper to get formatted YYYY-MM-DD date in local timezone
const getLocalDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to convert HH:MM string to absolute minutes from midnight
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

// Helper to check if two time-slots overlap based on dining durations
// Bar stools get a fast 90-minute turn, while standard tables/couches get a full 120-minute (2h) turn.
const isTimeOverlapping = (
  time1: string,
  time2: string,
  isStool: boolean
): boolean => {
  const t1 = timeToMinutes(time1);
  const t2 = timeToMinutes(time2);
  const duration = isStool ? 90 : 120;
  
  const start1 = t1;
  const end1 = t1 + duration;
  const start2 = t2;
  const end2 = t2 + duration;
  
  return start1 < end2 && start2 < end1;
};

// Physical waterfront layout matching the user drawing perfectly (Stools 10-15 + 13 tables)
const DEFAULT_TABLES: Table[] = [
  // Stools under the BAR (capacity: 1 each)
  { id: '10', name: '10', capacity: 1, shape: 'round', x: 40, y: 120, width: 42, height: 42, isJoined: false, parentId: null },
  { id: '11', name: '11', capacity: 1, shape: 'round', x: 85, y: 120, width: 42, height: 42, isJoined: false, parentId: null },
  { id: '12', name: '12', capacity: 1, shape: 'round', x: 130, y: 120, width: 42, height: 42, isJoined: false, parentId: null },
  { id: '13', name: '13', capacity: 1, shape: 'round', x: 175, y: 120, width: 42, height: 42, isJoined: false, parentId: null },
  { id: '14', name: '14', capacity: 1, shape: 'round', x: 220, y: 120, width: 42, height: 42, isJoined: false, parentId: null },
  { id: '15', name: '15', capacity: 1, shape: 'round', x: 265, y: 120, width: 42, height: 42, isJoined: false, parentId: null },
  
  // Tables: High tops, couches, and regular configurations
  { id: '18', name: '18', capacity: 4, shape: 'rectangle', x: 330, y: 245, width: 75, height: 75, isJoined: false, parentId: null },
  { id: '19', name: '19', capacity: 4, shape: 'rectangle', x: 335, y: 140, width: 75, height: 75, isJoined: false, parentId: null },
  { id: '20', name: '20', capacity: 10, shape: 'rectangle', x: 425, y: 170, width: 110, height: 110, isJoined: false, parentId: null }, // Couch 20
  { id: '21', name: '21', capacity: 4, shape: 'rectangle', x: 555, y: 215, width: 75, height: 75, isJoined: false, parentId: null },
  { id: '22', name: '22', capacity: 2, shape: 'rectangle', x: 620, y: 130, width: 60, height: 60, isJoined: false, parentId: null }, // Two seater 22
  { id: '23', name: '23', capacity: 4, shape: 'rectangle', x: 650, y: 215, width: 75, height: 75, isJoined: false, parentId: null },
  { id: '24', name: '24', capacity: 6, shape: 'rectangle', x: 745, y: 140, width: 75, height: 140, isJoined: false, parentId: null }, // Blue rectangle 24
  { id: '25', name: '25', capacity: 2, shape: 'rectangle', x: 840, y: 195, width: 60, height: 60, isJoined: false, parentId: null }, // Two seater 25
  { id: '26', name: '26', capacity: 4, shape: 'rectangle', x: 915, y: 195, width: 75, height: 75, isJoined: false, parentId: null },
  { id: '27', name: '27', capacity: 2, shape: 'rectangle', x: 975, y: 120, width: 60, height: 60, isJoined: false, parentId: null }, // Two seater 27
  { id: '28', name: '28', capacity: 4, shape: 'rectangle', x: 1050, y: 195, width: 75, height: 75, isJoined: false, parentId: null },
  { id: '29', name: '29', capacity: 6, shape: 'rectangle', x: 1145, y: 120, width: 75, height: 160, isJoined: false, parentId: null }, // Blue rectangle 29
  { id: '30', name: '30', capacity: 10, shape: 'rectangle', x: 1240, y: 140, width: 110, height: 110, isJoined: false, parentId: null }, // Couch 30
];

export const TableTideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [joinedGroups, setJoinedGroups] = useState<JoinedGroup[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [activeReservationId, setActiveReservationId] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<string>('');
  const [isMounted, setIsMounted] = useState<boolean>(false);

  const isAssigningMode = activeReservationId !== null;

  // 1. Initial Load & Setup
  useEffect(() => {
    setActiveDate(getLocalDateString());
    
    // Load from local storage
    const storedTables = localStorage.getItem('tableTide_tables');
    const storedGroups = localStorage.getItem('tableTide_joinedGroups');
    const storedReservations = localStorage.getItem('tableTide_reservations');

    // Force default physical layout reset if stored state structure is out-of-date
    if (storedTables && JSON.parse(storedTables).length === DEFAULT_TABLES.length) {
      setTables(JSON.parse(storedTables));
    } else {
      setTables(DEFAULT_TABLES);
      localStorage.setItem('tableTide_tables', JSON.stringify(DEFAULT_TABLES));
      localStorage.setItem('tableTide_joinedGroups', JSON.stringify([]));
    }

    if (storedGroups) {
      setJoinedGroups(JSON.parse(storedGroups));
    }

    if (storedReservations) {
      setReservations(JSON.parse(storedReservations));
    }

    setIsMounted(true);
  }, []);

  // 2. 3AM Rollover Background Checker
  useEffect(() => {
    if (!isMounted) return;

    const runAutoClearCheck = () => {
      const now = new Date();
      // Calculate the most recent 3am boundary (today or yesterday)
      const boundary = new Date(now);
      boundary.setHours(3, 0, 0, 0);
      if (now.getTime() < boundary.getTime()) {
        boundary.setDate(boundary.getDate() - 1);
      }

      const lastClearStr = localStorage.getItem('tableTide_lastClearTimestamp');
      const lastClear = lastClearStr ? parseInt(lastClearStr, 10) : 0;

      if (lastClear < boundary.getTime()) {
        // Clear all reservations
        setReservations([]);
        localStorage.setItem('tableTide_reservations', JSON.stringify([]));
        localStorage.setItem('tableTide_lastClearTimestamp', now.getTime().toString());
        console.log('[TableTide] Auto-cleared reservations at 3am boundary.');
      }
    };

    // Run check on mount (after isMounted is true)
    runAutoClearCheck();

    // Check every 30 seconds
    const interval = setInterval(runAutoClearCheck, 30000);
    return () => clearInterval(interval);
  }, [isMounted]);

  // 3. Write updates to LocalStorage when states change
  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem('tableTide_tables', JSON.stringify(tables));
  }, [tables, isMounted]);

  // Sync groups separately
  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem('tableTide_joinedGroups', JSON.stringify(joinedGroups));
  }, [joinedGroups, isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem('tableTide_reservations', JSON.stringify(reservations));
  }, [reservations, isMounted]);

  // --- Table Operations ---
  const addTable = useCallback((shape: TableShape) => {
    const id = `table_${Date.now()}`;
    const name = `T${tables.length + 1}`;
    const newTable: Table = {
      id,
      name,
      capacity: shape === 'rectangle' ? 4 : 2,
      shape,
      x: 150,
      y: 150,
      width: shape === 'rectangle' ? 120 : 80,
      height: shape === 'rectangle' ? 80 : 80,
      isJoined: false,
      parentId: null,
    };
    setTables((prev) => [...prev, newTable]);
  }, [tables]);

  const updateTable = useCallback((id: string, updates: Partial<Table>) => {
    setTables((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  const deleteTable = useCallback((id: string) => {
    setTables((prev) => prev.filter((t) => t.id !== id));
    const tableObj = tables.find((t) => t.id === id);
    if (tableObj?.parentId) {
      splitJoinedGroup(tableObj.parentId);
    }
    setReservations((prev) =>
      prev.map((r) => (r.tableId === id ? { ...r, tableId: null } : r))
    );
    setSelectedTableIds((prev) => prev.filter((selId) => selId !== id));
  }, [tables]);

  // --- Join / Split Operations ---
  const joinSelectedTables = useCallback(() => {
    const validTables = tables.filter(
      (t) => selectedTableIds.includes(t.id) && !t.isJoined
    );

    if (validTables.length < 2) return;

    const id = `group_${Date.now()}`;
    const name = validTables.map((t) => t.name).join(' + ');
    const capacity = validTables.reduce((sum, t) => sum + t.capacity, 0);

    const newGroup: JoinedGroup = {
      id,
      name,
      tableIds: validTables.map((t) => t.id),
      capacity,
    };

    setJoinedGroups((prev) => [...prev, newGroup]);
    
    setTables((prev) =>
      prev.map((t) =>
        selectedTableIds.includes(t.id) ? { ...t, isJoined: true, parentId: id } : t
      )
    );

    setSelectedTableIds([]);
  }, [selectedTableIds, tables]);

  const splitJoinedGroup = useCallback((groupId: string) => {
    const group = joinedGroups.find((g) => g.id === groupId);
    if (!group) return;

    setTables((prev) =>
      prev.map((t) =>
        group.tableIds.includes(t.id) ? { ...t, isJoined: false, parentId: null } : t
      )
    );

    setJoinedGroups((prev) => prev.filter((g) => g.id !== groupId));

    setReservations((prev) =>
      prev.map((r) => (r.tableId === groupId ? { ...r, tableId: null } : r))
    );
  }, [joinedGroups]);

  // --- Reservation Operations ---
  const addReservation = useCallback((resData: Omit<Reservation, 'id' | 'date'>) => {
    const id = `res_${Date.now()}`;
    const newRes: Reservation = {
      ...resData,
      id,
      date: activeDate,
    };
    setReservations((prev) => [...prev, newRes]);
  }, [activeDate]);

  const updateReservation = useCallback((id: string, updates: Partial<Reservation>) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  }, []);

  const deleteReservation = useCallback((id: string) => {
    setReservations((prev) => prev.filter((r) => r.id !== id));
    if (activeReservationId === id) {
      setActiveReservationId(null);
    }
  }, [activeReservationId]);

  const assignReservationToTable = useCallback((reservationId: string, tableOrGroupId: string | null) => {
    setReservations((prev) =>
      prev.map((r) => {
        if (r.id === reservationId) {
          return { ...r, tableId: tableOrGroupId };
        }
        if (tableOrGroupId && r.tableId === tableOrGroupId && r.date === activeDate) {
          return { ...r, tableId: null };
        }
        return r;
      })
    );
    setActiveReservationId(null);
  }, [activeDate]);

  // Smart Optimization Seating Solver (AI Solver with turnover time conflict checking)
  const autoAssignAll = useCallback(() => {
    // 1. Get all unassigned bookings for the active day
    const unassigned = reservations.filter(
      (r) => r.date === activeDate && r.tableId === null
    );

    if (unassigned.length === 0) return;

    // 2. Sort reservations by pax count DESCENDING (seat largest groups first!)
    const sortedRes = [...unassigned].sort((a, b) => b.pax - a.pax);

    // 3. Keep track of already assigned reservations for today to check conflicts
    const assignedReservations = reservations.filter(
      (r) => r.date === activeDate && r.tableId !== null
    );

    interface SeatingUnit {
      id: string;
      name: string;
      capacity: number;
      isStool: boolean;
      tableIds: string[]; // Store underlying table IDs for group conflict checks
    }

    // Prepare list of all units
    const units: SeatingUnit[] = [
      ...tables
        .filter((t) => !t.isJoined)
        .map((t) => ({ 
          id: t.id, 
          name: t.name, 
          capacity: t.capacity, 
          isStool: parseInt(t.id, 10) >= 10 && parseInt(t.id, 10) <= 15, // Stools 10-15
          tableIds: [t.id] 
        })),
      ...joinedGroups.map((g) => ({ 
        id: g.id, 
        name: g.name, 
        capacity: g.capacity, 
        isStool: false, 
        tableIds: g.tableIds 
      }))
    ];

    // Track dynamic assignments made in this run
    const activeAssignments = [...assignedReservations];
    const newAssignments: { [resId: string]: string } = {};

    sortedRes.forEach((res) => {
      // Find eligible units where:
      // - Unit capacity >= res.pax
      // - No overlapping reservation is already assigned to this unit for today
      const eligible = units
        .filter((u) => {
          // Capacity constraint
          if (u.capacity < res.pax) return false;

          // Overlap conflict constraint:
          // Check if any reservation already assigned to this unit (or tables inside it) overlaps in time
          const hasConflict = activeAssignments.some((existing) => {
            // Check if they share the same physical table(s)
            let sharesTable = false;
            
            const existingUnit = units.find(unit => unit.id === existing.tableId);
            if (existingUnit) {
              sharesTable = u.tableIds.some(id => existingUnit.tableIds.includes(id));
            } else {
              sharesTable = u.tableIds.includes(existing.tableId as string);
            }

            if (!sharesTable) return false;

            // Check if times overlap
            return isTimeOverlapping(existing.time, res.time, u.isStool);
          });

          return !hasConflict;
        })
        .sort((a, b) => {
          // Minimize wasted capacity
          const wasteA = a.capacity - res.pax;
          const wasteB = b.capacity - res.pax;
          if (wasteA !== wasteB) {
            return wasteA - wasteB;
          }
          return a.capacity - b.capacity;
        });

      if (eligible.length > 0) {
        const bestUnit = eligible[0];
        newAssignments[res.id] = bestUnit.id;
        
        // Add to activeAssignments list to prevent double-booking subsequent runs in the loop
        activeAssignments.push({
          ...res,
          tableId: bestUnit.id
        });
      }
    });

    // Apply assignments to state
    setReservations((prev) =>
      prev.map((r) => {
        if (newAssignments[r.id]) {
          return { ...r, tableId: newAssignments[r.id] };
        }
        return r;
      })
    );

    // Blast celebration confetti!
    if (Object.keys(newAssignments).length > 0) {
      canvasConfetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.65 },
        colors: ['#d97706', '#15803d', '#1d4ed8'],
      });
    }
  }, [reservations, tables, joinedGroups, activeDate]);

  // --- Daily Operations ---
  const clearDay = useCallback(() => {
    setReservations((prev) => prev.filter((r) => r.date !== activeDate));
    setActiveReservationId(null);
  }, [activeDate]);

  const changeDate = useCallback((dateStr: string) => {
    setActiveDate(dateStr);
    setActiveReservationId(null);
  }, []);

  return (
    <TableTideContext.Provider
      value={{
        tables,
        joinedGroups,
        reservations,
        selectedTableIds,
        activeReservationId,
        isAssigningMode,
        activeDate,
        isMounted,
        addTable,
        updateTable,
        deleteTable,
        setSelectedTableIds,
        joinSelectedTables,
        splitJoinedGroup,
        addReservation,
        updateReservation,
        deleteReservation,
        setActiveReservationId,
        assignReservationToTable,
        autoAssignAll,
        clearDay,
        changeDate,
      }}
    >
      {children}
    </TableTideContext.Provider>
  );
};

export const useTableTide = () => {
  const context = useContext(TableTideContext);
  if (!context) {
    throw new Error('useTableTide must be used within a TableTideProvider');
  }
  return context;
};
