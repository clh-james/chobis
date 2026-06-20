import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Dashboard() {
  const [stats, setStats] = useState({
    todayRevenue: 0,
    todayAppointments: 0,
    topTherapist: null,
    lowStockItems: [],
    busyDays: {},
    vipClients: [],
    serviceBreakdown: {}
  });
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [reorderCopied, setReorderCopied] = useState(false);
  const [eodCopied, setEodCopied] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    
    const today = new Date().toISOString().split('T')[0];
    const { data: salesData } = await supabase.from('sales').select('total_amount, created_at').gte('created_at', `${today}T00:00:00`).lte('created_at', `${today}T23:59:59`);
    const totalRevenue = salesData?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
    const { count: apptCount } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('appointment_date', today);

    const { data: saleItems } = await supabase.from('sale_items').select('item_type, item_id, quantity, total_price').gte('created_at', `${today}T00:00:00`);
    const breakdown = {};
    saleItems?.forEach(item => {
      const key = item.item_type === 'service' ? 'Services' : 'Products';
      if (!breakdown[key]) breakdown[key] = { count: 0, revenue: 0 };
      breakdown[key].count += item.quantity;
      breakdown[key].revenue += item.total_price;
    });

    const { data: therapistSales } = await supabase.from('sale_items').select('staff_id, total_price').gte('created_at', `${today}T00:00:00`).not('staff_id', 'is', null);
    let topTherapistId = null;
    let maxRev = 0;
    const therapistRev = {};
    therapistSales?.forEach(item => {
      therapistRev[item.staff_id] = (therapistRev[item.staff_id] || 0) + item.total_price;
      if (therapistRev[item.staff_id] > maxRev) { maxRev = therapistRev[item.staff_id]; topTherapistId = item.staff_id; }
    });
    let topTherapistName = 'N/A';
    if (topTherapistId) {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', topTherapistId).single();
      topTherapistName = profile?.full_name || 'Unknown';
    }

    const { data: lowStockData } = await supabase.from('products').select('name, stock_quantity, supplier_name').lt('stock_quantity', 5).order('stock_quantity', { ascending: true }).limit(5);

    const busyDays = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const { count } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('appointment_date', dateStr);
      busyDays[dayName] = count || 0;
    }

    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
    const { data: monthSales } = await supabase.from('sales').select('client_id, total_amount').gte('created_at', startOfMonth.toISOString());
    const clientSpending = {};
    monthSales?.forEach(sale => { if (sale.client_id) clientSpending[sale.client_id] = (clientSpending[sale.client_id] || 0) + sale.total_amount; });
    const sortedClients = Object.entries(clientSpending).sort(([,a], [,b]) => b - a).slice(0, 5);
    const vipClients = await Promise.all(sortedClients.map(async ([clientId, total]) => {
      const { data: client } = await supabase.from('clients').select('name, phone').eq('id', clientId).single();
      return { ...client, id: clientId, totalSpent: total };
    }));

    setStats({
      todayRevenue: totalRevenue, todayAppointments: apptCount || 0,
      topTherapist: { name: topTherapistName, revenue: maxRev },
      lowStockItems: lowStockData || [], busyDays,
      vipClients: vipClients.filter(c => c.name), serviceBreakdown: breakdown,
      loading: false
    });
    setLoading(false);
  };

  const handleCopyPromo = (client) => {
    const firstName = client.name.split(' ')[0];
    const message = `Hi ${firstName}! 💖 As one of our top VIPs at Chloe House of Beauty, we'd love to treat you. Book any service this week and get 15% OFF! Reply YES to claim. `;
    navigator.clipboard.writeText(message).then(() => { setCopiedId(client.id); setTimeout(() => setCopiedId(null), 2000); });
  };

  const handleCopyReorder = () => {
    if (stats.lowStockItems.length === 0) return;
    let message = "📦 URGENT RESTOCK ORDER - Chloe House of Beauty\n\nPlease deliver the following items ASAP:\n\n";
    stats.lowStockItems.forEach((item, idx) => {
      const suggestedQty = Math.max(10 - item.stock_quantity, 5);
      message += `${idx + 1}. ${item.name}\n   Current Stock: ${item.stock_quantity} | Suggested Order: ${suggestedQty} units\n`;
      if (item.supplier_name) message += `   Supplier: ${item.supplier_name}\n`;
      message += "\n";
    });
    message += "Thank you! Please confirm delivery date. 🙏";
    navigator.clipboard.writeText(message).then(() => { setReorderCopied(true); setTimeout(() => setReorderCopied(false), 3000); });
  };

  const handleCopyEODReport = () => {
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const sb = stats.serviceBreakdown;
    let report = ` CHLOE HOUSE OF BEAUTY - DAILY REPORT 🌸\n📅 Date: ${dateStr}\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    report += ` TOTAL REVENUE: ₱${stats.todayRevenue.toLocaleString()}\n📋 APPOINTMENTS: ${stats.todayAppointments}\n TOP STAFF: ${stats.topTherapist.name} (₱${stats.topTherapist.revenue.toLocaleString()})\n\n`;
    if (sb.Services || sb.Products) {
      report += ` SALES BREAKDOWN:\n`;
      if (sb.Services) report += `   • Services: ${sb.Services.count} sold (₱${sb.Services.revenue.toLocaleString()})\n`;
      if (sb.Products) report += `   • Products: ${sb.Products.count} sold (₱${sb.Products.revenue.toLocaleString()})\n`;
      report += `\n`;
    }
    if (stats.lowStockItems.length > 0) {
      report += `⚠️ LOW STOCK ALERTS (${stats.lowStockItems.length}):\n`;
      stats.lowStockItems.forEach(i => report += `   • ${i.name} (${i.stock_quantity} left)\n`);
      report += `\n`;
    }
    report += `━━━━━━━━━━━━━━━━━━━━━━\nGenerated by CHOBIS Admin Dashboard`;
    navigator.clipboard.writeText(report).then(() => { setEodCopied(true); setTimeout(() => setEodCopied(false), 3000); });
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-pink-600 dark:text-pink-400">Loading Dashboard...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 md:pb-0"> {/* ROOT DIV START */}
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-pink-800 dark:text-pink-300">Admin Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time business overview for {new Date().toLocaleDateString()}</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-white dark:bg-gray-800 border border-pink-200 dark:border-gray-700 text-pink-700 dark:text-pink-300 rounded-lg hover:bg-pink-50 dark:hover:bg-gray-700 transition flex items-center gap-2"
        >
          🔄 Refresh Data
        </button>
      </div>

      {/* KEY METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Revenue Card */}
        <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
          <p className="text-sm opacity-90 font-medium mb-1">Today's Revenue</p>
          <p className="text-4xl font-bold tracking-tight">₱{stats.todayRevenue.toLocaleString()}</p>
          <p className="text-xs opacity-80 mt-2">From {stats.todayAppointments} appointments</p>
        </div>

        {/* Top Therapist Card */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-pink-100 dark:border-gray-700 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Top Performer Today</p>
          <div className="flex items-center gap-3 mt-2">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-300 font-bold text-xl">
              {stats.topTherapist.name.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-200">{stats.topTherapist.name}</p>
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">₱{stats.topTherapist.revenue.toLocaleString()} generated</p>
            </div>
          </div>
        </div>

        {/* Inventory Alert Card */}
        <div className={`p-6 rounded-2xl border shadow-sm flex flex-col justify-between ${
          stats.lowStockItems.length > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        }`}>
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: stats.lowStockItems.length > 0 ? '#dc2626' : '#16a34a' }}>
              {stats.lowStockItems.length > 0 ? '⚠️ Low Stock Alert' : '✅ Stock Status'}
            </p>
            <p className="font-bold text-gray-800 dark:text-gray-200 text-lg">
              {stats.lowStockItems.length > 0 ? `${stats.lowStockItems.length} Items Critical` : 'All Stocked Up'}
            </p>
            {stats.lowStockItems.length > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1 line-clamp-2">
                {stats.lowStockItems.map(i => i.name).join(', ')}
              </p>
            )}
          </div>
          {stats.lowStockItems.length > 0 && (
            <button 
              onClick={handleCopyReorder}
              className={`mt-4 w-full py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                reorderCopied ? 'bg-green-600 text-white' : 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
              }`}
            >
              {reorderCopied ? '✅ Order Copied!' : '📋 Copy Reorder List'}
            </button>
          )}
        </div>

        {/* ✅ QUICK ACTIONS CARD - FIXED TAGS */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-pink-100 dark:border-gray-700 shadow-sm flex flex-col justify-center gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Quick Actions</p>
          
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => window.location.hash = '#appointments'}
              className="py-3 px-4 bg-gradient-to-br from-pink-900/40 to-pink-800/40 dark:from-pink-900/60 dark:to-purple-900/60 border border-pink-200/50 dark:border-pink-800/50 text-pink-700 dark:text-pink-200 rounded-xl font-bold text-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1"
            >
              <span className="text-lg leading-none">+</span> New Appt
            </button>

            <button 
              onClick={() => window.location.hash = '#inventory'}
              className="py-3 px-4 bg-gradient-to-br from-indigo-900/40 to-blue-900/40 dark:from-indigo-900/60 dark:to-slate-900/60 border border-indigo-200/50 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-200 rounded-xl font-bold text-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1"
            >
              <span className="text-lg leading-none">+</span> Add Product
            </button>

            <button 
              onClick={handleCopyEODReport}
              className={`col-span-2 py-3.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
                eodCopied 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 text-white hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]'
              }`}
            >
              {eodCopied ? '✅ Report Copied!' : '📊 Generate EOD Report'}
            </button>
          </div>
        </div>
      </div>

      {/* HEATMAP & VIP TRACKER SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* APPOINTMENT HEATMAP */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-pink-100 dark:border-gray-700 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-serif text-gray-800 dark:text-gray-200">Weekly Booking Density</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">Last 7 Days</span>
          </div>
          <div className="flex items-end justify-between h-40 gap-2 sm:gap-4">
            {Object.entries(stats.busyDays).map(([day, count]) => {
              const heightPercent = Math.min((count / 10) * 100, 100); 
              const intensity = count === 0 ? 'bg-gray-100 dark:bg-gray-700' : count < 3 ? 'bg-pink-200 dark:bg-pink-900/40' : count < 6 ? 'bg-pink-400 dark:bg-pink-700' : 'bg-pink-600 dark:bg-pink-500';
              return (
                <div key={day} className="flex flex-col items-center flex-1 group cursor-pointer">
                  <div className="relative w-full flex justify-center">
                    <div className={`w-full max-w-[40px] rounded-t-lg transition-all duration-500 ${intensity} group-hover:opacity-80`} style={{ height: `${Math.max(heightPercent, 5)}%` }}></div>
                    <div className="absolute -top-8 bg-gray-800 dark:bg-gray-600 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">{count} Bookings</div>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">{day}</span>
                </div>
              );
            })}
          </div>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6 italic">Darker pink indicates higher booking volume.</p>
        </div>

        {/* VIP CLIENT TRACKER */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-pink-100 dark:border-gray-700 shadow-sm p-6 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-serif text-gray-800 dark:text-gray-200">Top VIP Clients</h2>
            <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded-full font-bold">This Month</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar max-h-[320px]">
            {stats.vipClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-500 text-sm italic">No sales recorded this month yet.</div>
            ) : (
              stats.vipClients.map((client, idx) => (
                <div key={idx} className="flex flex-col p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600 hover:border-pink-200 dark:hover:border-pink-700 transition-colors gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        idx === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' : 
                        idx === 1 ? 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300' : 
                        idx === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' : 
                        'bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-300'
                      }`}>#{idx + 1}</div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">{client.name}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{client.phone}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-bold text-sm text-pink-700 dark:text-pink-300">₱{client.totalSpent.toLocaleString()}</p>
                    </div>
                  </div>
                  <button onClick={() => handleCopyPromo(client)} className={`w-full py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    copiedId === client.id 
                      ? 'bg-green-500 text-white' 
                      : 'bg-white dark:bg-gray-600 border border-pink-200 dark:border-gray-500 text-pink-600 dark:text-pink-300 hover:bg-pink-50 dark:hover:bg-gray-500'
                  }`}>
                    {copiedId === client.id ? '✅ Message Copied!' : '💬 Send VIP Promo'}
                  </button>
                </div>
              ))
            )}
          </div>
          <button className="w-full mt-4 py-2 text-xs font-bold text-pink-600 dark:text-pink-300 border border-pink-200 dark:border-gray-600 rounded-lg hover:bg-pink-50 dark:hover:bg-gray-700 transition">View All Clients</button>
        </div>

      </div>

    </div> /* ROOT DIV END */
  );
}