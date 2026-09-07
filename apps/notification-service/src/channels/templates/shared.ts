type StandardEmailOptions = {
  title: string;
  heading: string;
  bodyHtml: string;
};

type CardEmailOptions = {
  title: string;
  bodyHtml: string;
};

export function renderPrimaryButton(label: string, href: string): string {
  return `<a href="${href}" style="background:#1a3557;color:#ffffff;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:500;">${label}</a>`;
}

export function renderAltButton(label: string, href: string): string {
  return `<a href="${href}" style="background:#f97316;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">${label}</a>`;
}

export function renderStandardEmail({
  title,
  heading,
  bodyHtml,
}: StandardEmailOptions): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:Arial, sans-serif;">
  <table align="center" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; margin:40px auto; border-radius:8px; overflow:hidden;">
    <tr>
      <td style="padding:20px 30px;">
        <h2 style="margin:0; font-weight:bold;">
          <span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span>
        </h2>
      </td>
    </tr>
    <tr>
      <td style="background:#eef1f4; padding:40px 30px;">
        <table width="100%">
          <tr>
            <td style="font-size:28px; font-weight:600; color:#555;">${heading}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:30px; color:#555; font-size:15px; line-height:1.6;">
        ${bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:20px 30px; border-top:1px solid #eee;">
        <h3 style="margin:0;">
          <span style="color:#ff6a00;">WORK</span><span style="color:#1a3557;">Phelo</span>
        </h3>
        <p style="color:#888; font-size:12px; margin-top:5px;">© 2026 WorkPhelo All rights reserved</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderCardEmail({ title, bodyHtml }: CardEmailOptions): string {
  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; border-radius: 8px;">
  <div style="background: white; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb;">
    <h1 style="color: #f97316; margin: 0 0 8px 0;">WorkPhelo ERP</h1>
    <h2 style="color: #111827; margin: 0 0 24px 0;">${title}</h2>
    ${bodyHtml}
  </div>
</div>`;
}
