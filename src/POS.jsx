import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { logAudit, ACTIONS, CATEGORIES } from './utils/auditLogger';

export default function POS() {
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMobileCart, setShowMobileCart] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: servicesData } = await supabase.from('services').select('*').order('name');
    const { data: productsData } = await supabase.from('products').select('*').order('name');
    
    setServices(servicesData || []);
    setProducts(productsData || []);
    setLoading(false);
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

  const removeFromCart = (index) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const clearCart = () => {
    if (window.confirm("Are you sure you want to clear all items from the cart?")) {
      setCart([]);
      setShowMobileCart(false);
    }
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    const currentStaffId = user?.id;

    // Validate stock
    for (const item of cart) {
      if (item.type === 'product' && item.stock_quantity < item.quantity) {
        alert(`Not enough stock for ${item.name}!`);
        return;
      }
    }

    try {
      // 1. Create Sale Record
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([{ total_amount: calculateTotal(), payment_method: 'card' }])
        .select()
        .single();

      if (saleError) throw saleError;

      // ✅ AUDIT LOG: Payment Processed
      await logAudit({
        action: ACTIONS.POS.PAYMENT_PROCESSED,
        category: CATEGORIES.POS,
        entityType: 'sale',
        entityId: sale.id,
        details: {
          total_amount: calculateTotal(),
          items_count: cart.length,
          payment_method: 'card',
          staff_id: currentStaffId,
          items: cart.map(i => ({ name: i.name, qty: i.quantity, price: i.price }))
        }
      });

      // 2. Insert sale items
      const saleItems = cart.map(item => ({
        sale_id: sale.id,
        item_type: item.type,
        item_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        staff_id: currentStaffId 
      }));

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
      if (itemsError) throw itemsError;

      // 3. Update Inventory & Log Stock Changes
      for (const item of cart) {
        if (item.type === 'product') {
          const newStock = item.stock_quantity - item.quantity;
          
          await supabase
            .from('products')
            .update({ stock_quantity: newStock })
            .eq('id', item.id);

          // ✅ AUDIT LOG: Stock Decreased
          await logAudit({
            action: ACTIONS.INVENTORY.STOCK_DECREASED,
            category: CATEGORIES.INVENTORY,
            entityType: 'product',
            entityId: item.id,
            details: {
              product_name: item.name,
              previous_stock: item.stock_quantity,
              new_stock: newStock,
              quantity_sold: item.quantity,
              sale_id: sale.id
            }
          });
        }
      }

      setCart([]);
      setShowMobileCart(false);
      alert('Checkout successful! Inventory updated.');
      fetchData();

    } catch (err) {
      console.error("Checkout failed:", err);
      alert("Transaction failed. Please try again.");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen text-pink-600 dark:text-pink-400">Loading POS...</div>;

  return (
    <div className="flex flex-col h-screen bg-[#fdf8f6] dark:bg-gray-900 overflow-hidden relative transition-colors duration-300">
      
      {/* HEADER */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-pink-100 dark:border-gray-700 p-4 shrink-0 z-20 flex justify-between items-center transition-colors duration-300">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
          <h1 className="text-lg font-serif text-pink-800 dark:text-pink-300 font-bold">Point of Sale</h1>
        </div>
        
        <button 
          onClick={() => setShowMobileCart(!showMobileCart)}
          className="md:hidden relative p-2 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-gray-700 rounded-lg transition"
        >
          <span className="text-xl">🛒</span>
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-800">
              {cart.length}
            </span>
          )}
        </button>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* LEFT SIDE: CATALOG */}
        <div className={`flex-1 overflow-y-auto p-4 pb-32 md:pb-4 transition-all duration-300 ${showMobileCart ? 'hidden md:block' : 'block'}`}>
          
          {['Packages', 'Massage', 'Facials', 'Laser', 'Body Contouring', 'Brows & Lashes', 'Nails', 'RF Treatment', 'PRP', 'IV Therapy', 'Waxing', 'Sculpting', 'Specialty', 'Semi-Permanent Makeup', 'Aesthetics', 'Botox'].map((category) => {
            const categoryServices = services.filter(s => s.category === category);
            if (categoryServices.length === 0) return null;

            return (
              <div key={category} className="mb-8">
                <h2 className="text-sm font-bold text-pink-800 dark:text-pink-300 uppercase tracking-wider mb-3 sticky top-0 bg-[#fdf8f6] dark:bg-gray-900 py-2 z-10 border-b border-pink-100 dark:border-gray-700">
                  {category}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {categoryServices.map(s => (
                    <button 
                      key={s.id} 
                      onClick={() => addToCart(s, 'service')} 
                      className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-pink-100 dark:border-gray-700 hover:border-pink-400 dark:hover:border-pink-500 hover:shadow-md text-left transition-all active:scale-95 group h-full flex flex-col justify-between"
                    >
                      <div>
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-xs leading-tight mb-2 line-clamp-2">{s.name}</h3>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-50 dark:border-gray-700">
                        <p className="text-pink-600 dark:text-pink-400 font-bold text-sm">₱{s.price.toLocaleString()}</p>
                        {s.duration_minutes && (
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{s.duration_minutes} mins</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT SIDE: CART (Desktop Sidebar) */}
        <aside className="hidden md:flex w-96 bg-white dark:bg-gray-800 border-l border-pink-100 dark:border-gray-700 shadow-xl flex-col shrink-0 z-10 transition-colors duration-300">
          <div className="p-5 border-b border-pink-50 dark:border-gray-700 bg-pink-50/30 dark:bg-gray-700/30 flex justify-between items-center">
            <h2 className="text-lg font-serif text-pink-800 dark:text-pink-300 font-bold">Current Order</h2>
            <span className="text-xs font-bold bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 px-2 py-1 rounded-full">{cart.length} Items</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500">
                <span className="text-4xl mb-3 opacity-30">🛒</span>
                <p className="text-sm font-medium">Your cart is empty</p>
                <p className="text-xs mt-1">Select services or products to begin</p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div key={index} className="flex justify-between items-start p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600 group hover:border-pink-200 dark:hover:border-pink-700 transition-colors">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Qty: {item.quantity} × ₱{item.price}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="font-bold text-sm text-pink-700 dark:text-pink-300">{(item.price * item.quantity).toFixed(2)}</p>
                    <button 
                      onClick={() => removeFromCart(index)}
                      className="text-[10px] text-red-400 hover:text-red-600 dark:hover:text-red-300 font-medium px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="p-6 border-t border-pink-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] transition-colors duration-300">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Total Amount</span>
              <span className="text-3xl font-bold text-pink-700 dark:text-pink-300">₱{calculateTotal()}</span>
            </div>
            
            {cart.length > 0 && (
              <button 
                onClick={clearCart}
                className="w-full mb-3 py-2 text-sm text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 font-medium transition-colors"
              >
                Clear All Items
              </button>
            )}

            <button 
              onClick={handleCheckout} 
              disabled={cart.length === 0}
              className="w-full bg-gradient-to-r from-pink-600 to-rose-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
            >
              Process Payment
            </button>
          </div>
        </aside>
      </div>

      {/* MOBILE STICKY CHECKOUT BAR */}
      {!showMobileCart && cart.length > 0 && (
        <div className="md:hidden fixed bottom-[70px] left-0 right-0 bg-white dark:bg-gray-800 border-t border-pink-100 dark:border-gray-700 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] z-30 p-4 pb-6 transition-colors duration-300">
          <div className="flex justify-between items-center max-w-md mx-auto">
            <div onClick={() => setShowMobileCart(true)} className="cursor-pointer active:opacity-80 flex-1">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">{cart.length} Items Selected</p>
              <p className="text-xl font-bold text-pink-700 dark:text-pink-300">₱{calculateTotal()}</p>
            </div>
            <button 
              onClick={handleCheckout} 
              disabled={cart.length === 0}
              className="bg-gradient-to-r from-pink-600 to-rose-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:shadow-lg active:scale-95 transition-all disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 ml-4"
            >
              Checkout
            </button>
          </div>
        </div>
      )}

      {/* MOBILE CART OVERLAY */}
      {showMobileCart && (
        <div className="md:hidden fixed inset-0 bg-[#fdf8f6] dark:bg-gray-900 z-40 flex flex-col animate-in slide-in-from-bottom duration-300 transition-colors duration-300">
          <div className="p-4 border-b border-pink-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between items-center shadow-sm">
            <h2 className="text-lg font-serif text-pink-800 dark:text-pink-300 font-bold">Your Cart</h2>
            <div className="flex gap-2">
              {cart.length > 0 && (
                <button 
                  onClick={clearCart}
                  className="text-xs text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 font-medium"
                >
                  Clear All
                </button>
              )}
              <button onClick={() => setShowMobileCart(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 p-2">
                ✕ Close
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500">
                <span className="text-5xl mb-4 opacity-30">🛍️</span>
                <p className="font-medium">Cart is empty</p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-pink-50 dark:border-gray-700">
                  <div>
                    <p className="font-bold text-gray-800 dark:text-gray-200">{item.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Qty: {item.quantity} × ₱{item.price}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="font-bold text-pink-700 dark:text-pink-300">₱{(item.price * item.quantity).toFixed(2)}</p>
                    <button 
                      onClick={() => removeFromCart(index)}
                      className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-lg font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-6 bg-white dark:bg-gray-800 border-t border-pink-100 dark:border-gray-700 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] transition-colors duration-300">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Total Amount</span>
              <span className="text-3xl font-bold text-pink-700 dark:text-pink-300">₱{calculateTotal()}</span>
            </div>
            <button 
              onClick={handleCheckout} 
              disabled={cart.length === 0}
              className="w-full bg-gradient-to-r from-pink-600 to-rose-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg active:scale-[0.98] transition-all disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400"
            >
              Confirm Payment
            </button>
          </div>
        </div>
      )}

    </div>
  );
}