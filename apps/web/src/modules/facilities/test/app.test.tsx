import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import App from '../App';
import type { FacilitiesData } from '../lib/types';

const { mockAuthApi, mockFacilityApi } = vi.hoisted(() => ({
  mockAuthApi: vi.fn(),
  mockFacilityApi: vi.fn(),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, authApi: mockAuthApi, facilityApi: mockFacilityApi };
});

const fixture: FacilitiesData = {
  buildings: [
    {
      buildingId: '11111111-1111-4111-8111-111111111111',
      buildingCode: 'FACULTY_MAIN',
      title: 'Faculty Main Building',
      address: null,
      status: 'active',
    },
  ],
  floors: [
    {
      floorId: '22222222-2222-4222-8222-222222222222',
      buildingId: '11111111-1111-4111-8111-111111111111',
      floorNumber: 1,
      title: 'Floor 1',
    },
  ],
  roomTypes: [
    { roomTypeId: '33333333-3333-4333-8333-333333333333', name: 'classroom', description: null },
    { roomTypeId: '44444444-4444-4444-8444-444444444444', name: 'laboratory', description: null },
  ],
  rooms: [
    {
      roomId: '55555555-5555-4555-8555-555555555555',
      buildingId: '11111111-1111-4111-8111-111111111111',
      floorId: '22222222-2222-4222-8222-222222222222',
      roomTypeId: '33333333-3333-4333-8333-333333333333',
      roomCode: 'classroom_7',
      title: 'Classroom 7',
      maximumStudentCapacity: 30,
      currentAvailableStudentCapacity: 28,
      status: 'active',
    },
    {
      roomId: '66666666-6666-4666-8666-666666666666',
      buildingId: '11111111-1111-4111-8111-111111111111',
      floorId: '22222222-2222-4222-8222-222222222222',
      roomTypeId: '44444444-4444-4444-8444-444444444444',
      roomCode: 'lab_01',
      title: 'Lab 01',
      maximumStudentCapacity: null,
      currentAvailableStudentCapacity: null,
      status: 'active',
    },
  ],
};

function renderFacilities() {
  return render(
    <MemoryRouter initialEntries={['/facilities/rooms']}>
      <Routes>
        <Route path="/facilities/*" element={<App />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Facilities rooms screen', () => {
  beforeEach(() => {
    localStorage.clear();
    mockAuthApi.mockImplementation((path: string) =>
      Promise.resolve(
        path === 'auth/get-session'
          ? {
              user: {
                id: 'facility-user',
                name: 'Facilities User',
                username: 'facility_user',
                approved: true,
                enabled: true,
                mustChangePassword: false,
              },
            }
          : null,
      ),
    );
    mockFacilityApi.mockImplementation((path = '') => Promise.resolve(path === '' ? fixture : {}));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the room list and filters by room type', async () => {
    const user = userEvent.setup();
    renderFacilities();

    expect(await screen.findByText('classroom_7')).toBeInTheDocument();
    expect(screen.getByText('lab_01')).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Room type' }),
      '33333333-3333-4333-8333-333333333333',
    );

    expect(screen.getByText('classroom_7')).toBeInTheDocument();
    expect(screen.queryByText('lab_01')).not.toBeInTheDocument();
  });

  it('creates a room through the API and refreshes the list', async () => {
    const user = userEvent.setup();
    renderFacilities();
    await user.click(await screen.findByRole('button', { name: /Add room/i }));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Room code'), 'theater_1');
    await user.type(within(dialog).getByLabelText('Title'), 'Theater 1');
    await user.click(within(dialog).getByRole('button', { name: 'Save room' }));

    expect(mockFacilityApi).toHaveBeenCalledWith(
      'rooms',
      'POST',
      expect.objectContaining({
        roomCode: 'theater_1',
        title: 'Theater 1',
        buildingId: fixture.buildings[0].buildingId,
        floorId: fixture.floors[0].floorId,
      }),
    );
    expect(await screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
