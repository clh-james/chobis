import { supabase } from '../supabaseClient';

/**
 * Logs an audit event to Supabase and local storage.
 * @param {Object} params - The audit log parameters
 * @param {string} params.action - The action type (e.g., 'LOGIN', 'APPOINTMENT_CREATED')
 * @param {string} params.category - The category (e.g., 'AUTH', 'APPOINTMENTS')
 * @param {string} [params.entityType] - The entity type (e.g., 'appointment', 'client')
 * @param {string|UUID} [params.entityId] - The specific entity ID
 * @param {Object} [params.details={}] - Additional context/data about the action
 */
export const logAudit = async ({ 
  action, 
  category, 
  entityType = null, 
  entityId = null, 
  details = {} 
}) => {
  try {
    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Don't log if no user is authenticated

    // 2. Get user profile for name/role
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single();

    // 3. Prepare the log entry
    const entry = {
      user_id: user.id,
      user_name: profile?.full_name || 'Unknown User',
      user_role: profile?.role || 'unknown',
      action: action,
      category: category,
      entity_type: entityType,
      entity_id: entityId,
      details: details,
      ip_address: null, // Optional: Add IP tracking later via Edge Function
      user_agent: typeof window !== 'undefined' ? navigator.userAgent : 'server'
    };

    // 4. Insert into Supabase Database
    // Note: If RLS blocks this, check your policies. 
    // The SQL provided earlier includes a policy allowing inserts.
    await supabase.from('audit_log').insert([entry]);
    
    // 5. Fallback: Store in localStorage for offline/session viewing
    // This ensures logs aren't lost if the DB insert fails or network is down
    try {
      const sessionLogs = JSON.parse(localStorage.getItem('chobis-audit-logs') || '[]');
      sessionLogs.push({ ...entry, created_at: new Date().toISOString() });
      
      // Keep only the last 500 logs to prevent storage overflow
      localStorage.setItem('chobis-audit-logs', JSON.stringify(sessionLogs.slice(-500)));
    } catch (localErr) {
      console.warn('Failed to save audit log to localStorage:', localErr);
    }
    
  } catch (err) {
    // Log error but don't break the user's flow
    console.error('Audit logging failed:', err);
  }
};

// ==========================================
// PREDEFINED ACTION CONSTANTS
// Use these to ensure consistent naming across the app
// ==========================================
export const ACTIONS = {
  AUTH: {
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT'
  },
  APPOINTMENTS: {
    CREATED: 'APPOINTMENT_CREATED',
    STATUS_CHANGED: 'APPOINTMENT_STATUS_CHANGED',
    COMPLETED: 'APPOINTMENT_COMPLETED',
    CANCELLED: 'APPOINTMENT_CANCELLED'
  },
  CLIENTS: {
    ADDED: 'CLIENT_ADDED',
    UPDATED: 'CLIENT_UPDATED',
    DELETED: 'CLIENT_DELETED'
  },
  POS: {
    PAYMENT_PROCESSED: 'PAYMENT_PROCESSED',
    REFUND_ISSUED: 'REFUND_ISSUED'
  },
  INVENTORY: {
    STOCK_INCREASED: 'STOCK_INCREASED',
    STOCK_DECREASED: 'STOCK_DECREASED',
    PRODUCT_ADDED: 'PRODUCT_ADDED',
    PRODUCT_UPDATED: 'PRODUCT_UPDATED'
  },
  STAFF: {
    ADDED: 'STAFF_ADDED',
    UPDATED: 'STAFF_UPDATED',
    DEACTIVATED: 'STAFF_DEACTIVATED',
    REACTIVATED: 'STAFF_REACTIVATED',
    DELETED: 'STAFF_DELETED'
  },
  ATTENDANCE: {
    UPDATED: 'ATTENDANCE_UPDATED'
  }
};

// ==========================================
// CATEGORY CONSTANTS
// Used for filtering and color-coding in the UI
// ==========================================
export const CATEGORIES = {
  AUTH: 'AUTH',
  APPOINTMENTS: 'APPOINTMENTS',
  CLIENTS: 'CLIENTS',
  POS: 'POS',
  INVENTORY: 'INVENTORY',
  STAFF: 'STAFF',
  ATTENDANCE: 'ATTENDANCE'
};