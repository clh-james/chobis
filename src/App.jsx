import React, { useState, useEffect } from 'react';
import { supabase, getCurrentUserRole } from './supabaseClient';
import Login from './Login';
import Dashboard from './Dashboard';
import POS from './POS';
import Appointments from './Appointments';
import Clients from './Clients';
import Reports from './Reports';
import TherapistPanel from './TherapistPanel';
import InventoryPanel from './InventoryPanel';
import ReceptionistPanel from './ReceptionistPanel';

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
    const { data: listener } = supabase.auth.onAuthStateChange(() => checkUser());
    return () => listener?.subscription?.unsubscribe();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      const profile = await getCurrentUserRole();
      setRole(profile?.role || 'receptionist');
    } else {
      setUser(null);
      setRole(null);
    }
    setLoading(false);
  };

  const rolePermissions = {
    admin: ['dashboard', 'pos', 'appointments', 'clients', 'reports', 'therapist', 'inventory', 'reception'],
    receptionist: ['reception', 'appointments', 'clients'],
    therapist: ['therapist'],
    inventory_manager: ['inventory', 'reports']
  };

  const allowedViews = rolePermissions[role] || [];

  if (loading) return <div className="flex h-screen items-center justify-center text-pink-600">Loading...</div>;
  if (!user) return <Login onLoginSuccess={checkUser} />;

  return (
    <div className="min-h-screen bg-[#fdf8f6] flex flex-col">
      
      {/* DESKTOP NAVIGATION (Hidden on Mobile) */}
      <nav className="hidden md:block bg-white shadow-sm border-b border-pink-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center cursor-pointer" onClick={() => setCurrentView('dashboard')}>
            <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
          </div>
          <div className="flex space-x-1">
            {allowedViews.map((view) => (
              <button 
                key={view} 
                onClick={() => setCurrentView(view)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  currentView === view 
                    ? 'bg-pink-600 text-white shadow-md' 
                    : 'text-gray-600 hover:bg-pink-50'
                }`}
              >
                {view.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400 uppercase tracking-wider">{role}</span>
            <button 
              onClick={() => supabase.auth.signOut()} 
              className="text-sm text-gray-500 hover:text-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 mb-20 md:mb-0">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'pos' && <POS />}
        {currentView === 'appointments' && <Appointments />}
        {currentView === 'clients' && <Clients />}
        {currentView === 'reports' && <Reports />}
        {currentView === 'therapist' && <TherapistPanel />}
        {currentView === 'inventory' && <InventoryPanel />}
        {currentView === 'reception' && <ReceptionistPanel />}
      </main>

      {/* MOBILE BOTTOM NAVIGATION (Visible only on Mobile/Tablet) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-pink-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50 pb-safe">
        <div className="flex justify-around items-center h-16">
          {allowedViews.slice(0, 5).map((view) => (
            <button 
              key={view} 
              onClick={() => setCurrentView(view)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                currentView === view ? 'text-pink-600' : 'text-gray-400'
              }`}
            >
              <span className="text-xl">
                {view === 'dashboard' && '📊'}
                {view === 'pos' && '🛒'}
                {view === 'appointments' && '📅'}
                {view === 'clients' && ''}
                {view === 'reports' && '📈'}
                {view === 'therapist' && '💆‍♀️'}
                {view === 'inventory' && ''}
                {view === 'reception' && '🏁'}
              </span>
              <span className="text-[10px] font-medium capitalize">{view.replace('_', ' ')}</span>
            </button>
          ))}
        </div>
      </nav>

    </div>
  );
}

export default App;