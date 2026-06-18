import React, { useState, useEffect } from 'react';
import { supabase, getCurrentUserRole } from './supabaseClient';

export default function TherapistPanel() {
  const [appointments, setAppointments] = useState([]);
  const [staffName, setStaffName] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadTherapistData();
  }, [selectedDate]);

  const loadTherapistData = async () => {
    setLoading(true);
    const profile = await getCurrentUserRole();
    if (!profile) return;

    setStaffName(profile.full_name);

    // Get appointments for selected date assigned to this therapist
    const startOfDay = `${selectedDate}T00:00:00`;
    const endOfDay = `${selectedDate}T23:59:59`;

    const { data, error } = await supabase
      .from('appointments')
      .select(`*, clients(name, phone, email), services(name, price, duration_minutes)`)
      .eq('staff_name', profile.full_name)
      .gte('appointment_date', startOfDay)
      .lte('appointment_date', endOfDay)
      .order('appointment_date', { ascending: true });

    if (error) console.error('Error loading appointments:', error);
    setAppointments(data || []);
    setLoading(false);
  };

  const updateStatus = async (id, newStatus) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      loadTherapistData(); // Refresh list after update
    } else {
      alert('Failed to update status: ' + error.message);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'checked_in': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-pink-600 font-serif text-xl">Loading your schedule...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-pink-100 p-6">
        <h1 className="text-2xl font-serif text-pink-800 mb-1">Welcome, {staffName}</h1>
        <p className="text-gray-500 text-sm">Your appointment schedule</p>
      </div>

      {/* Date Selector */}
      <div className="flex items-center gap-4 bg-white rounded-xl shadow-sm border border-pink-100 p-4">
        <label className="font-medium text-gray-700 whitespace-nowrap">Select Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
        />
        <button
          onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
          className="ml-auto px-4 py-2 text-sm text-pink-600 hover:bg-pink-50 rounded-lg font-medium"
        >
          Today
        </button>
      </div>

      {/* Appointments List */}
      {appointments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-pink-100 p-12 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-400 italic text-lg">No appointments scheduled for this date.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((appt) => (
            <div
              key={appt.id}
              className="bg-white rounded-xl shadow-sm border border-pink-50 p-5 hover:border-pink-200 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                {/* Client Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-lg text-gray-800">{appt.clients?.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(appt.status)}`}>
                      {appt.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-pink-700 font-semibold text-base mb-1">
                    {appt.services?.name} • ₱{appt.services?.price?.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500">
                    Duration: {appt.services?.duration_minutes} mins
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                    {appt.clients?.phone && <span> {appt.clients.phone}</span>}
                    {appt.clients?.email && <span>✉️ {appt.clients.email}</span>}
                  </div>
                </div>

                {/* Time & Actions */}
                <div className="flex flex-col items-end gap-3 min-w-[180px]">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-pink-700">
                      {new Date(appt.appointment_date).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(appt.appointment_date).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 w-full">
                    {appt.status === 'scheduled' && (
                      <button
                        onClick={() => updateStatus(appt.id, 'checked_in')}
                        className="w-full px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-semibold hover:bg-yellow-600 transition"
                      >
                        ✓ Check In
                      </button>
                    )}
                    {appt.status === 'checked_in' && (
                      <button
                        onClick={() => updateStatus(appt.id, 'completed')}
                        className="w-full px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition"
                      >
                        ✓ Mark Complete
                      </button>
                    )}
                    {appt.status === 'completed' && (
                      <div className="w-full px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-semibold text-center border border-green-200">
                        ✓ Completed
                      </div>
                    )}
                    {(appt.status === 'scheduled' || appt.status === 'checked_in') && (
                      <button
                        onClick={() => {
                          if (confirm('Cancel this appointment?')) {
                            updateStatus(appt.id, 'cancelled');
                          }
                        }}
                        className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition border border-red-200"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {appointments.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', count: appointments.length, color: 'bg-pink-50 text-pink-700' },
            { label: 'Scheduled', count: appointments.filter(a => a.status === 'scheduled').length, color: 'bg-blue-50 text-blue-700' },
            { label: 'Checked In', count: appointments.filter(a => a.status === 'checked_in').length, color: 'bg-yellow-50 text-yellow-700' },
            { label: 'Completed', count: appointments.filter(a => a.status === 'completed').length, color: 'bg-green-50 text-green-700' },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.color} rounded-xl p-4 text-center`}>
              <p className="text-2xl font-bold">{stat.count}</p>
              <p className="text-xs font-medium uppercase tracking-wide">{stat.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}