import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  
  // Form state
  const [newAppt, setNewAppt] = useState({
    client_id: '',
    service_id: '',
    appointment_date: '',
    staff_name: 'Chloe' // Default staff name
  });

  // Fetch data when page loads
  useEffect(() => {
    fetchAppointments();
    fetchDropdowns();
  }, []);

  const fetchAppointments = async () => {
    const { data } = await supabase
      .from('appointments')
      .select(`*, clients(name), services(name)`)
      .order('appointment_date', { ascending: true });
    setAppointments(data || []);
  };

  const fetchDropdowns = async () => {
    const { data: clientsData } = await supabase.from('clients').select('id, name');
    const { data: servicesData } = await supabase.from('services').select('id, name, duration_minutes');
    setClients(clientsData || []);
    setServices(servicesData || []);
  };

  // Handle booking
  const handleCreate = async (e) => {
    e.preventDefault();
    const selectedService = services.find(s => s.id === newAppt.service_id);
    
    const { error } = await supabase.from('appointments').insert([{
      client_id: newAppt.client_id,
      service_id: newAppt.service_id,
      appointment_date: newAppt.appointment_date,
      staff_name: newAppt.staff_name,
      duration_minutes: selectedService?.duration_minutes || 60,
      status: 'scheduled'
    }]);

    if (!error) {
      alert('Appointment booked successfully!');
      fetchAppointments(); // Refresh the list
      setNewAppt({ client_id: '', service_id: '', appointment_date: '', staff_name: 'Chloe' }); // Reset form
    } else {
      console.error(error);
      alert('Error booking appointment');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen text-gray-900">
      <h1 className="text-3xl font-bold mb-8 text-pink-700">Appointments Schedule</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* LEFT: Booking Form */}
        <div className="bg-white p-6 rounded-lg shadow border border-pink-100">
          <h2 className="text-xl font-bold mb-4 text-pink-700">New Booking</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            
            <select 
              required
              className="w-full p-2 border rounded"
              value={newAppt.client_id}
              onChange={e => setNewAppt({...newAppt, client_id: e.target.value})}
            >
              <option value="">Select Client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <select 
              required
              className="w-full p-2 border rounded"
              value={newAppt.service_id}
              onChange={e => setNewAppt({...newAppt, service_id: e.target.value})}
            >
              <option value="">Select Service</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <input 
              type="datetime-local" 
              required
              className="w-full p-2 border rounded"
              value={newAppt.appointment_date}
              onChange={e => setNewAppt({...newAppt, appointment_date: e.target.value})}
            />

            <input 
              type="text" 
              placeholder="Staff Name"
              className="w-full p-2 border rounded"
              value={newAppt.staff_name}
              onChange={e => setNewAppt({...newAppt, staff_name: e.target.value})}
            />

            <button type="submit" className="w-full bg-pink-600 text-white py-2 rounded font-bold hover:bg-pink-700">
              Book Appointment
            </button>
          </form>
        </div>

        {/* RIGHT: List of Appointments */}
        <div className="md:col-span-2 bg-white p-6 rounded-lg shadow border border-pink-100">
          <h2 className="text-xl font-bold mb-4 text-pink-700">Upcoming Appointments</h2>
          <div className="space-y-3">
            {appointments.length === 0 ? (
              <p className="text-gray-500 text-center mt-10">No upcoming appointments.</p>
            ) : (
              appointments.map(appt => (
                <div key={appt.id} className="flex justify-between items-center p-4 border border-pink-100 rounded-lg hover:bg-pink-50">
                  <div>
                    <p className="font-bold text-lg">{appt.clients?.name || 'Walk-in'}</p>
                    <p className="text-sm text-gray-600">{appt.services?.name} with {appt.staff_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-pink-700">
                      {new Date(appt.appointment_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(appt.appointment_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}