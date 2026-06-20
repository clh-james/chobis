import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { logAudit, ACTIONS, CATEGORIES } from './utils/auditLogger';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('7d'); // 7d, 30d, 90d, all
  
  // Summary stats
  const [stats, setStats] = useState({
    totalEvents: 0,
    authEvents: 0,
    dataChanges: 0,
    transactions: 0,
    topUsers: []
  });

  useEffect(() => {
    fetchLogs();
  }, [filterCategory, searchTerm, dateRange]);

  const fetchLogs = async () => {
    setLoading(true);
    
    // Calculate date filter
    let dateFilter = '';
    if (dateRange !== 'all') {
      const days = parseInt(dateRange);
      const date = new Date();
      date.setDate(date.getDate() - days);
      dateFilter = date.toISOString();
    }

    // Build query
    let query = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200); // Limit for performance

    if (dateFilter) query = query.gte('created_at', dateFilter);
    if (filterCategory !== 'ALL') query = query.eq('category', filterCategory);
    if (searchTerm) {
      query = query.or(`user_name.ilike.%${searchTerm}%,action.ilike.%${searchTerm}%,details->>0.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Failed to fetch logs:', error);
      // Fallback to localStorage
      const localLogs = JSON.parse(localStorage.getItem('chobis-audit-logs') || '[]');
      setLogs(localLogs.reverse());
    } else {
      setLogs(data || []);
    }

    // Calculate summary stats
    calculateStats(data || []);
    setLoading(false);
  };

  const calculateStats = (logData) => {
    const total = logData.length;
    const auth = logData.filter(l => l.category === CATEGORIES.AUTH).length;
    const dataChanges = logData.filter(l => 
      [CATEGORIES.APPOINTMENTS, CATEGORIES.CLIENTS, CATEGORIES.INVENTORY, CATEGORIES.STAFF].includes(l.category)
    ).length;
    const transactions = logData.filter(l => l.category === CATEGORIES.POS).length;

    // Top users by event count
    const userCounts = {};
    logData.forEach(log => {
      const name = log.user_name || 'Unknown';
      userCounts[name] = (userCounts[name] || 0) + 1;
    });
    
    const topUsers = Object.entries(userCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    setStats({ totalEvents: total, authEvents: auth, dataChanges, transactions, topUsers });
  };

  const exportToCSV = () => {
    const headers = ['Date', 'User', 'Role', 'Action', 'Category', 'Entity Type', 'Details'];
    const rows = logs.map(log => [
      new Date(log.created_at).toLocaleString(),
      log.user_name,
      log.user_role,
      log.action,
      log.category,
      log.entity_type,
      JSON.stringify(log.details)
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
      
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chobis-audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Log the export action
    logAudit({
      action: ACTIONS.STAFF.UPDATED, // Reusing STAFF_UPDATED as "EXPORTED_LOG"
      category: CATEGORIES.STAFF,
      entityType: 'audit_log',
      details: { exported_rows: logs.length, date_range: dateRange }
    });
  };

  const clearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear ALL audit logs? This cannot be undone.')) return;
    
    const { error } = await supabase.from('audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      alert('Failed to clear logs: ' + error.message);
    } else {
      localStorage.removeItem('chobis-audit-logs');
      setLogs([]);
      setStats({ totalEvents: 0, authEvents: 0, dataChanges: 0, transactions: 0, topUsers: [] });
      
      // Log the clear action
      logAudit({
        action: ACTIONS.STAFF.DELETED, // Reusing as "CLEARED_LOGS"
        category: CATEGORIES.STAFF,
        entityType: 'audit_log',
        details: { cleared_count: logs.length }
      });
    }
  };

  // Category colors for pills
  const getCategoryColor = (category) => {
    const colors = {
      [CATEGORIES.AUTH]: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      [CATEGORIES.APPOINTMENTS]: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      [CATEGORIES.CLIENTS]: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      [CATEGORIES.POS]: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      [CATEGORIES.INVENTORY]: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      [CATEGORIES.STAFF]: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      [CATEGORIES.ATTENDANCE]: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  // Action icons
  const getActionIcon = (action) => {
    const icons = {
      [ACTIONS.AUTH.LOGIN]: '🔓',
      [ACTIONS.AUTH.LOGOUT]: '🔒',
      [ACTIONS.APPOINTMENTS.CREATED]: '',
      [ACTIONS.APPOINTMENTS.STATUS_CHANGED]: '🔄',
      [ACTIONS.APPOINTMENTS.COMPLETED]: '✅',
      [ACTIONS.APPOINTMENTS.CANCELLED]: '❌',
      [ACTIONS.CLIENTS.ADDED]: '',
      [ACTIONS.CLIENTS.UPDATED]: '✏️',
      [ACTIONS.CLIENTS.DELETED]: '🗑️',
      [ACTIONS.POS.PAYMENT_PROCESSED]: '💳',
      [ACTIONS.POS.REFUND_ISSUED]: '↩️',
      [ACTIONS.INVENTORY.STOCK_INCREASED]: '📦+',
      [ACTIONS.INVENTORY.STOCK_DECREASED]: '-',
      [ACTIONS.INVENTORY.PRODUCT_ADDED]: '➕',
      [ACTIONS.INVENTORY.PRODUCT_UPDATED]: '📝',
      [ACTIONS.STAFF.ADDED]: '‍💼+',
      [ACTIONS.STAFF.UPDATED]: '👨‍💼✏️',
      [ACTIONS.STAFF.DEACTIVATED]: '🚫',
      [ACTIONS.STAFF.REACTIVATED]: '♻️',
      [ACTIONS.STAFF.DELETED]: '🗑️',
      [ACTIONS.ATTENDANCE.UPDATED]: ''
    };
    return icons[action] || '📋';
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-pink-600">Loading Audit Log...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-pink-800 dark:text-pink-300">Audit Log</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track all staff actions and system events</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={exportToCSV}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-pink-200 dark:border-gray-700 text-pink-700 dark:text-pink-300 rounded-lg hover:bg-pink-50 dark:hover:bg-gray-700 transition flex items-center gap-2"
          >
            📥 Export CSV
          </button>
          <button 
            onClick={clearLogs}
            className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition flex items-center gap-2"
          >
            🗑️ Clear Logs
          </button>
        </div>
      </div>

      {/* SUMMARY TILES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-pink-100 dark:border-gray-700 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">Total Events</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-200 mt-1">{stats.totalEvents.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-pink-100 dark:border-gray-700 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">Auth Events</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.authEvents.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-pink-100 dark:border-gray-700 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">Data Changes</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{stats.dataChanges.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-pink-100 dark:border-gray-700 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">Transactions</p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{stats.transactions.toLocaleString()}</p>
        </div>
      </div>

      {/* MOST ACTIVE USERS */}
      {stats.topUsers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-pink-100 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Most Active Users (This Period)</p>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {stats.topUsers.map((user, idx) => (
              <div key={idx} className="flex items-center gap-3 min-w-[150px]">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  idx === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                  idx === 1 ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' :
                  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                }`}>
                  #{idx + 1}
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate max-w-[100px]">{user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user.count} events</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FILTERS & SEARCH */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          <button 
            onClick={() => setFilterCategory('ALL')}
            className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition ${
              filterCategory === 'ALL' 
                ? 'bg-pink-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            All Categories
          </button>
          {Object.values(CATEGORIES).map(cat => (
            <button 
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition ${
                filterCategory === cat 
                  ? 'bg-pink-600 text-white' 
                  : `${getCategoryColor(cat)} hover:opacity-80`
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search & Date Range */}
        <div className="flex gap-2 flex-1">
          <input 
            type="text" 
            placeholder="Search users, actions, details..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-pink-400 outline-none"
          />
          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-pink-400 outline-none"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* LOG TABLE */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-pink-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 uppercase text-xs font-bold">
              <tr>
                <th className="p-4 w-16">Icon</th>
                <th className="p-4 w-40">Date & Time</th>
                <th className="p-4 w-40">User</th>
                <th className="p-4 min-w-[150px]">Action</th>
                <th className="p-4 w-32">Category</th>
                <th className="p-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-400 dark:text-gray-500 italic">
                    No audit logs found for the selected filters.
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr key={log.id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="p-4 text-xl">{getActionIcon(log.action)}</td>
                    <td className="p-4">
                      <div className="font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-gray-800 dark:text-gray-200 truncate max-w-[150px]" title={log.user_name}>
                        {log.user_name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {log.user_role?.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      {log.entity_type && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {log.entity_type}{log.entity_id ? ` #${log.entity_id.slice(0, 8)}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${getCategoryColor(log.category)}`}>
                        {log.category}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-xs text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title={JSON.stringify(log.details)}>
                        {Object.keys(log.details || {}).length > 0 
                          ? JSON.stringify(log.details).slice(0, 50) + '...' 
                          : '-'}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}