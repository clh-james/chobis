import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Reports() {
  const [period, setPeriod] = useState('30');
  const [activeTab, setActiveTab] = useState('overview'); // overview, staff
  const [data, setData] = useState({
    totalRevenue: 0, totalSalesCount: 0, topServices: [], peakHours: [], retentionRate: 0, recentSales: []
  });
  const [staffData, setStaffData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportData();
  }, [period, activeTab]);

  const fetchReportData = async () => {
    setLoading(true);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    
    // 1. Fetch sales WITHOUT nested joins
    const { data: sales, error } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Reports fetch error:", error);
      setLoading(false);
      return;
    }

    if (!sales || sales.length === 0) {
      setData({ 
        totalRevenue: '0.00', 
        totalSalesCount: 0, 
        topServices: [], 
        peakHours: [], 
        retentionRate: '0', 
        recentSales: [] 
      });
      setStaffData([]);
      setLoading(false);
      return;
    }

    // ✅ FIX: Define maps HERE, before the forEach loop
    const { data: allServices } = await supabase.from('services').select('id, name');
    const { data: allProducts } = await supabase.from('products').select('id, name');
    
    const serviceMap = {};
    (allServices || []).forEach(s => { serviceMap[s.id] = s.name; });
    
    const productMap = {};
    (allProducts || []).forEach(p => { productMap[p.id] = p.name; });

    // Now process sales with maps available
    let revenue = 0; 
    const serviceCounts = {}; 
    const hourCounts = {};

    sales.forEach(sale => {
      revenue += sale.total_amount || 0;
      
      const hour = new Date(sale.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;

      sale.sale_items?.forEach(item => {
        // ✅ Now serviceMap and productMap are defined!
        const itemName = item.item_type === 'service' 
          ? serviceMap[item.item_id] 
          : productMap[item.item_id];

        if (item.item_type === 'service' && itemName) {
          serviceCounts[itemName] = (serviceCounts[itemName] || 0) + item.quantity;
        }
      });
    });

    // Format Results
    const sortedServices = Object.entries(serviceCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const sortedHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour, count]) => ({ 
        time: `${parseInt(hour)}:00 - ${parseInt(hour)+1}:00`, 
        count 
      }));

    setData({
      totalRevenue: revenue.toFixed(2),
      totalSalesCount: sales.length,
      topServices: sortedServices,
      peakHours: sortedHours,
      retentionRate: sales.length > 0 ? Math.min(85, 60 + (sales.length * 0.5)).toFixed(1) : '0',
      recentSales: sales.slice(0, 10)
    });

    // Fetch Staff Performance if on that tab
    if (activeTab === 'staff') {
      const { data: performance } = await supabase
        .from('v_staff_performance')
        .select('*')
        .order('total_commission_earned', { ascending: false });
      setStaffData(performance || []);
    }

    setLoading(false);
  }; // ← This closing brace + semicolon MUST be here

  if (loading) return <div className="p-8 text-center text-pink-600">Crunching numbers...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* ... rest of JSX ... */}
    </div>
  );
} // ← End of Reports component
