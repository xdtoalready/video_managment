import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useStore } from '../../store/useStore';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { viewMode } = useStore();
  
  return (
    <div className="layout">
      <Header />
      <div className="layout-container">
        <Sidebar />
        <main className="layout-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
