import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  try {
    // Use the CORRECT environment variable names we set earlier
    const supabaseUrl = Deno.env.get('CHOBIS_SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('CHOBIS_SERVICE_ROLE_KEY') || ''
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Calculate time window: 23-25 hours from now
    const now = new Date()
    const tomorrowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000)
    const tomorrowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000)

    // Fetch appointments in that window
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        staff_name,
        clients (name, email),
        services (name)
      `)
      .gte('appointment_date', tomorrowStart.toISOString())
      .lte('appointment_date', tomorrowEnd.toISOString())
      .eq('status', 'scheduled')

    if (error) throw error

    let sentCount = 0

    for (const appt of appointments) {
      if (!appt.clients?.email) continue

      const apptDate = new Date(appt.appointment_date)
      const formattedDate = apptDate.toLocaleDateString('en-PH', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
      })
      const formattedTime = apptDate.toLocaleTimeString('en-PH', { 
        hour: '2-digit', minute: '2-digit' 
      })

      // Send email via Resend
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Chloe House of Beauty <onboarding@resend.dev>',
          to: [appt.clients.email],
          subject: `Reminder: Your Appointment Tomorrow at ${formattedTime}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #db2777;">Chloe House of Beauty</h2>
              <p>Hi ${appt.clients.name},</p>
              <p>This is a friendly reminder that you have an appointment scheduled for:</p>
              <div style="background: #fce7f3; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Service:</strong> ${appt.services?.name}</p>
                <p><strong>Date:</strong> ${formattedDate}</p>
                <p><strong>Time:</strong> ${formattedTime}</p>
                <p><strong>Staff:</strong> ${appt.staff_name}</p>
              </div>
              <p>If you need to reschedule or cancel, please contact us as soon as possible.</p>
              <p style="color: #6b7280; font-size: 12px;">Gluta Spa & Wellness Center</p>
            </div>
          `,
        }),
      })

      if (res.ok) sentCount++
    }

    return new Response(
      JSON.stringify({ success: true, remindersSent: sentCount }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})