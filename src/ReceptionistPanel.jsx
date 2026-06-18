import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function ReceptionistPanel() {
  const [activeTab, setActiveTab] = useState('schedule'); // schedule, walkin, receipts
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Walk-in Form State
  const [walkinForm, setWalkinForm] = useState({
    client_id: '', new_client_name: '', new_client_phone: '', 
    service_id: '', staff_name: 'Chloe', notes: ''
  });

  // Receipt Preview State
  const [selectedSale, setSelectedSale] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    
    const { data: appts } = await supabase
      .from('appointments')
      .select('*, clients(name), services(name)')
      .gte('appointment_date', `${today}T00:00:00`)
      .order('appointment_date', { ascending: true });

    const { data: cli } = await supabase.from('clients').select('id, name').order('name');
    const { data: srv } = await supabase.from('services').select('id, name, price').order('name');

    setAppointments(appts || []);
    setClients(cli || []);
    setServices(srv || []);
    setLoading(false);
  };

  // Handle Check-In / Status Update
  const updateStatus = async (id, status) => {
    await supabase.from('appointments').update({ status }).eq('id', id);
    fetchData();
  };

  // Handle Walk-in Booking
  const handleWalkIn = async (e) => {
    e.preventDefault();
    let clientId = walkinForm.client_id;

    // Create new client if needed
    if (!clientId && walkinForm.new_client_name) {
      const { data: newCli } = await supabase
        .from('clients')
        .insert([{ name: walkinForm.new_client_name, phone: walkinForm.new_client_phone }])
        .select()
        .single();
      clientId = newCli?.id;
    }

    if (!clientId) return alert('Please select or create a client');

    const selectedService = services.find(s => s.id === walkinForm.service_id);
    const now = new Date();

    await supabase.from('appointments').insert([{
      client_id: clientId,
      service_id: walkinForm.service_id,
      appointment_date: now.toISOString(),
      staff_name: walkinForm.staff_name,
      duration_minutes: 60, // Default for walk-ins
      status: 'checked_in',
      notes: `Walk-in: ${walkinForm.notes}`
    }]);

    alert('Walk-in checked in successfully!');
    setWalkinForm({ client_id: '', new_client_name: '', new_client_phone: '', service_id: '', staff_name: 'Chloe', notes: '' });
    fetchData();
    setActiveTab('schedule');
  };

  // Mock Receipt Data (In production, link sales to appointments)
  const generateMockReceipt = (appt) => {
    setSelectedSale({
      id: `REC-${Math.floor(Math.random() * 10000)}`,
      date: new Date().toLocaleString(),
      client: appt.clients?.name || 'Walk-in Client',
      items: [{ name: appt.services?.name || 'Service', qty: 1, price: appt.services?.price || 0 }],
      total: appt.services?.price || 0,
      staff: appt.staff_name
    });
    // Trigger print after state updates
    setTimeout(() => window.print(), 100);
  };

  if (loading) return <div className="p-8 text-center text-pink-600">Loading Front Desk...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-pink-100">
        <h1 className="text-2xl font-serif text-pink-800">Front Desk Operations</h1>
        <div className="flex bg-gray-100 p-1 rounded-lg mt-4 md:mt-0">
          {[
            { id: 'schedule', label: 'Today\'s Schedule' },
            { id: 'walkin', label: 'Quick Walk-In' },
            { id: 'receipts', label: 'Receipts' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-white text-pink-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: TODAY'S SCHEDULE */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-xl shadow-sm border border-pink-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-pink-50 text-pink-800">
              <tr>
                <th className="p-4 font-semibold">Time</th>
                <th className="p-4 font-semibold">Client</th>
                <th className="p-4 font-semibold">Service</th>
                <th className="p-4 font-semibold">Staff</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-50">
              {appointments.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-400 italic">No appointments for today.</td></tr>
              ) : (
                appointments.map(appt => (
                  <tr key={appt.id} className="hover:bg-pink-50/30">
                    <td className="p-4 font-bold text-pink-700">
                      {new Date(appt.appointment_date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                    </td>
                    <td className="p-4 font-medium">{appt.clients?.name}</td>
                    <td className="p-4">{appt.services?.name}</td>
                    <td className="p-4 text-sm text-gray-500">{appt.staff_name}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${
                        appt.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                        appt.status === 'checked_in' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>{appt.status.replace('_', ' ')}</span>
                    </td>
                    <td className="p-4 flex gap-2">
                      {appt.status === 'scheduled' && (
                        <button onClick={() => updateStatus(appt.id, 'checked_in')} className="px-3 py-1 bg-yellow-500 text-white rounded text-xs font-bold hover:bg-yellow-600">Check In</button>
                      )}
                      {appt.status === 'checked_in' && (
                        <button onClick={() => updateStatus(appt.id, 'completed')} className="px-3 py-1 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600">Complete</button>
                      )}
                      <button onClick={() => generateMockReceipt(appt)} className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs font-bold hover:bg-gray-200 border border-gray-200">Print Receipt</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: QUICK WALK-IN */}
      {/* Mobile Card View (Visible < md) */}
<div className="md:hidden space-y-3">
  {appointments.map(appt => (
    <div key={appt.id} className="bg-white p-4 rounded-xl shadow-sm border border-pink-100 flex justify-between items-center">
      <div>
        <p className="font-bold text-pink-700 text-lg">
          {new Date(appt.appointment_date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
        </p>
        <p className="font-medium text-gray-800">{appt.clients?.name}</p>
        <p className="text-sm text-gray-500">{appt.services?.name} • {appt.staff_name}</p>
      </div>
      <div className="flex flex-col gap-2">
        {appt.status === 'scheduled' && (
          <button onClick={() => updateStatus(appt.id, 'checked_in')} 
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-bold active:scale-95 transition">
            Check In
          </button>
        )}
        <button onClick={() => generateMockReceipt(appt)} 
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold border border-gray-200 active:scale-95 transition">
          Receipt
        </button>
      </div>
    </div>
  ))}
</div>

{/* Desktop Table View (Visible >= md) */}
<div className="hidden md:block overflow-x-auto">
  {/* ... existing table code ... */}
</div>
      {activeTab === 'walkin' && (
        <div className="bg-white rounded-xl shadow-sm border border-pink-100 p-6 max-w-2xl mx-auto">
          <h2 className="text-xl font-serif text-pink-800 mb-6">Register Walk-in Client</h2>
          <form onSubmit={handleWalkIn} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Existing Client</label>
                <select className="w-full p-3 border border-pink-200 rounded-lg"
                  value={walkinForm.client_id} onChange={e => setWalkinForm({...walkinForm, client_id: e.target.value})}>
                  <option value="">-- Select Client --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">OR New Client Name</label>
                <input placeholder="Full Name" className="w-full p-3 border border-pink-200 rounded-lg"
                  value={walkinForm.new_client_name} onChange={e => setWalkinForm({...walkinForm, new_client_name: e.target.value})} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Client Phone</label>
                <input placeholder="09XX XXX XXXX" className="w-full p-3 border border-pink-200 rounded-lg"
                  value={walkinForm.new_client_phone} onChange={e => setWalkinForm({...walkinForm, new_client_phone: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Required</label>
                <select required className="w-full p-3 border border-pink-200 rounded-lg"
                  value={walkinForm.service_id} onChange={e => setWalkinForm({...walkinForm, service_id: e.target.value})}>
                  <option value="">Select Service</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name} - ₱{s.price}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Staff</label>
                <input className="w-full p-3 border border-pink-200 rounded-lg"
                  value={walkinForm.staff_name} onChange={e => setWalkinForm({...walkinForm, staff_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input placeholder="Allergies, preferences..." className="w-full p-3 border border-pink-200 rounded-lg"
                  value={walkinForm.notes} onChange={e => setWalkinForm({...walkinForm, notes: e.target.value})} />
              </div>
            </div>

            <button type="submit" className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition mt-4">
              Check In Walk-in Now
            </button>
          </form>
        </div>
      )}

      {/* PRINT RECEIPT TEMPLATE (Hidden unless printing) */}
      {selectedSale && (
        <div className="hidden print:block fixed inset-0 bg-white z-50 p-8">
          <div className="max-w-[80mm] mx-auto text-center font-mono text-sm">
            <img src="/logo.png" alt="Logo" className="h-16 mx-auto mb-4 opacity-80" />
            <h2 className="text-lg font-bold uppercase tracking-wider mb-1">Chloe House of Beauty</h2>
            <p className="text-xs text-gray-500 mb-4">Gluta Spa & Wellness Center</p>
            
            <div className="border-b border-dashed border-gray-300 pb-2 mb-2 text-left">
              <p>Date: {selectedSale.date}</p>
              <p>Receipt #: {selectedSale.id}</p>
              <p>Client: {selectedSale.client}</p>
              <p>Staff: {selectedSale.staff}</p>
            </div>

            <div className="text-left mb-4">
              {selectedSale.items.map((item, i) => (
                <div key={i} className="flex justify-between py-1">
                  <span>{item.qty}x {item.name}</span>
                  <span>₱{item.price.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-300 pt-2 mb-4 flex justify-between font-bold text-base">
              <span>TOTAL</span>
              <span>₱{selectedSale.total.toFixed(2)}</span>
            </div>

            <p className="text-xs text-gray-400 mt-8">Thank you for choosing us!</p>
            <p className="text-xs text-gray-400">www.chloehouseofbeauty.com</p>
          </div>
        </div>
      )}
    </div>
  );
}