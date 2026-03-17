import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CalendarClock, Server, LogOut} from 'lucide-react';
import '../style/Portal.css';

export default function Portal() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('loggedInUser');
    
    if (savedUser) {
      const formattedName = savedUser.charAt(0).toUpperCase() + savedUser.slice(1);
      setCurrentUser(formattedName);
    } else {
      setCurrentUser('Guest');
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('loggedInUser');
    navigate('/login');
  };

  const handleAppClick = (path) => {
    navigate(path);
  };

  return (
    <div className="portal-container">
      <header className="portal-header">
        <div className="portal-logo">
          <span>nama perusahaan</span>
        </div>
        <div className="portal-user">
          <button onClick={handleLogout} className="btn-logout">
            <LogOut size={20} strokeWidth={2.5} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <main className="portal-main">
        <section className="welcome-section">
          <div className="welcome-text">
            <h1>Welcome, {currentUser}!</h1>
            <p>Select a service to get started.</p>
          </div>
        </section>
        
        <section className="app-group">
          <h2>I. App & Suite</h2>
          <div className="card-grid">
            
            <div className="app-card" onClick={() => handleAppClick('/area-usage')}>
              <div className="card-icon blue-icon">
                <Activity color="white" size={24} strokeWidth={2.5} />
              </div>
              <div className="card-content">
                <h3>ECOWatch</h3>
              </div>
            </div>

            <div className="app-card" onClick={() => handleAppClick('/tou-period')}>
              <div className="card-icon blue-icon">
                <CalendarClock color="white" size={24} strokeWidth={2.5} />
              </div>
              <div className="card-content">
                <h3>Time Schedule</h3>
              </div>
            </div>
            
          </div>
        </section> 

        <section className="app-group">
          <h2>II. Platform & Tools</h2>
          <div className="card-grid">
            
            <div className="app-card" onClick={() => handleAppClick('/item-summary')}>
              <div className="card-icon transparent-icon">
                <Server color="#113a6c" size={28} strokeWidth={2.5} />
              </div>
              <div className="card-content">
                <h3>InsightAPM</h3>
              </div>
            </div>

          </div>
        </section>

      </main>
    </div>
  );
}