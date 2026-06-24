jest.mock('../../../api/bookingApi', () => ({
  __esModule: true,
  default: {
    getById: jest.fn(),
    getDocuments: jest.fn(),
    getActivities: jest.fn(),
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
import CollectionExecBookingDetail from './CollectionExecBookingDetail';
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
  payments: [],
};

beforeEach(() => {
  bookingStatusApi.getDropdown.mockImplementation(() => Promise.resolve({ data: { data: [] } }));
  paymentStatusApi.getDropdown.mockImplementation(() => Promise.resolve({ data: { data: [] } }));
  bookingApi.getDocuments.mockImplementation(() => Promise.resolve({ data: { data: [] } }));
  bookingApi.getActivities.mockImplementation(() => Promise.resolve({ data: { data: [] } }));
  bookingApi.getCancelReasons.mockImplementation(() => Promise.resolve({ data: { data: [] } }));
  bookingApi.getPaymentFormMasters.mockImplementation(() => Promise.resolve({ data: { data: {} } }));
});

test('renders without crashing and shows booking details', async () => {
  bookingApi.getById.mockResolvedValue({ data: { data: sampleBooking } });
  render(<CollectionExecBookingDetail bookingId="b1" onBack={() => {}} />);
  
  await waitFor(() => expect(screen.getByText('Booking BK-10001')).toBeInTheDocument());
  expect(screen.getByText('Test Buyer')).toBeInTheDocument();
  expect(screen.getByText('Green Acres')).toBeInTheDocument();
});
