import { sanitizeHeaders } from '../src/lib/headerSanitizer';

export interface EmailConfig {
  apiKey: string;
  fromAddress: string;
  alertRecipient: string;
}

export async function sendSecurityEmail(subject: string, htmlContent: string) {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  const fromAddress = process.env.EMAIL_FROM || 'security@vault.internal';
  const alertRecipient = process.env.SECURITY_ALERT_RECIPIENT;

  if (!apiKey || !alertRecipient) {
    console.warn('[EMAIL] API Key or Recipient missing. Email suppressed:', subject);
    return { success: false, reason: 'unconfigured' };
  }

  try {
    const rawHeaders: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    const headers = sanitizeHeaders(rawHeaders, 'resend/emails');

    // Assuming a standard transactional email API like Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: fromAddress,
        to: [alertRecipient],
        subject: subject,
        html: htmlContent
      })
    });

    if (res.ok) {
      return { success: true };
    } else {
      const err = await res.text();
      console.error('[EMAIL] Failed to send email:', err);
      return { success: false, reason: 'provider_error' };
    }
  } catch (error) {
    console.error('[EMAIL] Exception sending email:', error);
    return { success: false, reason: 'exception' };
  }
}
