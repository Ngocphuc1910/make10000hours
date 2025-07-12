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
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}; 