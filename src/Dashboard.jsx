import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalSalesToday: 0,
    appointmentsToday: 0,
    totalRevenueToday: 0,
    lowStockProducts: [],
    upcomingAppointments: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();
    today.setHours(23, 59, 59, 999);
    const todayEnd = today.toISOString();

    // 1. Revenue & Sales
    const { data: salesData } = await supabase
      .from('sales')
      .select('total_amount')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd);
    
    const totalRevenue = salesData?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;
    const totalSales = salesData?.length || 0;

    // 2. Appointments Today
    const { data: appointmentsData } = await supabase
      .from('appointments')
      .select(`*, clients(name), services(name)`)
      .gte('appointment_date', todayStart)
      .lte('appointment_date', todayEnd)
      .order('appointment_date', { ascending: true });

    // 3. Low Stock
    const { data: lowStockData } = await supabase
      .from('products')
      .select('name, stock_quantity')
      .lt('stock_quantity', 5);

    setStats({
      totalSalesToday: totalSales,
      appointmentsToday: appointmentsData?.length || 0,
      totalRevenueToday: totalRevenue.toFixed(2),
      lowStockProducts: lowStockData || [],
      upcomingAppointments: appointmentsData?.slice(0, 5) || []
    });
    setLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center h-screen text-pink-600">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-[#fdf8f6] text-gray-800 font-sans pb-20 md:pb-0">
      {/* Elegant Header */}
      <div className="bg-white shadow-sm border-b border-pink-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <img 
            src="/logo.png" 
            alt="Chloe House of Beauty" 
            className="h-20 md:h-24 w-auto object-contain" 
          />
          <div className="text-right hidden md:block">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Welcome back</p>
            <p className="font-serif text-2xl text-pink-800 font-medium">Chloe House of Beauty</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard 
            title="Today's Revenue" 
            value={`₱${stats.totalRevenueToday}`} 
            icon="💰" 
            color="bg-gradient-to-br from-pink-500 to-rose-600" 
          />
          <MetricCard 
            title="Appointments" 
            value={stats.appointmentsToday} 
            icon="" 
            color="bg-gradient-to-br from-purple-500 to-indigo-600" 
          />
          <MetricCard 
            title="Total Sales" 
            value={stats.totalSalesToday} 
            icon="🛍️" 
            color="bg-gradient-to-br from-amber-400 to-orange-500" 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Upcoming Schedule Panel */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-pink-50 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-serif text-gray-800">Upcoming Today</h2>
              <span className="text-xs bg-pink-100 text-pink-700 px-3 py-1 rounded-full">{stats.upcomingAppointments.length} Bookings</span>
            </div>
            
            {stats.upcomingAppointments.length === 0 ? (
              <div className="text-center py-10 text-gray-400 italic">No appointments scheduled for today.</div>
            ) : (
              <div className="space-y-4">
                {stats.upcomingAppointments.map((appt) => (
                  <div key={appt.id} className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-pink-200 transition-all">
                    <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold mr-4 shrink-0">
                      {new Date(appt.appointment_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 truncate">{appt.clients?.name}</p>
                      <p className="text-sm text-gray-500 truncate">{appt.services?.name} • {appt.staff_name}</p>
                    </div>
                    <div className="text-xs font-medium px-3 py-1 bg-green-100 text-green-700 rounded-full ml-2 capitalize">
                      {appt.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inventory Alerts Panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-pink-50 p-6">
            <h2 className="text-xl font-serif text-gray-800 mb-6">Inventory Watch</h2>
            {stats.lowStockProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-green-600">
                <span className="text-4xl mb-2">✅</span>
                <p className="font-medium">All stocked up!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.lowStockProducts.map((product, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
                    <span className="font-medium text-gray-700">{product.name}</span>
                    <span className="text-red-600 font-bold text-sm">{product.stock_quantity} left</span>
                  </div>
                ))}
                <button className="w-full mt-4 py-2 text-sm text-pink-600 border border-pink-200 rounded-lg hover:bg-pink-50 transition">
                  View Full Inventory
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable Metric Card Component
function MetricCard({ title, value, icon, color }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg ${color}`}>
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
      <p className="text-sm opacity-90 font-medium mb-1">{title}</p>
      <div className="flex items-end justify-between">
        <p className="text-4xl font-bold tracking-tight">{value}</p>
        <span className="text-3xl opacity-80">{icon}</span>
      </div>
    </div>
  );
}