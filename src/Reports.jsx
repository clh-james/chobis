import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    revenue: 0,
    hourlyData: {},
    topServices: [],
    dailyRevenue: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Fetch Sales Data (Last 7 Days)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const { data: salesData } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    // 2. ✅ FIX: Fetch Services & Products to build Lookup Maps
    const { data: servicesList } = await supabase.from('services').select('id, name');
    const { data: productsList } = await supabase.from('products').select('id, name');

    const serviceMap = {};
    servicesList?.forEach(s => { serviceMap[s.id] = s.name; });
    
    const productMap = {};
    productsList?.forEach(p => { productMap[p.id] = p.name; });

    // 3. Process Data
    let revenue = 0;
    const hourCounts = {};
    const serviceCounts = {};
    const dailyRev = {};

    salesData?.forEach((sale) => {
      // Revenue Calculation
      revenue += sale.total_amount || 0;

      // Daily Revenue Tracking
      const dayKey = new Date(sale.created_at).toLocaleDateString();
      dailyRev[dayKey] = (dailyRev[dayKey] || 0) + (sale.total_amount || 0);

      // Hourly Distribution
      const hour = new Date(sale.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;

      // Service/Product Breakdown
      sale.sale_items?.forEach((item) => {
        // ✅ Now serviceMap and productMap are defined!
        const itemName = item.item_type === 'service' 
          ? serviceMap[item.item_id] 
          : productMap[item.item_id];

        if (itemName) {
          serviceCounts[itemName] = (serviceCounts[itemName] || 0) + (item.quantity || 1);
        }
      });
    });

    setStats({
      revenue,
      hourlyData: hourCounts,
      topServices: Object.entries(serviceCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count })),
      dailyRevenue: Object.entries(dailyRev).map(([date, amount]) => ({ date, amount }))
    });

    setLoading(false);
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-pink-600 dark:text-pink-400">Loading Reports...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-pink-800 dark:text-pink-300">Business Reports</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Performance overview for the last 7 days</p>
        </div>
        <button 
          onClick={fetchData}
          className="px-4 py-2 bg-white dark:bg-gray-800 border border-pink-200 dark:border-gray-700 text-pink-700 dark:text-pink-300 rounded-lg hover:bg-pink-50 dark:hover:bg-gray-700 transition"
        >
          🔄 Refresh Data
        </button>
      </div>

      {/* KEY METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-6 rounded-2xl text-white shadow-lg">
          <p className="text-sm opacity-90 font-medium mb-1">Total Revenue</p>
          <p className="text-4xl font-bold tracking-tight">₱{stats.revenue.toLocaleString()}</p>
          <p className="text-xs opacity-80 mt-2">Last 7 days</p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-pink-100 dark:border-gray-700 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Busiest Hour</p>
          {Object.keys(stats.hourlyData).length > 0 ? (
            <>
              <p className="text-4xl font-bold text-gray-800 dark:text-gray-200">
                {Object.entries(stats.hourlyData)
                  .sort(([,a], [,b]) => b - a)[0][0]}:00
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
                {Object.entries(stats.hourlyData)
                  .sort(([,a], [,b]) => b - a)[0][1]} transactions
              </p>
            </>
          ) : (
            <p className="text-2xl font-bold text-gray-400">No Data</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-pink-100 dark:border-gray-700 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Top Service</p>
          {stats.topServices.length > 0 ? (
            <>
              <p className="text-xl font-bold text-gray-800 dark:text-gray-200 truncate">{stats.topServices[0].name}</p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 font-medium">
                {stats.topServices[0].count} sold
              </p>
            </>
          ) : (
            <p className="text-2xl font-bold text-gray-400">No Data</p>
          )}
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* DAILY REVENUE BAR CHART */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-pink-100 dark:border-gray-700 shadow-sm">
          <h3 className="font-serif text-lg text-gray-800 dark:text-gray-200 mb-4">Daily Revenue Trend</h3>
          <div className="flex items-end justify-between h-48 gap-2">
            {stats.dailyRevenue.map((day, idx) => {
              const maxVal = Math.max(...stats.dailyRevenue.map(d => d.amount), 1);
              const heightPercent = (day.amount / maxVal) * 100;
              return (
                <div key={idx} className="flex flex-col items-center flex-1 group">
                  <div className="relative w-full flex justify-center">
                    <div 
                      className="w-full max-w-[30px] bg-pink-400 dark:bg-pink-600 rounded-t-md transition-all duration-500 group-hover:bg-pink-500"
                      style={{ height: `${Math.max(heightPercent, 2)}%` }}
                    ></div>
                    <div className="absolute -top-8 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      ₱{day.amount.toLocaleString()}
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 truncate w-full text-center">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                </div>
              );
            })}
            {stats.dailyRevenue.length === 0 && (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm italic">No revenue data yet</div>
            )}
          </div>
        </div>

        {/* TOP SERVICES LIST */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-pink-100 dark:border-gray-700 shadow-sm">
          <h3 className="font-serif text-lg text-gray-800 dark:text-gray-200 mb-4">Top Performing Services</h3>
          <div className="space-y-3">
            {stats.topServices.length > 0 ? (
              stats.topServices.map((service, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      idx === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      idx === 1 ? 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300' :
                      idx === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                      'bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-300'
                    }`}>
                      #{idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">{service.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{service.count} units sold</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="h-2 w-24 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-pink-500 rounded-full"
                        style={{ width: `${(service.count / stats.topServices[0].count) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm italic">No service data yet</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}