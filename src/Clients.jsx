import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { logAudit, ACTIONS, CATEGORIES } from './utils/auditLogger';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', address: '', notes: ''
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    const { data } = await supabase.from('clients').select('*').order('name');
    setClients(data || []);
    setLoading(false);
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    
    if (editingClient) {
      // ✅ UPDATE EXISTING CLIENT
      const { error } = await supabase
        .from('clients')
        .update(formData)
        .eq('id', editingClient.id);

      if (!error) {
        await logAudit({
          action: ACTIONS.CLIENTS.UPDATED,
          category: CATEGORIES.CLIENTS,
          entityType: 'client',
          entityId: editingClient.id,
          details: { 
            changes: formData,
            previous_name: editingClient.name 
          }
        });
        alert('Client updated successfully!');
      } else {
        alert('Error updating client: ' + error.message);
      }
    } else {
      // ✅ ADD NEW CLIENT
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert([formData])
        .select()
        .single();

      if (!error && newClient) {
        await logAudit({
          action: ACTIONS.CLIENTS.ADDED,
          category: CATEGORIES.CLIENTS,
          entityType: 'client',
          entityId: newClient.id,
          details: { 
            name: formData.name, 
            phone: formData.phone, 
            email: formData.email 
          }
        });
        alert('Client added successfully!');
      } else {
        alert('Error adding client: ' + error?.message);
      }
    }

    setShowForm(false);
    setEditingClient(null);
    setFormData({ name: '', phone: '', email: '', address: '', notes: '' });
    fetchClients();
  };

  const handleEditClient = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || '',
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      notes: client.notes || ''
    });
    setShowForm(true);
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex h-screen items-center justify-center text-pink-600 dark:text-pink-400">Loading Clients...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-pink-800 dark:text-pink-300">Client Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage client profiles and contact information</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Search clients..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 md:w-64 px-4 py-2 border border-pink-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-pink-400 outline-none"
          />
          <button 
            onClick={() => { setEditingClient(null); setShowForm(true); }}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg font-bold hover:bg-pink-700 transition whitespace-nowrap"
          >
             Add Client
          </button>
        </div>
      </div>

      {/* CLIENTS TABLE */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-pink-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-pink-50 dark:bg-gray-700/50 text-pink-800 dark:text-pink-300 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Contact</th>
                <th className="p-4 hidden md:table-cell">Address</th>
                <th className="p-4 w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-400 dark:text-gray-500 italic">
                    No clients found. Add your first client above!
                  </td>
                </tr>
              ) : (
                filteredClients.map(client => (
                  <tr key={client.id} className="hover:bg-pink-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-gray-800 dark:text-gray-200">{client.name}</div>
                      {client.notes && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{client.notes}</div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-gray-600 dark:text-gray-400">{client.phone || '-'}</div>
                      {client.email && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{client.email}</div>
                      )}
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400 hidden md:table-cell truncate max-w-[200px]">
                      {client.address || '-'}
                    </td>
                    <td className="p-4">
                      <button 
                        onClick={() => handleEditClient(client)}
                        className="px-3 py-1.5 text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
                      >
                         Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CLIENT FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-serif text-pink-800 dark:text-pink-300">
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </h3>
            
            <form onSubmit={handleSaveClient} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Full Name *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Phone Number</label>
                <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Address</label>
                <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Notes</label>
                <textarea rows="2" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 resize-none" />
              </div>

              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">Cancel</button>
                <button type="submit" className="flex-1 py-2 text-sm font-bold text-white bg-pink-600 rounded-lg hover:bg-pink-700 transition">{editingClient ? 'Update' : 'Add'} Client</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}