import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function InventoryPanel() {
  const [activeTab, setActiveTab] = useState('stock'); // stock, receive, suppliers
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form States
  const [newSupplier, setNewSupplier] = useState({ name: '', contact_person: '', phone: '', email: '' });
  const [receiveForm, setReceiveForm] = useState({ product_id: '', quantity: '', supplier_id: '', cost_price: '', notes: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: prodData } = await supabase.from('products').select('*, suppliers(name)').order('name');
    const { data: suppData } = await supabase.from('suppliers').select('*').order('name');
    
    setProducts(prodData || []);
    setSuppliers(suppData || []);
    setLoading(false);
  };

  // Handle Adding Supplier
  const handleAddSupplier = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('suppliers').insert([newSupplier]);
    if (!error) {
      alert('Supplier added!');
      setNewSupplier({ name: '', contact_person: '', phone: '', email: '' });
      fetchData();
    } else alert(error.message);
  };

  // Handle Receiving Stock
  const handleReceiveStock = async (e) => {
    e.preventDefault();
    const qty = parseInt(receiveForm.quantity);
    if (!qty || qty <= 0) return alert('Invalid quantity');

    // 1. Update Product Stock & Cost Price
    const { error: updateError } = await supabase
      .from('products')
      .update({ 
        stock_quantity: products.find(p => p.id === receiveForm.product_id).stock_quantity + qty,
        cost_price: parseFloat(receiveForm.cost_price) || 0 
      })
      .eq('id', receiveForm.product_id);

    if (updateError) return alert(updateError.message);

    // 2. Log the Movement
    await supabase.from('stock_movements').insert([{
      product_id: receiveForm.product_id,
      movement_type: 'in',
      quantity: qty,
      notes: receiveForm.notes || `Received from ${suppliers.find(s => s.id === receiveForm.supplier_id)?.name}`,
      created_by: (await supabase.auth.getUser()).data.user?.id
    }]);

    alert('Stock received successfully!');
    setReceiveForm({ product_id: '', quantity: '', supplier_id: '', cost_price: '', notes: '' });
    fetchData();
  };

  if (loading) return <div className="p-8 text-center text-pink-600">Loading Inventory...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-pink-100">
        <h1 className="text-2xl font-serif text-pink-800">Inventory Management</h1>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          {['stock', 'receive', 'suppliers'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${
                activeTab === tab ? 'bg-white text-pink-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'receive' ? 'Receive Stock' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: STOCK LEVELS */}
      {activeTab === 'stock' && (
        <div className="bg-white rounded-xl shadow-sm border border-pink-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-pink-50 text-pink-800">
              <tr>
                <th className="p-4 font-semibold">Product</th>
                <th className="p-4 font-semibold">SKU</th>
                <th className="p-4 font-semibold">Stock</th>
                <th className="p-4 font-semibold">Sell Price</th>
                <th className="p-4 font-semibold">Cost Price</th>
                <th className="p-4 font-semibold">Supplier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-50">
              {products.map(p => (
                <tr key={p.id} className={`hover:bg-pink-50/30 ${p.stock_quantity < 5 ? 'bg-red-50' : ''}`}>
                  <td className="p-4 font-medium">{p.name}</td>
                  <td className="p-4 text-gray-500 text-sm">{p.sku || '-'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      p.stock_quantity < 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {p.stock_quantity}
                    </span>
                  </td>
                  <td className="p-4">₱{p.price?.toFixed(2)}</td>
                  <td className="p-4 text-gray-500">₱{p.cost_price?.toFixed(2)}</td>
                  <td className="p-4 text-sm text-gray-500">{p.suppliers?.name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: RECEIVE STOCK */}
      {activeTab === 'receive' && (
        <div className="bg-white rounded-xl shadow-sm border border-pink-100 p-6 max-w-2xl">
          <h2 className="text-xl font-serif text-pink-800 mb-6">Log New Stock Arrival</h2>
          <form onSubmit={handleReceiveStock} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <select required className="w-full p-3 border border-pink-200 rounded-lg" 
                  value={receiveForm.product_id} onChange={e => setReceiveForm({...receiveForm, product_id: e.target.value})}>
                  <option value="">Select Product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Current: {p.stock_quantity})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Received</label>
                <input type="number" min="1" required className="w-full p-3 border border-pink-200 rounded-lg"
                  value={receiveForm.quantity} onChange={e => setReceiveForm({...receiveForm, quantity: e.target.value})} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <select className="w-full p-3 border border-pink-200 rounded-lg"
                  value={receiveForm.supplier_id} onChange={e => setReceiveForm({...receiveForm, supplier_id: e.target.value})}>
                  <option value="">Select Supplier (Optional)</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost Price (₱)</label>
                <input type="number" step="0.01" className="w-full p-3 border border-pink-200 rounded-lg"
                  value={receiveForm.cost_price} onChange={e => setReceiveForm({...receiveForm, cost_price: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Batch #</label>
              <textarea rows="2" className="w-full p-3 border border-pink-200 rounded-lg"
                value={receiveForm.notes} onChange={e => setReceiveForm({...receiveForm, notes: e.target.value})}></textarea>
            </div>

            <button type="submit" className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition">
              Update Inventory
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: SUPPLIERS */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Supplier Form */}
          <div className="bg-white rounded-xl shadow-sm border border-pink-100 p-6 h-fit">
            <h2 className="text-xl font-serif text-pink-800 mb-4">Add New Supplier</h2>
            <form onSubmit={handleAddSupplier} className="space-y-3">
              <input placeholder="Company Name *" required className="w-full p-3 border border-pink-200 rounded-lg"
                value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} />
              <input placeholder="Contact Person" className="w-full p-3 border border-pink-200 rounded-lg"
                value={newSupplier.contact_person} onChange={e => setNewSupplier({...newSupplier, contact_person: e.target.value})} />
              <input placeholder="Phone Number" className="w-full p-3 border border-pink-200 rounded-lg"
                value={newSupplier.phone} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} />
              <input placeholder="Email Address" type="email" className="w-full p-3 border border-pink-200 rounded-lg"
                value={newSupplier.email} onChange={e => setNewSupplier({...newSupplier, email: e.target.value})} />
              <button type="submit" className="w-full bg-pink-600 text-white py-2 rounded-lg font-bold hover:bg-pink-700">Save Supplier</button>
            </form>
          </div>

          {/* Supplier List */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-pink-100 p-6">
            <h2 className="text-xl font-serif text-pink-800 mb-4">Supplier Directory</h2>
            <div className="space-y-3">
              {suppliers.length === 0 ? <p className="text-gray-400 italic">No suppliers added yet.</p> : 
                suppliers.map(s => (
                  <div key={s.id} className="flex justify-between items-center p-4 border border-pink-50 rounded-lg hover:border-pink-200">
                    <div>
                      <p className="font-bold text-gray-800">{s.name}</p>
                      <p className="text-sm text-gray-500">{s.contact_person} • {s.phone}</p>
                    </div>
                    <a href={`mailto:${s.email}`} className="text-pink-600 text-sm font-medium hover:underline">Email</a>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}