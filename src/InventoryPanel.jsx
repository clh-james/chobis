import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { logAudit, ACTIONS, CATEGORIES } from './utils/auditLogger';

export default function InventoryPanel() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [adjustModal, setAdjustModal] = useState(null); // { id, name, currentStock }
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustType, setAdjustType] = useState('increase');
  const [adjustReason, setAdjustReason] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('name');
    setProducts(data || []);
    setLoading(false);
  };

  const handleStockAdjustment = async () => {
    if (!adjustModal || adjustQty <= 0) return;

    const product = products.find(p => p.id === adjustModal.id);
    if (!product) return;

    const newStock = adjustType === 'increase' 
      ? product.stock_quantity + adjustQty 
      : Math.max(0, product.stock_quantity - adjustQty);

    const { error } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', adjustModal.id);

    if (error) {
      alert('Failed to update stock: ' + error.message);
    } else {
      // ✅ AUDIT LOG: Stock Increased OR Decreased
      const action = adjustType === 'increase' 
        ? ACTIONS.INVENTORY.STOCK_INCREASED 
        : ACTIONS.INVENTORY.STOCK_DECREASED;

      await logAudit({
        action,
        category: CATEGORIES.INVENTORY,
        entityType: 'product',
        entityId: adjustModal.id,
        details: {
          product_name: adjustModal.name,
          previous_stock: product.stock_quantity,
          new_stock: newStock,
          adjustment_quantity: adjustQty,
          reason: adjustReason || 'Manual adjustment'
        }
      });

      alert(`Stock ${adjustType}d successfully!`);
      setAdjustModal(null);
      setAdjustQty(1);
      setAdjustReason('');
      fetchProducts();
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex h-screen items-center justify-center text-pink-600 dark:text-pink-400">Loading Inventory...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-pink-800 dark:text-pink-300">Inventory Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track and manage product stock levels</p>
        </div>
        <input 
          type="text" 
          placeholder="Search products..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 border border-pink-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-pink-400 outline-none w-full md:w-64"
        />
      </div>

      {/* PRODUCTS TABLE */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-pink-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-pink-50 dark:bg-gray-700/50 text-pink-800 dark:text-pink-300 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="p-4">Product Name</th>
                <th className="p-4 w-32">Price</th>
                <th className="p-4 w-32">Stock</th>
                <th className="p-4 w-40">Status</th>
                <th className="p-4 w-40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400 dark:text-gray-500 italic">
                    No products found.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-pink-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="p-4 font-medium text-gray-800 dark:text-gray-200">{product.name}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">₱{product.price?.toLocaleString()}</td>
                    <td className="p-4 font-bold text-gray-800 dark:text-gray-200">{product.stock_quantity}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        product.stock_quantity === 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                        product.stock_quantity < 5 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      }`}>
                        {product.stock_quantity === 0 ? 'Out of Stock' : 
                         product.stock_quantity < 5 ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                    <td className="p-4">
                      <button 
                        onClick={() => setAdjustModal({ id: product.id, name: product.name, currentStock: product.stock_quantity })}
                        className="px-3 py-1.5 text-xs font-bold bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 rounded-lg hover:bg-pink-100 dark:hover:bg-pink-900/30 transition"
                      >
                        Adjust Stock
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* STOCK ADJUSTMENT MODAL */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-serif text-pink-800 dark:text-pink-300">Adjust Stock: {adjustModal.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Current Stock: <span className="font-bold text-gray-800 dark:text-gray-200">{adjustModal.currentStock}</span></p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Adjustment Type</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setAdjustType('increase')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${
                      adjustType === 'increase' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    📦 Increase
                  </button>
                  <button 
                    onClick={() => setAdjustType('decrease')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${
                      adjustType === 'decrease' 
                        ? 'bg-red-600 text-white' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    📉 Decrease
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Quantity</label>
                <input 
                  type="number" 
                  min="1" 
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Reason (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g., New shipment, Spoilage, etc."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setAdjustModal(null)}
                className="flex-1 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleStockAdjustment}
                className={`flex-1 py-2 text-sm font-bold text-white rounded-lg transition ${
                  adjustType === 'increase' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Confirm {adjustType === 'increase' ? 'Restock' : 'Reduce'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}