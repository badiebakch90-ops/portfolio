const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed.' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL || 'Portfolio Contact <onboarding@resend.dev>';

  if (!resendKey || !to) {
    return res.status(503).json({ ok: false, message: 'Email service is not configured yet.' });
  }

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const projectType = String(body.projectType || '').trim();
  const projectTypeLabel = String(body.projectTypeLabel || projectType || '').trim();
  const message = String(body.message || '').trim();
  const company = String(body.company || '').trim();

  if (company) {
    return res.status(200).json({ ok: true });
  }

  if (!name || !email || !projectType || !message) {
    return res.status(400).json({ ok: false, message: 'Missing required fields.' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ ok: false, message: 'Invalid email address.' });
  }

  const subject = `Portfolio inquiry - ${projectTypeLabel || 'General'} - ${name}`;
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeType = escapeHtml(projectTypeLabel || projectType);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: [
          `Name: ${name}`,
          `Email: ${email}`,
          `Project type: ${projectTypeLabel || projectType}`,
          '',
          message
        ].join('\n'),
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1d1712">
            <h2 style="margin:0 0 16px">New portfolio inquiry</h2>
            <p><strong>Name:</strong> ${safeName}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Project type:</strong> ${safeType}</p>
            <p><strong>Message:</strong><br>${safeMessage}</p>
          </div>
        `
      })
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      return res.status(502).json({ ok: false, message: errorText || 'Email provider rejected the request.' });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unexpected server error.' });
  }
};
