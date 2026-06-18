import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function POS() {
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: servicesData } = await supabase.from('services').select('*');
    const { data: productsData } = await supabase.from('products').select('*');
    setServices(servicesData || []);
    setProducts(productsData || []);
  };

  const addToCart = (item, type) => {
    const existing = cart.find(c => c.id === item.id && c.type === type);
    if (existing) {
      setCart(cart.map(c => 
        c.id === item.id && c.type === type ? { ...c, quantity: c.quantity + 1 } : c
      ));
    } else {
      setCart([...cart, { ...item, type, quantity: 1 }]);
    }
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    // ✅ FIX: Get user ID safely before mapping
    const { data: { user } } = await supabase.auth.getUser();
    const currentStaffId = user?.id;

    // Validate stock
    for (const item of cart) {
      if (item.type === 'product' && item.stock_quantity < item.quantity) {
        alert(`Not enough stock for ${item.name}!`);
        return;
      }
    }

    // Create Sale Record
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([{ total_amount: calculateTotal(), payment_method: 'card' }])
      .select()
      .single();

    if (saleError) {
      console.error("Error creating sale:", saleError);
      return;
    }

    // ✅ FIX: Use variable instead of await inside map
    const saleItems = cart.map(item => ({
      sale_id: sale.id,
      item_type: item.type,
      item_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
      staff_id: currentStaffId 
    }));

    await supabase.from('sale_items').insert(saleItems);

    // Update Inventory
    for (const item of cart) {
      if (item.type === 'product') {
        const newStock = item.stock_quantity - item.quantity;
        await supabase
          .from('products')
          .update({ stock_quantity: newStock })
          .eq('id', item.id);
      }
    }

    setCart([]);
    alert('Checkout successful! Inventory updated.');
    fetchData();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
      {/* LOGO HEADER */}
      <div className="bg-white shadow-sm p-4 flex justify-center border-b border-pink-100">
        <img src="/logo.png" alt="Chloe House of Beauty" className="h-16" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDE: Catalog */}
        <div className="w-full md:w-2/3 p-6 overflow-y-auto">
          <h2 className="text-2xl font-bold mb-4 text-pink-700">Services</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {services.map(s => (
              <button key={s.id} onClick={() => addToCart(s, 'service')} className="p-4 bg-white rounded-lg shadow border border-pink-100 hover:bg-pink-50 text-left transition-all active:scale-95">
                <h3 className="font-semibold">{s.name}</h3>
                <p className="text-pink-600 font-bold">₱{s.price}</p>
                <p className="text-xs text-gray-500">{s.duration_minutes} mins</p>
              </button>
            ))}
          </div>

          <h2 className="text-2xl font-bold mb-4 text-pink-700">Products</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {products.map(p => (
              <button key={p.id} onClick={() => addToCart(p, 'product')} className="p-4 bg-white rounded-lg shadow border border-pink-100 hover:bg-pink-50 text-left transition-all active:scale-95">
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-pink-600 font-bold">₱{p.price}</p>
                <p className="text-xs text-gray-500">Stock: {p.stock_quantity}</p>
              </button>
            ))}
          </div>
        </div>
        
        {/* RIGHT SIDE: Cart (Hidden on mobile, shown as bottom sheet or separate view in real app) */}
        <div className="hidden md:flex w-1/3 bg-white p-6 shadow-lg flex-col border-l border-pink-100">
          <h2 className="text-2xl font-bold mb-4 text-pink-700">Current Sale</h2>
          <div className="flex-1 overflow-y-auto mb-4 space-y-3">
            {cart.length === 0 ? (
              <p className="text-gray-400 text-center mt-10 italic">Cart is empty</p>
            ) : (
              cart.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-bold text-sm">₱{(item.price * item.quantity).toFixed(2)}</p>
                </div>
              ))
            )}
          </div>
          
          <div className="border-t border-pink-200 pt-4 mt-auto">
            <div className="flex justify-between text-xl font-bold mb-4">
              <span>Total:</span>
              <span className="text-pink-700">₱{calculateTotal()}</span>
            </div>
            <button 
              onClick={handleCheckout} 
              disabled={cart.length === 0}
              className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              Process Payment
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Cart Summary (Visible only on small screens) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-pink-100 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40">
         <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-lg">Total:</span>
            <span className="text-xl font-bold text-pink-700">₱{calculateTotal()}</span>
         </div>
         <button 
            onClick={handleCheckout} 
            disabled={cart.length === 0}
            className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold disabled:bg-gray-300"
          >
            Checkout ({cart.length} items)
          </button>
      </div>
    </div>
  );
}