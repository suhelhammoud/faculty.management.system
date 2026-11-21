export type Building = {
  buildingId: string;
  buildingCode: string;
  title: string;
  address: string | null;
  status: string;
};

export type Floor = {
  floorId: string;
  buildingId: string;
  floorNumber: number;
  title: string | null;
};

export type RoomType = {
  roomTypeId: string;
  name: string;
  description: string | null;
};

export type Room = {
  roomId: string;
  buildingId: string;
  floorId: string;
  roomTypeId: string;
  roomCode: string;
  title: string;
  maximumStudentCapacity: number | null;
  currentAvailableStudentCapacity: number | null;
  status: string;
};

export type FacilitiesData = {
  buildings: Building[];
  floors: Floor[];
  roomTypes: RoomType[];
  rooms: Room[];
};

export type FacilityKind = 'buildings' | 'floors' | 'room-types' | 'rooms';

export type Session = {
  user: {
    id: string;
    name: string;
    username?: string;
    approved: boolean;
    enabled: boolean;
    mustChangePassword: boolean;
  };
} | null;
