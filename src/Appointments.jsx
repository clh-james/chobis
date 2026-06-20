import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { logAudit, ACTIONS, CATEGORIES } from './utils/auditLogger';

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    client_name: '',
    client_phone: '',
    service_id: '',
    therapist_name: '',
    appointment_date: '',
    appointment_time: '',
    status: 'Scheduled',
    notes: '',
    package_session_number: 1,
    total_package_sessions: 1
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: apptData } = await supabase.from('appointments').select('*').order('appointment_date', { ascending: true });
    const { data: servData } = await supabase.from('services').select('id, name, price, duration_minutes, category').order('category');
    
    setAppointments(apptData || []);
    setServices(servData || []);
    setLoading(false);
  };

  const handleServiceChange = (e) => {
    const selectedService = services.find(s => s.id === e.target.value);
    setFormData(prev => ({
      ...prev,
      service_id: e.target.value,
      duration_minutes: selectedService ? selectedService.duration_minutes : 60
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const selectedService = services.find(s => s.id === formData.service_id);
    
    const { data: newAppt, error } = await supabase.from('appointments').insert([{
      ...formData,
      price: selectedService?.price || 0,
      service_name: selectedService?.name || 'General Consultation'
    }]).select().single();

    if (error) {
      alert('Error booking appointment: ' + error.message);
    } else {
      // ✅ AUDIT LOG: Appointment Created
      await logAudit({
        action: ACTIONS.APPOINTMENTS.CREATED,
        category: CATEGORIES.APPOINTMENTS,
        entityType: 'appointment',
        entityId: newAppt.id,
        details: {
          client: formData.client_name,
          phone: formData.client_phone,
          service: selectedService?.name,
          therapist: formData.therapist_name,
          date: formData.appointment_date,
          time: formData.appointment_time
        }
      });

      alert('Appointment booked successfully!');
      setFormData({
        client_name: '', client_phone: '', service_id: '', therapist_name: '',
        appointment_date: '', appointment_time: '', status: 'Scheduled',
        notes: '', package_session_number: 1, total_package_sessions: 1
      });
      fetchData();
    }
  };

  const handleStatusChange = async (apptId, newStatus) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', apptId);

    if (!error) {
      // ✅ AUDIT LOG: Status Changed or Completed
      const action = newStatus === 'Completed' 
        ? ACTIONS.APPOINTMENTS.COMPLETED 
        : ACTIONS.APPOINTMENTS.STATUS_CHANGED;
        
      await logAudit({
        action,
        category: CATEGORIES.APPOINTMENTS,
        entityType: 'appointment',
        entityId: apptId,
        details: { new_status: newStatus }
      });
      
      fetchData();
    }
  };

  if (loading) return <div className="p-8 text-center text-pink-600">Loading Calendar...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      
      <h1 className="text-3xl font-serif text-pink-800 dark:text-pink-300">Appointment Management</h1>
      
      {/* BOOKING FORM */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-pink-100 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">New Appointment</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          <input required placeholder="Client Name" className="p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} />
          <input required type="tel" placeholder="Phone Number" className="p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={formData.client_phone} onChange={e => setFormData({...formData, client_phone: e.target.value})} />
          
          <select required className="p-3 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={formData.service_id} onChange={handleServiceChange}>
            <option value="">Select Service...</option>
            {['Packages', 'Massage', 'Facials', 'Laser', 'Body Contouring', 'Brows & Lashes', 'Nails', 'RF Treatment', 'PRP', 'IV Therapy', 'Waxing', 'Sculpting', 'Specialty', 'Semi-Permanent Makeup', 'Aesthetics', 'Botox'].map(cat => {
              const catServices = services.filter(s => s.category === cat);
              if (catServices.length === 0) return null;
              return (
                <optgroup key={cat} label={cat}>
                  {catServices.map(s => (
                    <option key={s.id} value={s.id}>{s.name} - ₱{s.price} ({s.duration_minutes}m)</option>
                  ))}
                </optgroup>
              );
            })}
          </select>

          <input required placeholder="Therapist Name" className="p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={formData.therapist_name} onChange={e => setFormData({...formData, therapist_name: e.target.value})} />
          <input required type="date" className="p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={formData.appointment_date} onChange={e => setFormData({...formData, appointment_date: e.target.value})} />
          <input required type="time" className="p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={formData.appointment_time} onChange={e => setFormData({...formData, appointment_time: e.target.value})} />
          
          <div className="flex gap-2">
            <input type="number" min="1" placeholder="Session #" className="p-3 border rounded-lg w-1/2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={formData.package_session_number} onChange={e => setFormData({...formData, package_session_number: parseInt(e.target.value)})} />
            <span className="flex items-center text-gray-500 dark:text-gray-400">of</span>
            <input type="number" min="1" placeholder="Total" className="p-3 border rounded-lg w-1/2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={formData.total_package_sessions} onChange={e => setFormData({...formData, total_package_sessions: parseInt(e.target.value)})} />
          </div>

          <textarea placeholder="Notes / Special Requests" className="p-3 border rounded-lg md:col-span-2 lg:col-span-3 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" rows="2" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />

          <button type="submit" className="bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition md:col-span-2 lg:col-span-3">Book Appointment</button>
        </form>
      </div>

      {/* APPOINTMENT LIST - ONLY SHOWS WHEN BOOKINGS EXIST */}
      {appointments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-pink-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-pink-50 dark:bg-gray-700/50 text-pink-800 dark:text-pink-300 uppercase text-xs font-bold tracking-wider border-b border-pink-100 dark:border-gray-600">
                <tr>
                  <th className="p-4 w-32">Date & Time</th>
                  <th className="p-4 w-48">Client</th>
                  <th className="p-4 min-w-[200px]">Service</th>
                  <th className="p-4 w-40">Therapist</th>
                  <th className="p-4 w-32">Status</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700 text-sm text-gray-900 dark:text-gray-200">
                {appointments.map(appt => (
                  <tr key={appt.id} className="hover:bg-pink-50/50 dark:hover:bg-gray-700/30 transition-colors group">
                    <td className="p-4 align-top">
                      <div className="font-bold whitespace-nowrap">
                        {new Date(appt.appointment_date).toLocaleDateString('en-US', { 
                          month: 'short', day: 'numeric', year: 'numeric' 
                        })}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{appt.appointment_time}</div>
                    </td>
                    <td className="p-4 align-top">
                      <div className="font-bold truncate max-w-[150px]" title={appt.client_name}>{appt.client_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[150px]" title={appt.client_phone}>{appt.client_phone}</div>
                    </td>
                    <td className="p-4 align-top">
                      <div className="font-medium line-clamp-2 leading-tight" title={appt.service_name}>{appt.service_name || 'General Service'}</div>
                      {appt.total_package_sessions > 1 && (
                        <div className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full inline-block mt-2 font-bold whitespace-nowrap">
                          Session {appt.package_session_number}/{appt.total_package_sessions}
                        </div>
                      )}
                    </td>
                    <td className="p-4 align-top font-medium truncate max-w-[150px]" title={appt.therapist_name}>
                      {appt.therapist_name || '-'}
                    </td>
                    <td className="p-4 align-top">
                      {/* ✅ STATUS DROPDOWN WITH AUDIT LOGGING */}
                      <select 
                        value={appt.status}
                        onChange={(e) => handleStatusChange(appt.id, e.target.value)}
                        className={`text-xs font-bold px-2 py-1 rounded-full border-0 cursor-pointer outline-none ${
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}