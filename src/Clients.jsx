import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '', notes: '' });

  // Fetch all clients when the page loads
  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    setClients(data || []);
  };

  // Add a new client to the database
  const handleAddClient = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('clients').insert([newClient]);
    
    if (!error) {
      alert('Client added successfully!');
      setNewClient({ name: '', phone: '', email: '', notes: '' }); // Clear the form
      fetchClients(); // Refresh the list
    } else {
      console.error(error);
      alert('Error adding client');
    }
  };

  // Filter the list based on the search bar
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen text-gray-900">
      <h1 className="text-3xl font-bold mb-8 text-pink-700">Client Management</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* LEFT: Add New Client Form */}
        <div className="bg-white p-6 rounded-lg shadow border border-pink-100">
          <h2 className="text-xl font-bold mb-4 text-pink-700">Add New Client</h2>
          <form onSubmit={handleAddClient} className="space-y-4">
            <input 
              type="text" 
              placeholder="Name *" 
              required 
              className="w-full p-2 border rounded"
              value={newClient.name}
              onChange={e => setNewClient({...newClient, name: e.target.value})}
            />
            <input 
              type="text" 
              placeholder="Phone" 
              className="w-full p-2 border rounded"
              value={newClient.phone}
              onChange={e => setNewClient({...newClient, phone: e.target.value})}
            />
            <input 
              type="email" 
              placeholder="Email" 
              className="w-full p-2 border rounded"
              value={newClient.email}
              onChange={e => setNewClient({...newClient, email: e.target.value})}
            />
            <textarea 
              placeholder="Notes" 
              rows="3"
              className="w-full p-2 border rounded"
              value={newClient.notes}
              onChange={e => setNewClient({...newClient, notes: e.target.value})}
            ></textarea>
            
            <button type="submit" className="w-full bg-pink-600 text-white py-2 rounded font-bold hover:bg-pink-700">
              Add Client
            </button>
          </form>
        </div>

        {/* RIGHT: Client List & Search */}
        <div className="md:col-span-2 bg-white p-6 rounded-lg shadow border border-pink-100">
          <h2 className="text-xl font-bold mb-4 text-pink-700">All Clients</h2>
          
          <input 
            type="text" 
            placeholder="Search clients by name..." 
            className="w-full p-2 border rounded mb-4"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {filteredClients.length === 0 ? (
              <p className="text-gray-500 text-center mt-10">No clients found.</p>
            ) : (
              filteredClients.map(client => (
                <div key={client.id} className="flex justify-between items-center p-4 border border-pink-100 rounded-lg hover:bg-pink-50">
                  <div>
                    <p className="font-bold text-lg">{client.name}</p>
                    <p className="text-sm text-gray-600">{client.phone} | {client.email}</p>
                    {client.notes && <p className="text-xs text-gray-400 mt-1">Note: {client.notes}</p>}
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