import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { logAudit, ACTIONS, CATEGORIES } from './utils/auditLogger';

export default function TherapistPanel() {
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('staff'); // 'staff' or 'attendance'
  
  // Staff Form State
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({
    full_name: '', email: '', role: 'therapist', phone: '', is_active: true
  });

  // Attendance State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: staffData } = await supabase.from('profiles').select('*').eq('role', 'therapist').order('full_name');
    const { data: attData } = await supabase.from('attendance').select('*').order('date', { ascending: false }).limit(50);
    
    setStaff(staffData || []);
    setAttendance(attData || []);
    setLoading(false);
  };

  // ✅ STAFF MANAGEMENT
  const handleSaveStaff = async (e) => {
    e.preventDefault();
    
    if (editingStaff) {
      // Update existing staff
      const { error } = await supabase.from('profiles').update(staffForm).eq('id', editingStaff.id);
      
      if (!error) {
        await logAudit({
          action: ACTIONS.STAFF.UPDATED,
          category: CATEGORIES.STAFF,
          entityType: 'staff',
          entityId: editingStaff.id,
          details: { changes: staffForm, previous_name: editingStaff.full_name }
        });
        alert('Staff updated successfully!');
      } else {
        alert('Error updating staff: ' + error.message);
      }
    } else {
      // Add new staff
      const { data: newStaff, error } = await supabase.from('profiles').insert([staffForm]).select().single();
      
      if (!error && newStaff) {
        await logAudit({
          action: ACTIONS.STAFF.ADDED,
          category: CATEGORIES.STAFF,
          entityType: 'staff',
          entityId: newStaff.id,
          details: { name: staffForm.full_name, role: staffForm.role, email: staffForm.email }
        });
        alert('Staff added successfully!');
      } else {
        alert('Error adding staff: ' + error?.message);
      }
    }

    setShowStaffForm(false);
    setEditingStaff(null);
    setStaffForm({ full_name: '', email: '', role: 'therapist', phone: '', is_active: true });
    fetchData();
  };

  const handleEditStaff = (member) => {
    setEditingStaff(member);
    setStaffForm({
      full_name: member.full_name,
      email: member.email || '',
      role: member.role || 'therapist',
      phone: member.phone || '',
      is_active: member.is_active ?? true
    });
    setShowStaffForm(true);
  };

  const handleToggleActive = async (staffId, currentStatus) => {
    const newStatus = !currentStatus;
    const { error } = await supabase.from('profiles').update({ is_active: newStatus }).eq('id', staffId);

    if (!error) {
      const action = newStatus ? ACTIONS.STAFF.REACTIVATED : ACTIONS.STAFF.DEACTIVATED;
      await logAudit({
        action,
        category: CATEGORIES.STAFF,
        entityType: 'staff',
        entityId: staffId,
        details: { new_status: newStatus ? 'Active' : 'Inactive' }
      });
      fetchData();
    } else {
      alert('Failed to update status: ' + error.message);
    }
  };

  // ✅ ATTENDANCE TRACKING
 const handleAttendanceUpdate = async (staffId, status) => {
  const existing = attendance.find(a => a.staff_id === staffId && a.date === selectedDate);
  
  let error;
  if (existing) {
    ({ error } = await supabase.from('attendance').update({ status }).eq('id', existing.id));
  } else {
    ({ error } = await supabase.from('attendance').insert([{ 
      staff_id: staffId, 
      date: selectedDate, 
      status 
    }]));
  }

  if (!error) {
    await logAudit({
      action: ACTIONS.ATTENDANCE.UPDATED,
      category: CATEGORIES.ATTENDANCE,
      entityType: 'attendance',
      entityId: null,
      details: { 
        staff_id: staffId, 
        date: selectedDate, 
        status,
        was_update: !!existing 
      }
    });
    fetchData();
  } else {
    // ✅ FIX: Extract readable error message
    console.error("Attendance update failed:", error);
    alert(`Failed to update attendance: ${error.message || JSON.stringify(error)}`);
  }
};

  const getAttendanceStatus = (staffId) => {
    const record = attendance.find(a => a.staff_id === staffId && a.date === selectedDate);
    return record?.status || 'Not Set';
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-pink-600 dark:text-pink-400">Loading...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0"> {/* ROOT DIV START */}
      
      {/* HEADER & TABS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-pink-800 dark:text-pink-300">Therapist Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage staff profiles and daily attendance</p>
        </div>
        
        <div className="flex bg-white dark:bg-gray-800 rounded-lg p-1 border border-pink-100 dark:border-gray-700">
          <button 
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2 text-sm font-bold rounded-md transition ${
              activeTab === 'staff' ? 'bg-pink-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            👨‍💼 Staff
          </button>
          <button 
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2 text-sm font-bold rounded-md transition ${
              activeTab === 'attendance' ? 'bg-pink-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            📊 Attendance
          </button>
        </div>
      </div>

      {/* STAFF TAB */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button 
              onClick={() => { setEditingStaff(null); setShowStaffForm(true); }}
              className="px-4 py-2 bg-pink-600 text-white rounded-lg font-bold hover:bg-pink-700 transition flex items-center gap-2"
            >
               Add Therapist
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-pink-100 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-pink-50 dark:bg-gray-700/50 text-pink-800 dark:text-pink-300 uppercase text-xs font-bold">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4 w-24">Status</th>
                  <th className="p-4 w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {staff.map(member => (
                  <tr key={member.id} className="hover:bg-pink-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="p-4 font-medium text-gray-800 dark:text-gray-200">{member.full_name}</td>
                    <td className="p-4 capitalize text-gray-600 dark:text-gray-400">{member.role}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">
                      {member.phone && <div>{member.phone}</div>}
                      {member.email && <div className="text-xs opacity-70">{member.email}</div>}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        member.is_active 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 flex gap-2">
                      <button 
                        onClick={() => handleEditStaff(member)}
                        className="px-3 py-1 text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
                      >
                         Edit
                      </button>
                      <button 
                        onClick={() => handleToggleActive(member.id, member.is_active)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                          member.is_active 
                            ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30' 
                            : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30'
                        }`}
                      >
                        {member.is_active ? '🚫 Deactivate' : '♻️ Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ATTENDANCE TAB */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-pink-100 dark:border-gray-700">
            <label className="font-bold text-gray-700 dark:text-gray-300">Select Date:</label>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-pink-100 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-pink-50 dark:bg-gray-700/50 text-pink-800 dark:text-pink-300 uppercase text-xs font-bold">
                <tr>
                  <th className="p-4">Therapist</th>
                  <th className="p-4">Current Status</th>
                  <th className="p-4 w-64">Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {staff.filter(s => s.is_active).map(member => {
                  const currentStatus = getAttendanceStatus(member.id);
                  return (
                    <tr key={member.id} className="hover:bg-pink-50/50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="p-4 font-medium text-gray-800 dark:text-gray-200">{member.full_name}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          currentStatus === 'Present' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                          currentStatus === 'Absent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                          currentStatus === 'Late' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {currentStatus}
                        </span>
                      </td>
                      <td className="p-4">
                        <select 
                          value={currentStatus === 'Not Set' ? '' : currentStatus}
                          onChange={(e) => handleAttendanceUpdate(member.id, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
                        >
                          <option value="">Set Status...</option>
                          <option value="Present">✅ Present</option>
                          <option value="Absent">❌ Absent</option>
                          <option value="Late">⏰ Late</option>
                          <option value="Half-Day">🕐 Half-Day</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STAFF FORM MODAL */}
      {showStaffForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-serif text-pink-800 dark:text-pink-300">
              {editingStaff ? 'Edit Therapist' : 'Add New Therapist'}
            </h3>
            
            <form onSubmit={handleSaveStaff} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Full Name *</label>
                <input required type="text" value={staffForm.full_name} onChange={e => setStaffForm({...staffForm, full_name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Email</label>
                <input type="email" value={staffForm.email} onChange={e => setStaffForm({...staffForm, email: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Phone</label>
                <input type="tel" value={staffForm.phone} onChange={e => setStaffForm({...staffForm, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Role</label>
                <select value={staffForm.role} onChange={e => setStaffForm({...staffForm, role: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                  <option value="therapist">Therapist</option>
                  <option value="senior_therapist">Senior Therapist</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setShowStaffForm(false)} className="flex-1 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">Cancel</button>
                <button type="submit" className="flex-1 py-2 text-sm font-bold text-white bg-pink-600 rounded-lg hover:bg-pink-700 transition">{editingStaff ? 'Update' : 'Add'} Therapist</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div> /* ROOT DIV END */
  );
}