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
import AuditLog from './AuditLog';
import { logAudit, ACTIONS, CATEGORIES } from './utils/auditLogger';

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Dark Mode State with localStorage persistence
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chobis-dark-mode') === 'true';
    }
    return false;
  });

  useEffect(() => {
    checkUser();
    const { data: listener } = supabase.auth.onAuthStateChange(() => checkUser());
    return () => listener?.subscription?.unsubscribe();
  }, []);

  // Apply dark mode class to HTML element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('chobis-dark-mode', darkMode.toString());
  }, [darkMode]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      const profile = await getCurrentUserRole();
      setRole(profile?.role || 'receptionist');
      
      // Log login only once per session
      if (!localStorage.getItem('chobis-last-login')) {
        await logAudit({
          action: ACTIONS.AUTH.LOGIN,
          category: CATEGORIES.AUTH,
          entityType: 'user',
          entityId: user.id,
          details: { email: user.email, role: profile?.role }
        });
        localStorage.setItem('chobis-last-login', Date.now().toString());
      }
    } else {
      setUser(null);
      setRole(null);
      localStorage.removeItem('chobis-last-login');
    }
    setLoading(false);
  };

  // ✅ FIXED: Fetch user directly instead of relying on outer scope
  const handleLogout = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await logAudit({
        action: ACTIONS.AUTH.LOGOUT,
        category: CATEGORIES.AUTH,
        entityType: 'user',
        entityId: user.id
      });
    }
    await supabase.auth.signOut();
  };

  const rolePermissions = {
    admin: ['dashboard', 'pos', 'appointments', 'clients', 'reports', 'therapist', 'inventory', 'reception', 'audit_log'],
    manager: ['dashboard', 'appointments', 'clients', 'reports', 'audit_log'],
    receptionist: ['reception', 'appointments', 'clients'],
    therapist: ['therapist'],
    inventory_manager: ['inventory', 'reports']
  };

  const allowedViews = rolePermissions[role] || [];

  if (loading) return <div className="flex h-screen items-center justify-center text-pink-600">Loading...</div>;
  if (!user) return <Login onLoginSuccess={checkUser} />;

  return (
    <div className="min-h-screen bg-[#fdf8f6] dark:bg-gray-900 flex flex-col transition-colors duration-300">
      
      {/* DESKTOP NAVIGATION */}
      <nav className="hidden md:block bg-white dark:bg-gray-800 shadow-sm border-b border-pink-100 dark:border-gray-700 sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center cursor-pointer" onClick={() => setCurrentView('dashboard')}>
            <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
          </div>
          
          <div className="flex space-x-1">
            {role && allowedViews.map((view) => (
              <button 
                key={view} 
                onClick={() => setCurrentView(view)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  currentView === view 
                    ? 'bg-pink-600 text-white shadow-md' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-pink-50 dark:hover:bg-gray-700'
                }`}
              >
                {view.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {role ? (
              <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                role === 'therapist' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                role === 'inventory_manager' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
              }`}>
                {role.replace('_', ' ')}
              </span>
            ) : (
              <span className="text-xs text-gray-400 animate-pulse">Loading...</span>
            )}
            
            {/* Dark Mode Toggle Button (Desktop) */}
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-yellow-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>

            <button 
              onClick={handleLogout} 
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 mb-20 md:mb-0">
        {!allowedViews.includes(currentView) ? (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-serif text-gray-800 dark:text-gray-200 mb-2">Access Denied</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">You don't have permission to view this page.</p>
            <button 
              onClick={() => setCurrentView(allowedViews[0])}
              className="px-6 py-3 bg-pink-600 text-white rounded-lg font-bold hover:bg-pink-700 transition"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <>
            {currentView === 'dashboard' && <Dashboard />}
            {currentView === 'pos' && <POS />}
            {currentView === 'appointments' && <Appointments />}
            {currentView === 'clients' && <Clients />}
            {currentView === 'reports' && <Reports />}
            {currentView === 'therapist' && <TherapistPanel />}
            {currentView === 'inventory' && <InventoryPanel />}
            {currentView === 'reception' && <ReceptionistPanel />}
            {currentView === 'audit_log' && <AuditLog />}
          </>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-pink-100 dark:border-gray-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50 pb-safe transition-colors duration-300">
        <div className="flex overflow-x-auto scrollbar-hide h-16 px-2 gap-1 items-center justify-start">
          {role && allowedViews.map((view) => (
            <button 
              key={view} 
              onClick={() => setCurrentView(view)}
              className={`flex flex-col items-center justify-center min-w-[64px] h-full space-y-1 shrink-0 ${
                currentView === view ? 'text-pink-600 dark:text-pink-400' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <span className="text-xl">
                {view === 'dashboard' && '📊'}
                {view === 'pos' && '🛒'}
                {view === 'appointments' && '📅'}
                {view === 'clients' && '👥'}
                {view === 'reports' && '📈'}
                {view === 'therapist' && '💆‍♀️'}
                {view === 'inventory' && ''}
                {view === 'reception' && '🏁'}
                {view === 'audit_log' && '📋'}
              </span>
              <span className="text-[9px] font-medium capitalize whitespace-nowrap">{view.replace('_', ' ')}</span>
            </button>
          ))}
          
          {/* Dark Mode Toggle Button (Mobile) */}
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="flex flex-col items-center justify-center min-w-[64px] h-full space-y-1 shrink-0 text-gray-400 dark:text-yellow-400"
          >
            <span className="text-xl">
              {darkMode ? '☀️' : '🌙'}
            </span>
            <span className="text-[9px] font-medium capitalize whitespace-nowrap">Theme</span>
          </button>
        </div>
      </nav>

    </div>
  );
}

export default App;