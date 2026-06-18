import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      onLoginSuccess();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdf8f6]">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border border-pink-100">
        <img src="/logo.png" alt="Chloe House of Beauty" className="h-16 mx-auto mb-6" />
        <h2 className="text-2xl font-serif text-center text-pink-800 mb-6">Staff Login</h2>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            required
            className="w-full p-3 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            required
            className="w-full p-3 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-pink-600 to-rose-600 text-white py-3 rounded-lg font-bold hover:opacity-90 transition"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}