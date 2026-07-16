import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { PhoneArrowUpRightIcon } from '@heroicons/react/24/outline';
import telephonyApi from '../../api/telephonyApi';
import { getErrorMessage } from '../../utils/helpers';

// Outbound Click-to-Call button. Asks Smartflo to ring the logged-in agent's
// phone first, then bridge the customer — so the agent talks on their own
// handset and the call is logged + recorded via the outbound webhook.
export default function SmartfloCallButton({ leadId, destinationNumber, className = 'qa-header-icon-btn', iconOnly = true, size = 18 }) {
  const [busy, setBusy] = useState(false);

  const call = async (e) => {
    e?.stopPropagation?.();
    if (busy) return;
    setBusy(true);
    try {
      const payload = leadId ? { lead_id: leadId } : { destination_number: destinationNumber };
      const res = await telephonyApi.clickToCall(payload);
      toast.success(res?.data?.message || res?.message || 'Call initiated — your phone will ring shortly.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not start the call. Check Telephony → Call Settings.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={className}
      title="Call via Smartflo — rings your phone, then the customer"
      onClick={call}
      disabled={busy}
    >
      <PhoneArrowUpRightIcon style={{ width: size, height: size }} />
      {!iconOnly && <span style={{ marginLeft: 6 }}>{busy ? 'Calling…' : 'Call'}</span>}
    </button>
  );
}
