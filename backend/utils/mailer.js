const nodemailer = require('nodemailer');

const mailUser = (process.env.MAIL_USER || '').trim();
const mailPass = (process.env.MAIL_PASS || '').trim();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use STARTTLS on port 587 for cloud platforms (Render, Vercel, etc.)
  auth: {
    user: mailUser,
    pass: mailPass,
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

/**
 * Send OTP email to a user
 */
const sendOTPEmail = async (to, name, otp) => {
  const mailOptions = {
    from: `"ExamSite" <${process.env.MAIL_USER}>`,
    to,
    subject: '🔐 Your OTP Verification Code — ExamSite',
    html: `
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
    `,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Send result email with PDF attachment
 */
const sendResultEmail = async (to, name, examTitle, score, totalMarks, passed, pdfPath) => {
  const fs = require('fs');
  const mailOptions = {
    from: `"ExamSite" <${process.env.MAIL_USER}>`,
    to,
    subject: `📊 Your Exam Result — ${examTitle}`,
    html: `
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
    `,
    attachments: pdfPath && fs.existsSync(pdfPath)
      ? [
          {
            filename: `${examTitle.replace(/\s+/g, '_')}_Result.pdf`,
            path: pdfPath,
          },
        ]
      : [],
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Send new exam invitation email to users
 */
const sendNewExamNotificationEmail = async (to, name, exam) => {
  const loginUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const mailOptions = {
    from: `"ExamSite" <${process.env.MAIL_USER}>`,
    to,
    subject: `📢 New Exam Available: ${exam.title} (${exam.totalMarks} Marks)`,
    html: `
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
                    <td style="padding:4px 0;">🎯 <strong>Full Marks:</strong></td>
                    <td style="padding:4px 0;color:#e2e8f0;text-align:right;">${exam.totalMarks} Marks</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;">✅ <strong>Pass Marks:</strong></td>
                    <td style="padding:4px 0;color:#10b981;text-align:right;">${exam.passMarks} Marks</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;">⏱ <strong>Total Time:</strong></td>
                    <td style="padding:4px 0;color:#e2e8f0;text-align:right;">${exam.totalTime} Minutes</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;">❓ <strong>Total Questions:</strong></td>
                    <td style="padding:4px 0;color:#e2e8f0;text-align:right;">${exam.totalQuestions} MCQs</td>
                  </tr>
                </table>
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
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail, sendResultEmail, sendNewExamNotificationEmail };
