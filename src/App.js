import React, { Suspense, lazy } from 'react';
import Kiosk from './views/Kiosk';
import './styles/base.css';

const AdminApp = lazy(() => import('./views/admin/AdminApp'));

// Percorsi: /  ·  /opera/:id (QR accanto all'opera)  ·  /admin
export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/admin') {
    return (
      <Suspense fallback={<div className="admin-loading" aria-busy="true" />}>
        <AdminApp />
      </Suspense>
    );
  }
  const m = path.match(/^\/opera\/([A-Za-z0-9_-]+)$/);
  return <Kiosk operaId={m ? m[1] : null} />;
}
