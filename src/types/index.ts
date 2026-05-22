export type TableShape = 'rectangle' | 'round';

export interface Table {
  id: string;
  name: string;
  capacity: number;
  shape: TableShape;
  x: number;
  y: number;
  width: number;
  height: number;
  isJoined: boolean;
  parentId: string | null; // ID of the JoinedGroup if joined
}

export interface JoinedGroup {
  id: string;
  name: string;
  tableIds: string[];
  capacity: number;
}

export type ReservationStatus = 'Pending' | 'Seated' | 'Completed' | 'Cancelled' | 'Delayed';

export interface Reservation {
  id: string;
  guestName: string;
  pax: number;
  time: string; // e.g. "19:30"
  tableId: string | null; // Can point to a Table.id or a JoinedGroup.id
  status: ReservationStatus;
  notes: string;
  date: string; // YYYY-MM-DD
  seatedAtTimestamp?: number; // millisecond timestamp when reservation was seated
  delayedAtTimestamp?: number; // millisecond timestamp when reservation was marked as delayed
}
