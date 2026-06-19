import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      setError(error.message);
    } else {
      onLoginSuccess();
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#fdf8f6] overflow-hidden p-4">
      
      {/* BACKGROUND LOGO WATERMARK */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 opacity-[0.03]">
        <img 
          src="/logo.png" 
          alt="" 
          className="w-[90vw] max-w-[600px] grayscale" 
        />
      </div>

      {/* LOGIN CARD */}
      <div className="relative z-10 bg-white rounded-2xl shadow-lg w-full max-w-md border border-gray-100 mx-auto py-8 px-8">
        
        {/* ✅ WIDER HORIZONTAL LOGO */}
        <div className="flex justify-center mb-1">
          <img 
            src="/logo.png" 
            alt="Chloe House of Beauty" 
            className="w-64 sm:w-72 object-contain" 
          />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-serif text-center text-[#b91c5c] mb-1">Staff Login</h2>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-1 text-sm border border-red-100 text-center">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-3">
          {/* Email Input */}
          <input
            type="email"
            placeholder="Email Address"
            required
            className="w-full p-4 bg-[#eef2ff] border border-transparent rounded-lg focus:ring-2 focus:ring-pink-400 focus:bg-white outline-none transition-all text-gray-700 placeholder-gray-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          
          {/* Password Input */}
          <input
            type="password"
            placeholder="Password"
            required
            className="w-full p-4 bg-[#eef2ff] border border-transparent rounded-lg focus:ring-2 focus:ring-pink-400 focus:bg-white outline-none transition-all text-gray-700 placeholder-gray-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#e11d5f] hover:bg-[#be123c] text-white py-4 rounded-lg font-bold text-lg transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2026 Chloe House of Beauty
        </p>
      </div>
    </div>
  );
}