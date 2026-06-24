jest.mock('../../../api/bookingApi', () => ({
  __esModule: true,
  default: {
    getMyBookings: jest.fn(),
    getCancelReasons: jest.fn(),
    getPaymentFormMasters: jest.fn(),
  },
}));

jest.mock('../../../api/bookingStatusApi', () => ({
  __esModule: true,
  default: { getDropdown: jest.fn() },
}));

jest.mock('../../../api/paymentStatusApi', () => ({
  __esModule: true,
  default: { getDropdown: jest.fn() },
}));

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CollectionExecBookings from './CollectionExecBookings';
import bookingApi from '../../../api/bookingApi';
import bookingStatusApi from '../../../api/bookingStatusApi';
import paymentStatusApi from '../../../api/paymentStatusApi';

const sampleBooking = {
  id: 'b1',
  booking_number: 'BK-10001',
  customer_name: 'Test Buyer',
  buyer_name: 'Test Buyer',
  project_name: 'Green Acres',
  phase_name: 'Phase 1',
  unit_display: 'Phase 1 · A-101',
  unit_number: 'A-101',
  status_label: 'Booked',
  status_color: '#3B82F6',
  payment_status: 'Follow Up',
  next_follow_up_at: '2026-07-01',
};

beforeEach(() => {
  bookingStatusApi.getDropdown.mockImplementation(() => Promise.resolve({ data: { data: [] } }));
  paymentStatusApi.getDropdown.mockImplementation(() => Promise.resolve({ data: { data: [] } }));
  bookingApi.getCancelReasons.mockImplementation(() => Promise.resolve({ data: { data: [] } }));
  bookingApi.getPaymentFormMasters.mockImplementation(() => Promise.resolve({ data: { data: {} } }));
});

test('renders without crashing and shows the assigned booking', async () => {
  bookingApi.getMyBookings.mockResolvedValue({ data: { data: [sampleBooking], pagination: { total: 1 } } });
  render(<CollectionExecBookings onSelectBooking={() => {}} />);
  expect(screen.getByText('My Collections')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('BK-10001')).toBeInTheDocument());
  expect(screen.getByText('Test Buyer')).toBeInTheDocument();
});

test('renders the empty state when there are no assigned bookings', async () => {
  bookingApi.getMyBookings.mockResolvedValue({ data: { data: [], pagination: { total: 0 } } });
  render(<CollectionExecBookings onSelectBooking={() => {}} />);
  await waitFor(() => expect(screen.getByText('No bookings assigned to you yet')).toBeInTheDocument());
});
