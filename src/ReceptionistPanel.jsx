import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { logAudit, ACTIONS, CATEGORIES } from './utils/auditLogger';

export default function ReceptionistPanel() {
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Walk-in Form State
  const [showWalkInForm, setShowWalkInForm] = useState(false);
  const [walkInData, setWalkInData] = useState({
    client_name: '',
    client_phone: '',
    service_id: '',
    therapist_name: '',
    appointment_time: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    
    const { data: apptData } = await supabase
      .from('appointments')
      .select('*')
      .eq('appointment_date', today)
      .order('appointment_time', { ascending: true });
      
    const { data: servData } = await supabase.from('services').select('id, name, price, duration_minutes').order('name');
    
    setTodayAppointments(apptData || []);
    setServices(servData || []);
    setLoading(false);
  };

  const handleWalkInBooking = async (e) => {
    e.preventDefault();
    const selectedService = services.find(s => s.id === walkInData.service_id);
    const today = new Date().toISOString().split('T')[0];

    const { data: newAppt, error } = await supabase.from('appointments').insert([{
      ...walkInData,
      appointment_date: today,
      status: 'Checked In',
      price: selectedService?.price || 0,
      service_name: selectedService?.name || 'Walk-in Service',
      duration_minutes: selectedService?.duration_minutes || 60
    }]).select().single();

    if (error) {
      alert('Error creating walk-in: ' + error.message);
    } else {
      // ✅ AUDIT LOG: Appointment Created (Walk-in)
      await logAudit({
        action: ACTIONS.APPOINTMENTS.CREATED,
        category: CATEGORIES.APPOINTMENTS,
        entityType: 'appointment',
        entityId: newAppt.id,
        details: {
          type: 'WALK_IN',
          client: walkInData.client_name,
          phone: walkInData.client_phone,
          service: selectedService?.name,
          therapist: walkInData.therapist_name,
          time: walkInData.appointment_time
        }
      });

      alert('Walk-in booked successfully!');
      setShowWalkInForm(false);
      setWalkInData({ client_name: '', client_phone: '', service_id: '', therapist_name: '', appointment_time: '', notes: '' });
      fetchData();
    }
  };

  const handleStatusChange = async (apptId, newStatus) => {
    const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', apptId);
    
    if (!error) {
      const action = newStatus === 'Completed' ? ACTIONS.APPOINTMENTS.COMPLETED : ACTIONS.APPOINTMENTS.STATUS_CHANGED;
      await logAudit({
        action,
        category: CATEGORIES.APPOINTMENTS,
        entityType: 'appointment',
        entityId: apptId,
        details: { new_status: newStatus }
      });
      fetchData();
    } else {
      alert('Failed to update status: ' + error.message);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-pink-600 dark:text-pink-400">Loading Reception...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-pink-800 dark:text-pink-300">Reception Desk</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Today's Schedule • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button 
          onClick={() => setShowWalkInForm(true)}
          className="px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl font-bold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
        >
           Walk-In Booking
        </button>
      </div>

      {/* STATS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Booked', value: todayAppointments.length, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
          { label: 'Checked In', value: todayAppointments.filter(a => a.status === 'Checked In').length, color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' },
          { label: 'Completed', value: todayAppointments.filter(a => a.status === 'Completed').length, color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
          { label: 'Cancelled', value: todayAppointments.filter(a => a.status === 'Cancelled').length, color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' }
        ].map((stat, idx) => (
          <div key={idx} className={`p-4 rounded-xl border ${stat.color}`}>
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">{stat.label}</p>
            <p className="text-3xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* TODAY'S SCHEDULE TABLE */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-pink-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-pink-100 dark:border-gray-700 bg-pink-50/50 dark:bg-gray-700/30">
          <h2 className="font-serif text-lg text-pink-800 dark:text-pink-300 font-bold">Appointment Timeline</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 uppercase text-xs font-bold">
              <tr>
                <th className="p-4 w-24">Time</th>
                <th className="p-4">Client</th>
                <th className="p-4 min-w-[180px]">Service</th>
                <th className="p-4 w-32">Therapist</th>
                <th className="p-4 w-32">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {todayAppointments.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-gray-400 dark:text-gray-500">
                    <div className="text-4xl mb-3 opacity-30"></div>
                    <p className="font-medium">No appointments scheduled for today</p>
                    <p className="text-xs mt-1">Use the Walk-In button above to add clients</p>
                  </td>
                </tr>
              ) : (
                todayAppointments.map(appt => (
                  <tr key={appt.id} className="hover:bg-pink-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="p-4 font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">{appt.appointment_time}</td>
                    <td className="p-4">
                      <div className="font-medium text-gray-800 dark:text-gray-200">{appt.client_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{appt.client_phone}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-pink-700 dark:text-pink-300 font-medium">{appt.service_name}</div>
                      {appt.total_package_sessions > 1 && (
                        <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full mt-1 inline-block">
                          Session {appt.package_session_number}/{appt.total_package_sessions}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">{appt.therapist_name || '-'}</td>
                    <td className="p-4">
                      <select 
                        value={appt.status}
                        onChange={(e) => handleStatusChange(appt.id, e.target.value)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full border-0 cursor-pointer outline-none ${
                          appt.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                          appt.status === 'Cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                          appt.status === 'Checked In' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                        }`}
                      >
                        <option>Scheduled</option>
                        <option>Checked In</option>
                        <option>Completed</option>
                        <option>Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WALK-IN MODAL */}
      {showWalkInForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-serif text-pink-800 dark:text-pink-300 font-bold">Walk-In Booking</h3>
              <button onClick={() => setShowWalkInForm(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleWalkInBooking} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Client Name *</label>
                  <input required type="text" value={walkInData.client_name} onChange={e => setWalkInData({...walkInData, client_name: e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-pink-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Phone *</label>
                  <input required type="tel" value={walkInData.client_phone} onChange={e => setWalkInData({...walkInData, client_phone: e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-pink-400 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Service *</label>
                <select required value={walkInData.service_id} onChange={e => setWalkInData({...walkInData, service_id: e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-pink-400 outline-none">
                  <option value="">Select a service...</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name} - ₱{s.price}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Therapist</label>
                  <input type="text" value={walkInData.therapist_name} onChange={e => setWalkInData({...walkInData, therapist_name: e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-pink-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Time *</label>
                  <input required type="time" value={walkInData.appointment_time} onChange={e => setWalkInData({...walkInData, appointment_time: e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-pink-400 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Notes</label>
                <textarea rows="2" value={walkInData.notes} onChange={e => setWalkInData({...walkInData, notes: e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-pink-400 outline-none resize-none" placeholder="Special requests, allergies, etc." />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowWalkInForm(false)} className="flex-1 py-3 text-sm font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition">Cancel</button>
                <button type="submit" className="flex-1 py-3 text-sm font-bold text-white bg-gradient-to-r from-pink-600 to-rose-600 rounded-xl hover:shadow-lg transition">Book Walk-In</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}