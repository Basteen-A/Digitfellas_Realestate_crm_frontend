// Collection Manager portal › Collection Report.
//
// The report itself is the shared Super Admin page (superadmin/CollectionReports) —
// same four reports, same filter bar, same Excel export. `orgWide={false}` drops the
// Collection Manager filter; the server pins the data to the bookings this user
// actually handles, so the portal and the org-wide view can never drift apart.
import React from 'react';
import CollectionReportsPage from '../../superadmin/CollectionReports';

const CollectionReports = () => <CollectionReportsPage orgWide={false} />;

export default CollectionReports;
