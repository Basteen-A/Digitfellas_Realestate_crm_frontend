import React from 'react';

const TelecallerCallLog = ({ user }) => {
  const callLogs = [
    { time: '11:45 AM', name: 'Recent Call 1', duration: '3m 20s', outcome: 'Warm', notes: 'Interested in EMI options' },
    { time: '11:20 AM', name: 'Recent Call 2', duration: '0m 0s', outcome: 'Not Reachable', notes: 'Phone off. Retry needed.' },
    { time: '10:50 AM', name: 'Recent Call 3', duration: '5m 10s', outcome: 'Interested', notes: 'Wants virtual tour' },
  ];

  const badgeClass = (outcome) => {
    const map = { 'warm': 'badge-warm', 'hot': 'badge-hot', 'cold': 'badge-cold', 'not reachable': 'badge-nr', 'interested': 'badge-interested' };
    return map[outcome.toLowerCase()] || 'badge-open';
  };

  return (
    <div>
      <div className="page-header flex-col md:flex-row md:items-center gap-3">
        <div className="page-header-left">
          <h1>Call Log</h1>
          <p className="hidden sm:block">Track all your calls and outcomes</p>
        </div>
      </div>
      <div className="crm-card">
        <div className="crm-card-body-flush">
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Lead</th>
                  <th>Duration</th>
                  <th>Outcome</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {callLogs.map((log, idx) => (
                  <tr key={idx}>
                    <td>{log.time}</td>
                    <td><strong>{log.name}</strong></td>
                    <td>{log.duration}</td>
                    <td><span className={`crm-badge ${badgeClass(log.outcome)}`}>{log.outcome}</span></td>
                    <td>{log.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelecallerCallLog;
