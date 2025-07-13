import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../../layout/Sidebar';
import { Header } from './Header';

export const DashboardLayout: React.FC = () => {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      
      <main className="dashboard-main">
        <Header />
        
        <div className="dashboard-content scrollbar-thin">
          <div className="max-w-none mx-auto px-6">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}; 