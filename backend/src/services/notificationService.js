const nodemailer = require('nodemailer');

// Create reusable transporter
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send email notification for a critical defect alert
 * @param {object} alert - Alert record from DB
 */
async function sendEmailNotification(alert) {
  const supervisorEmail = process.env.SUPERVISOR_EMAIL;
  if (!supervisorEmail) {
    console.warn('[Notifications] SUPERVISOR_EMAIL not set, skipping email.');
    return;
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_USER || 'noreply@assemblyinspector.local',
      to: supervisorEmail,
      subject: `[CRITICAL ALERT] ${alert.title}`,
      html: `
        <h2 style="color:red;">Critical Defect Alert</h2>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:4px 8px;font-weight:bold;">Alert ID</td><td>${alert.id}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:bold;">Title</td><td>${alert.title}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:bold;">Type</td><td>${alert.type || 'N/A'}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:bold;">Severity</td><td style="color:red;font-weight:bold;">CRITICAL</td></tr>
          <tr><td style="padding:4px 8px;font-weight:bold;">Production Line</td><td>${alert.production_line_name || alert.production_line_id || 'N/A'}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:bold;">Message</td><td>${alert.message || ''}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:bold;">Timestamp</td><td>${alert.created_at || new Date().toISOString()}</td></tr>
        </table>
        <p>Please review and take immediate action.</p>
      `,
    });
    console.log(`[Notifications] Critical alert email sent to ${supervisorEmail} for alert ${alert.id}`);
  } catch (err) {
    console.error('[Notifications] Failed to send email:', err.message);
  }
}

/**
 * Send SMS notification for a critical defect alert
 * Uses Twilio if credentials are configured, otherwise logs.
 * @param {object} alert - Alert record from DB
 */
async function sendSMSNotification(alert) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const toNumber = process.env.SUPERVISOR_PHONE;

  const messageBody = `[CRITICAL] Assembly Line Alert: ${alert.title}. Line: ${alert.production_line_name || alert.production_line_id || 'Unknown'}. Time: ${new Date().toISOString()}`;

  if (accountSid && authToken && fromNumber && toNumber) {
    try {
      const twilio = require('twilio')(accountSid, authToken);
      const msg = await twilio.messages.create({
        body: messageBody,
        from: fromNumber,
        to: toNumber,
      });
      console.log(`[Notifications] SMS sent via Twilio. SID: ${msg.sid}`);
    } catch (err) {
      console.error('[Notifications] Twilio SMS failed:', err.message);
    }
  } else {
    console.log(`[Notifications] SMS (logged - Twilio not configured): ${messageBody}`);
  }
}

/**
 * Notify supervisor of a critical defect via all channels
 * @param {object} alert - Alert record
 */
async function notifyCriticalDefect(alert) {
  await Promise.allSettled([
    sendEmailNotification(alert),
    sendSMSNotification(alert),
  ]);
}

module.exports = { notifyCriticalDefect, sendEmailNotification, sendSMSNotification };
