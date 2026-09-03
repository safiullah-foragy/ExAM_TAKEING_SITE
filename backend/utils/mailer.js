const fs = require('fs');
const nodemailer = require('nodemailer');

const getTransporter = () => {
  const mailUser = (process.env.MAIL_USER || '').trim();
  const mailPass = (process.env.MAIL_PASS || '').trim().replace(/\s+/g, '');

  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: mailUser,
      pass: mailPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
};

/**
 * Universal mail dispatcher:
 * - If BREVO_API_KEY is present: sends via Brevo HTTP API (Port 443 - HTTPS, bypasses Render SMTP block)
 * - Otherwise: falls back to Gmail SMTP
 */
const sendMailGeneric = async ({ to, name, subject, html, attachments = [] }) => {
  const brevoApiKey = (process.env.BREVO_API_KEY || '').trim();
  const senderEmail = (process.env.MAIL_USER || '').trim() || 'safiullahforagy1@gmail.com';
  const senderName = 'ExamSite';

  if (brevoApiKey) {
    // Format attachments for Brevo HTTP API: { name, content (base64) }
    const brevoAttachments = attachments
      .map((att) => {
        let base64Content = '';
        if (att.content && Buffer.isBuffer(att.content)) {
          base64Content = att.content.toString('base64');
        } else if (att.path && fs.existsSync(att.path)) {
          base64Content = fs.readFileSync(att.path).toString('base64');
        }
        if (!base64Content) return null;
        return {
          name: att.filename,
          content: base64Content,
        };
      })
      .filter(Boolean);

    const payload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to, name: name || 'Student' }],
      subject,
      htmlContent: html,
    };
    if (brevoAttachments.length > 0) {
      payload.attachment = brevoAttachments;
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Brevo HTTP API failed with status ${response.status}`);
    }

    return await response.json();
  }

  // Fallback to Gmail SMTP
  const mailOptions = {
    from: `"${senderName}" <${senderEmail}>`,
    to,
    subject,
    html,
    attachments,
  };
  return await getTransporter().sendMail(mailOptions);
};

/**
 * Send OTP email to a user
 */
const sendOTPEmail = async (to, name, otp) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',sans-serif;">
        <div style="max-width:520px;margin:40px auto;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;overflow:hidden;border:1px solid rgba(99,102,241,0.3);">
          <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:-0.5px;">📝 ExamSite</h1>
            <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;">Online Examination Platform</p>
          </div>
          <div style="padding:40px 32px;">
            <h2 style="color:#e2e8f0;margin:0 0 8px;">Hello, ${name}! 👋</h2>
            <p style="color:#94a3b8;margin:0 0 32px;line-height:1.6;">
              Your One-Time Password for ExamSite verification is:
            </p>
            <div style="background:rgba(99,102,241,0.15);border:2px solid rgba(99,102,241,0.5);border-radius:12px;padding:24px;text-align:center;margin-bottom:32px;">
              <span style="font-size:42px;font-weight:800;letter-spacing:12px;color:#818cf8;font-family:monospace;">${otp}</span>
            </div>
            <p style="color:#64748b;font-size:13px;margin:0;line-height:1.6;">
              ⏰ This OTP expires in <strong style="color:#f59e0b;">10 minutes</strong>.<br>
              If you didn't request this, please ignore this email.
            </p>
          </div>
          <div style="background:rgba(0,0,0,0.3);padding:20px 32px;text-align:center;">
            <p style="color:#475569;font-size:12px;margin:0;">© 2026 ExamSite. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return await sendMailGeneric({
    to,
    name,
    subject: '🔐 Your OTP Verification Code — ExamSite',
    html,
  });
};

/**
 * Send result email with PDF attachment
 */
const sendResultEmail = async (to, name, examTitle, score, totalMarks, passed, pdfPath) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',sans-serif;">
        <div style="max-width:520px;margin:40px auto;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;overflow:hidden;border:1px solid rgba(99,102,241,0.3);">
          <div style="background:linear-gradient(135deg,${passed ? '#10b981,#059669' : '#ef4444,#dc2626'});padding:32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:28px;">${passed ? '🎉 Congratulations!' : '📚 Keep Practicing!'}</h1>
            <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;">${examTitle}</p>
          </div>
          <div style="padding:40px 32px;">
            <p style="color:#94a3b8;margin:0 0 24px;">Hi <strong style="color:#e2e8f0;">${name}</strong>, your exam result is ready!</p>
            <div style="background:rgba(99,102,241,0.1);border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
              <div style="font-size:56px;font-weight:800;color:${passed ? '#10b981' : '#ef4444'};">${score}</div>
              <div style="color:#64748b;font-size:14px;">out of ${totalMarks} marks</div>
              <div style="margin-top:12px;display:inline-block;padding:6px 20px;border-radius:999px;background:${passed ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'};color:${passed ? '#10b981' : '#ef4444'};font-weight:700;font-size:16px;">
                ${passed ? 'PASSED ✓' : 'FAILED ✗'}
              </div>
            </div>
            <p style="color:#64748b;font-size:13px;">
              📎 The detailed result sheet is attached as a PDF.
            </p>
          </div>
          <div style="background:rgba(0,0,0,0.3);padding:20px 32px;text-align:center;">
            <p style="color:#475569;font-size:12px;margin:0;">© 2026 ExamSite. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const attachments = (pdfPath && fs.existsSync(pdfPath))
    ? [{ filename: `${examTitle.replace(/\s+/g, '_')}_Result.pdf`, path: pdfPath }]
    : [];

  return await sendMailGeneric({
    to,
    name,
    subject: `📊 Your Exam Result — ${examTitle}`,
    html,
    attachments,
  });
};

/**
 * Send new exam invitation email to users
 */
const sendNewExamNotificationEmail = async (to, name, exam) => {
  const loginUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',sans-serif;">
        <div style="max-width:520px;margin:40px auto;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;overflow:hidden;border:1px solid rgba(99,102,241,0.3);">
          <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:26px;letter-spacing:-0.5px;">📢 New Exam Published!</h1>
            <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;">ExamSite — Online Examination Platform</p>
          </div>
          <div style="padding:36px 32px;">
            <h2 style="color:#e2e8f0;margin:0 0 12px;font-size:20px;">Hello, ${name}! 👋</h2>
            <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin:0 0 24px;">
              A new examination has been created by <strong>${exam.author}</strong>. <br>
              <em style="color:#a5b4fc;">Please attend the exam when you are free.</em>
            </p>

            <div style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:12px;padding:20px;margin-bottom:28px;">
              <h3 style="color:#ffffff;margin:0 0 12px;font-size:18px;">📝 ${exam.title}</h3>
              <table style="width:100%;color:#94a3b8;font-size:14px;border-collapse:collapse;">
                <tr>
                  <td style="padding:5px 0;">🎯 <strong>Full Marks:</strong></td>
                  <td style="padding:5px 0;color:#e2e8f0;text-align:right;">${exam.totalMarks} Marks</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;">✅ <strong>Pass Marks:</strong></td>
                  <td style="padding:5px 0;color:#10b981;text-align:right;">${exam.passMarks} Marks</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;">⏱ <strong>Total Time:</strong></td>
                  <td style="padding:5px 0;color:#e2e8f0;text-align:right;">${exam.totalTime} Minutes</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;">❓ <strong>Total Questions:</strong></td>
                  <td style="padding:5px 0;color:#e2e8f0;text-align:right;">${exam.totalQuestions} MCQs</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;">➕ <strong>Marks per MCQ:</strong></td>
                  <td style="padding:5px 0;color:#e2e8f0;text-align:right;">+${exam.marksPerMCQ || 1}</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;">⚠️ <strong>Negative Marking:</strong></td>
                  <td style="padding:5px 0;text-align:right;color:${Number(exam.negativeMark) > 0 ? '#f87171' : '#34d399'};font-weight:600;">
                    ${Number(exam.negativeMark) > 0 ? `-${exam.negativeMark} per wrong answer` : 'None (0)'}
                  </td>
                </tr>
              </table>
              ${Number(exam.negativeMark) > 0 ? `
                <div style="background:rgba(239,68,68,0.12);border-left:3px solid #ef4444;border-radius:6px;padding:8px 12px;margin-top:14px;color:#fca5a5;font-size:13px;line-height:1.4;">
                  ⚠️ <strong>Negative Marking Alert:</strong> Each incorrect answer will deduct <strong>${exam.negativeMark} mark${Number(exam.negativeMark) !== 1 ? 's' : ''}</strong> from your total score.
                </div>
              ` : ''}
            </div>

            <div style="text-align:center;margin:32px 0 16px;">
              <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;box-shadow:0 4px 16px rgba(99,102,241,0.4);">
                → Take Exam Now
              </a>
            </div>
          </div>
          <div style="background:rgba(0,0,0,0.3);padding:20px 32px;text-align:center;">
            <p style="color:#475569;font-size:12px;margin:0;">© 2026 ExamSite. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return await sendMailGeneric({
    to,
    name,
    subject: `📢 New Exam Available: ${exam.title} (${exam.totalMarks} Marks)`,
    html,
  });
};

/**
 * Send custom announcement/broadcast email with optional PDF/image attachment
 */
const sendBroadcastEmail = async ({ to, name, subject, message, attachment = null }) => {
  const loginUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  // Convert raw message text with linebreaks to safe HTML paragraphs
  const safeMessageHtml = (message || '')
    .split(/\r?\n\r?\n/)
    .map((paragraph) => `<p style="color:#cbd5e1;font-size:15px;line-height:1.7;margin:0 0 16px;">${paragraph.replace(/\r?\n/g, '<br>')}</p>`)
    .join('');

  const attachments = [];
  let attachmentNoticeHtml = '';

  if (attachment) {
    if (attachment.buffer) {
      attachments.push({
        filename: attachment.filename,
        content: attachment.buffer,
        contentType: attachment.contentType,
      });
    } else if (attachment.path && fs.existsSync(attachment.path)) {
      attachments.push({
        filename: attachment.filename,
        path: attachment.path,
        contentType: attachment.contentType,
      });
    }

    const isImage = attachment.contentType && attachment.contentType.startsWith('image/');
    attachmentNoticeHtml = `
      <div style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);border-radius:10px;padding:16px 20px;margin:24px 0;display:flex;align-items:center;">
        <span style="font-size:24px;margin-right:12px;">${isImage ? '🖼️' : '📄'}</span>
        <div>
          <div style="color:#ffffff;font-weight:600;font-size:14px;">Attached File: ${attachment.filename}</div>
          <div style="color:#94a3b8;font-size:12px;margin-top:2px;">Please find the attached ${isImage ? 'image' : 'PDF document'} in this email.</div>
        </div>
      </div>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',sans-serif;">
        <div style="max-width:560px;margin:40px auto;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;overflow:hidden;border:1px solid rgba(99,102,241,0.3);box-shadow:0 12px 40px rgba(0,0,0,0.5);">
          <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:26px;letter-spacing:-0.5px;">📢 ExamSite Announcement</h1>
            <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Notice from Administration</p>
          </div>
          <div style="padding:36px 32px;">
            <h2 style="color:#e2e8f0;margin:0 0 16px;font-size:20px;">Hello, ${name || 'Student'}! 👋</h2>
            
            <div style="margin-bottom:24px;">
              ${safeMessageHtml}
            </div>

            ${attachmentNoticeHtml}

            <div style="text-align:center;margin:32px 0 16px;">
              <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;box-shadow:0 4px 16px rgba(99,102,241,0.4);">
                Open ExamSite Portal →
              </a>
            </div>
          </div>
          <div style="background:rgba(0,0,0,0.3);padding:20px 32px;text-align:center;">
            <p style="color:#475569;font-size:12px;margin:0;">© 2026 ExamSite. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return await sendMailGeneric({
    to,
    name,
    subject,
    html,
    attachments,
  });
};

module.exports = {
  sendOTPEmail,
  sendResultEmail,
  sendNewExamNotificationEmail,
  sendBroadcastEmail,
};



