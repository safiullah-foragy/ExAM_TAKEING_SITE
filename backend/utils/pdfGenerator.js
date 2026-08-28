const PDFDocument = require('pdfkit');
const { PDFDocument: PDFLibDoc } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { uploadToSupabase, deleteFromSupabase } = require('./supabaseStorage');

const FONT_PATH = path.join(__dirname, '../fonts/MuktiNarrow.ttf');
const FONT_BOLD_PATH = path.join(__dirname, '../fonts/MuktiNarrowBold.ttf');

const hasFont = () => fs.existsSync(FONT_PATH);

/**
 * Fetch buffer from local path or remote URL
 */
const getFileBuffer = async (filePathOrUrl) => {
  if (!filePathOrUrl) return null;
  try {
    if (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://')) {
      const res = await fetch(filePathOrUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    }
    if (fs.existsSync(filePathOrUrl)) {
      return fs.readFileSync(filePathOrUrl);
    }
    return null;
  } catch (err) {
    console.error(`Error loading buffer from ${filePathOrUrl}:`, err.message);
    return null;
  }
};

/**
 * Generate a Result PDF with Candidate photo, detailed answer sheet,
 * and merge it with the original Question PDF, then upload to Supabase Storage.
 *
 * @param {Object} params - { user, exam, submission, outputDir }
 * @returns {Promise<string>} local path or Supabase public URL of merged PDF
 */
const generateResultPDF = async ({ user, exam, submission, outputDir }) => {
  const tempResultSheetPath = path.join(outputDir, `temp_result_${user._id}_${Date.now()}.pdf`);
  const finalMergedLocalPath = path.join(outputDir, `result_${user._id}_${exam._id}_${Date.now()}.pdf`);

  // Fetch candidate photo buffer (works for both local path and Supabase public URL)
  let userPhotoBuffer = null;
  if (user.photo) {
    userPhotoBuffer = await getFileBuffer(user.photo);
  }

  // Step 1: Generate Result Sheet using PDFKit
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 45, right: 45 },
      autoFirstPage: true,
    });

    const stream = fs.createWriteStream(tempResultSheetPath);
    doc.pipe(stream);

    // Register Mukti Unicode Fonts
    if (hasFont()) {
      doc.registerFont('Mukti', FONT_PATH);
      if (fs.existsSync(FONT_BOLD_PATH)) {
        doc.registerFont('MuktiBold', FONT_BOLD_PATH);
      } else {
        doc.registerFont('MuktiBold', FONT_PATH);
      }
    }

    const setFont = (bold = false) => {
      if (hasFont()) {
        doc.font(bold ? 'MuktiBold' : 'Mukti');
      } else {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
      }
    };

    const pageWidth = doc.page.width - 90; // margins 45 left, 45 right

    // ── Header Banner ──────────────────────────────────────────────────────────
    doc.rect(45, 40, pageWidth, 60).fillColor('#1e1b4b').fill();

    setFont(true);
    doc.fillColor('#ffffff').fontSize(18).text('EXAM RESULT SHEET', 45, 52, {
      width: pageWidth,
      align: 'center',
    });

    setFont(false);
    doc.fontSize(10).fillColor('#c7d2fe').text('ExamSite — Online Examination Platform', 45, 75, {
      width: pageWidth,
      align: 'center',
    });

    // ── Candidate Profile & Exam Information Box ─────────────────────────────
    let y = 115;
    const boxHeight = 110;
    doc
      .rect(45, y, pageWidth, boxHeight)
      .fillColor('#f8fafc')
      .strokeColor('#6366f1')
      .lineWidth(1.5)
      .fillAndStroke();

    // Draw Candidate Avatar on top-left
    const avatarX = 60;
    const avatarY = y + 15;
    const avatarSize = 80;
    const radius = avatarSize / 2;

    let photoDrawn = false;
    if (userPhotoBuffer) {
      try {
        doc.save();
        // Circular clipping
        doc.circle(avatarX + radius, avatarY + radius, radius).clip();
        doc.image(userPhotoBuffer, avatarX, avatarY, {
          width: avatarSize,
          height: avatarSize,
          fit: [avatarSize, avatarSize],
          align: 'center',
          valign: 'center',
        });
        doc.restore();

        // Border ring around avatar
        doc.circle(avatarX + radius, avatarY + radius, radius).strokeColor('#6366f1').lineWidth(2).stroke();
        photoDrawn = true;
      } catch (err) {
        console.error('Error rendering candidate photo in PDF:', err.message);
      }
    }

    if (!photoDrawn) {
      // Fallback Circular Initials Badge
      doc.circle(avatarX + radius, avatarY + radius, radius).fillColor('#4f46e5').fill();
      const initials = (user.name || 'Student')
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      setFont(true);
      doc.fillColor('#ffffff').fontSize(22).text(initials, avatarX, avatarY + 26, {
        width: avatarSize,
        align: 'center',
      });
    }

    // Candidate & Exam Details beside Avatar
    const detailsX = avatarX + avatarSize + 20;
    const textWidth = pageWidth - (detailsX - 45) - 15;

    setFont(true);
    doc.fillColor('#0f172a').fontSize(14).text(user.name || 'Candidate', detailsX, y + 14, {
      width: textWidth,
    });

    setFont(false);
    doc.fontSize(9).fillColor('#475569');
    doc.text(`Email: ${user.email}`, detailsX, y + 33);
    doc.text(`Exam: ${exam.title}`, detailsX, y + 48, { width: textWidth });
    doc.text(`Author: ${exam.author}`, detailsX, y + 63);

    // Right Column Info
    const col2X = detailsX + 220;
    const submittedDate = new Date(submission.submittedAt || Date.now()).toLocaleDateString('en-GB');
    doc.text(`Total Marks: ${exam.totalMarks}`, col2X, y + 33);
    doc.text(`Pass Marks: ${exam.passMarks}`, col2X, y + 48);
    doc.text(`Date: ${submittedDate}`, col2X, y + 63);

    // ── Score & Evaluation Summary Box ───────────────────────────────────────
    y = 238;
    const passColor = submission.passed ? '#047857' : '#b91c1c';
    const passBg = submission.passed ? '#ecfdf5' : '#fef2f2';
    const passBorder = submission.passed ? '#10b981' : '#ef4444';

    doc
      .rect(45, y, pageWidth, 75)
      .fillColor(passBg)
      .strokeColor(passBorder)
      .lineWidth(2)
      .fillAndStroke();

    setFont(true);
    doc.fontSize(36).fillColor(passColor).text(`${submission.score}`, 45, y + 10, {
      width: 150,
      align: 'center',
    });

    setFont(false);
    doc.fontSize(10).fillColor(passColor).text(`OUT OF ${exam.totalMarks} MARKS`, 45, y + 50, {
      width: 150,
      align: 'center',
    });

    // Divider Line
    doc.moveTo(205, y + 10).lineTo(205, y + 65).strokeColor(passBorder).lineWidth(1).stroke();

    // Stats
    const statsX = 225;
    setFont(false);
    doc.fontSize(10).fillColor('#1e293b');
    doc.text(`Correct Answers:    ${submission.correct}`, statsX, y + 14);
    doc.text(`Wrong Answers:      ${submission.wrong}`, statsX, y + 32);
    doc.text(`Skipped Questions: ${submission.skipped}`, statsX, y + 50);

    // Result Badge
    setFont(true);
    doc.fontSize(20).fillColor(passColor).text(submission.passed ? 'PASSED' : 'FAILED', 380, y + 26, {
      width: pageWidth - 335,
      align: 'center',
    });

    // ── Answer Sheet Section ─────────────────────────────────────────────────
    y = 325;
    setFont(true);
    doc.fontSize(12).fillColor('#1e1b4b').text('Detailed Answer Sheet', 45, y);
    y += 18;

    // Table Header
    const colX = [45, 95, 200, 310, 410];
    const colW = [50, 105, 110, 100, pageWidth - 365];

    doc.rect(45, y, pageWidth, 20).fillColor('#1e1b4b').fill();
    setFont(true);
    doc.fillColor('#ffffff').fontSize(9);
    doc.text('Q.No', colX[0] + 5, y + 5, { width: colW[0] });
    doc.text('Your Answer', colX[1] + 5, y + 5, { width: colW[1] });
    doc.text('Correct Answer', colX[2] + 5, y + 5, { width: colW[2] });
    doc.text('Status', colX[3] + 5, y + 5, { width: colW[3] });
    y += 20;

    // Build answer key map
    const answerKeyMap = {};
    exam.answerKey.forEach((ak) => {
      answerKeyMap[ak.questionNo] = ak.answer;
    });

    // Render Answer Rows
    const answersList = submission.answers || [];
    answersList.forEach((ans, idx) => {
      const correctAns = answerKeyMap[ans.questionNo] || '—';
      const selected = ans.selectedAnswer || '—';
      const isCorrect = selected !== '—' && selected === correctAns;
      const isSkipped = selected === '—';

      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const statusColor = isSkipped ? '#64748b' : isCorrect ? '#047857' : '#b91c1c';
      const statusText = isSkipped ? 'Skipped' : isCorrect ? 'Correct' : 'Wrong';

      if (y > doc.page.height - 50) {
        doc.addPage();
        y = 40;

        // Table Header on new page
        doc.rect(45, y, pageWidth, 20).fillColor('#1e1b4b').fill();
        setFont(true);
        doc.fillColor('#ffffff').fontSize(9);
        doc.text('Q.No', colX[0] + 5, y + 5, { width: colW[0] });
        doc.text('Your Answer', colX[1] + 5, y + 5, { width: colW[1] });
        doc.text('Correct Answer', colX[2] + 5, y + 5, { width: colW[2] });
        doc.text('Status', colX[3] + 5, y + 5, { width: colW[3] });
        y += 20;
      }

      doc.rect(45, y, pageWidth, 16).fillColor(rowBg).fill();
      setFont(false);
      doc.fontSize(9);

      doc.fillColor('#0f172a').text(`${ans.questionNo}`, colX[0] + 5, y + 3, { width: colW[0] });
      doc.text(`${selected}`, colX[1] + 5, y + 3, { width: colW[1] });
      doc.text(`${correctAns}`, colX[2] + 5, y + 3, { width: colW[2] });
      doc.fillColor(statusColor).text(statusText, colX[3] + 5, y + 3, { width: colW[3] });

      y += 16;
    });

    // Footer
    y += 15;
    if (y > doc.page.height - 35) {
      doc.addPage();
      y = 40;
    }
    setFont(false);
    doc
      .fontSize(8)
      .fillColor('#94a3b8')
      .text(`Generated by ExamSite on ${new Date().toLocaleString('en-GB')}`, 45, y, {
        width: pageWidth,
        align: 'center',
      });

    doc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  // Step 2: Merge the generated Result Sheet with the original Question PDF
  try {
    const mergedPdf = await PDFLibDoc.create();

    // 1. Add Result Sheet Pages
    const resultBytes = fs.readFileSync(tempResultSheetPath);
    const resultDoc = await PDFLibDoc.load(resultBytes);
    const resultPageIndices = resultDoc.getPageIndices();
    const copiedResultPages = await mergedPdf.copyPages(resultDoc, resultPageIndices);
    copiedResultPages.forEach((page) => mergedPdf.addPage(page));

    // 2. Add Original Question PDF Pages (from URL or local file)
    if (exam.pdfPath) {
      try {
        const questionBuffer = await getFileBuffer(exam.pdfPath);
        if (questionBuffer) {
          const questionDoc = await PDFLibDoc.load(questionBuffer);
          const questionPageIndices = questionDoc.getPageIndices();
          const copiedQuestionPages = await mergedPdf.copyPages(questionDoc, questionPageIndices);
          copiedQuestionPages.forEach((page) => mergedPdf.addPage(page));
        }
      } catch (err) {
        console.error('Error attaching question PDF:', err.message);
      }
    }

    // Save final merged PDF locally
    const mergedPdfBytes = await mergedPdf.save();
    fs.writeFileSync(finalMergedLocalPath, mergedPdfBytes);

    // Clean up temporary result sheet
    if (fs.existsSync(tempResultSheetPath)) {
      fs.unlinkSync(tempResultSheetPath);
    }

    // Step 3: Upload final merged PDF to Supabase Storage
    try {
      const destPath = `results/result_${user._id}_${exam._id}_${Date.now()}.pdf`;
      const publicResultUrl = await uploadToSupabase(finalMergedLocalPath, destPath, 'application/pdf');
      console.log('Result PDF uploaded to Supabase:', publicResultUrl);
      return { localPath: finalMergedLocalPath, publicUrl: publicResultUrl };
    } catch (uploadErr) {
      console.error('Error uploading result PDF to Supabase:', uploadErr.message);
      return { localPath: finalMergedLocalPath, publicUrl: null };
    }
  } catch (mergeErr) {
    console.error('PDF Merge Error, falling back to result sheet only:', mergeErr.message);
    if (fs.existsSync(tempResultSheetPath)) {
      fs.renameSync(tempResultSheetPath, finalMergedLocalPath);
    }
    return { localPath: finalMergedLocalPath, publicUrl: null };
  }
};

/**
 * Generate a single comprehensive master PDF for the entire exam
 * containing all participants, their obtained marks, total marks, rank, and status
 * sorted from highest marks to lowest.
 */
const generateMasterExamResultPDF = async ({ exam, participants }) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 45, right: 45 },
      autoFirstPage: true,
    });

    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    // Register font
    let regularFont = 'Helvetica';
    let boldFont = 'Helvetica-Bold';
    if (hasFont()) {
      doc.registerFont('Mukti', FONT_PATH);
      regularFont = 'Mukti';
    }
    if (fs.existsSync(FONT_BOLD_PATH)) {
      doc.registerFont('MuktiBold', FONT_BOLD_PATH);
      boldFont = 'MuktiBold';
    }

    const drawHeader = (isFirstPage = true) => {
      if (isFirstPage) {
        // Title banner
        doc.rect(45, 35, 505, 75).fill('#1e1e38');

        doc.fillColor('#fbbf24').font(boldFont).fontSize(16).text('EXAMINATION MERIT LIST & RESULTS', 55, 47, { align: 'center', width: 485 });
        doc.fillColor('#ffffff').font(boldFont).fontSize(13).text(exam.title || 'Exam Results', 55, 70, { align: 'center', width: 485 });
        
        doc.fillColor('#94a3b8').font(regularFont).fontSize(9).text(
          `Conducted by: ${exam.author || 'ExamSite'}   |   Date: ${new Date().toLocaleDateString('en-GB')}`,
          55,
          92,
          { align: 'center', width: 485 }
        );

        // Exam summary stats bar
        doc.rect(45, 120, 505, 34).fill('#f8fafc').strokeColor('#cbd5e1').stroke();
        doc.fillColor('#0f172a').font(boldFont).fontSize(9.5);
        doc.text(`Full Marks: ${exam.totalMarks}`, 60, 131);
        doc.text(`Pass Marks: ${exam.passMarks}`, 180, 131);
        doc.text(`Total Candidates: ${participants.length}`, 300, 131);
        const topScore = participants.length > 0 ? participants[0].score : 0;
        doc.text(`Highest Score: ${topScore} / ${exam.totalMarks}`, 410, 131);

        return 168;
      } else {
        doc.fillColor('#475569').font(boldFont).fontSize(10).text(`Exam Merit List: ${exam.title} (Continued)`, 45, 40);
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(45, 55).lineTo(550, 55).stroke();
        return 65;
      }
    };

    const drawTableHeader = (startY) => {
      doc.rect(45, startY, 505, 24).fill('#334155');
      doc.fillColor('#ffffff').font(boldFont).fontSize(9.5);
      doc.text('Rank', 52, startY + 7, { width: 40 });
      doc.text('Candidate Name', 98, startY + 7, { width: 190 });
      doc.text('Total Marks', 295, startY + 7, { width: 75, align: 'center' });
      doc.text('Obtained Marks', 375, startY + 7, { width: 85, align: 'center' });
      doc.text('Status', 465, startY + 7, { width: 80, align: 'center' });
      return startY + 24;
    };

    let curY = drawHeader(true);
    curY = drawTableHeader(curY);

    if (participants.length === 0) {
      doc.fillColor('#64748b').font(regularFont).fontSize(11).text('No candidates have submitted this exam yet.', 45, curY + 20, { align: 'center', width: 505 });
    } else {
      participants.forEach((p, idx) => {
        // Page break if near bottom
        if (curY > 750) {
          doc.addPage();
          curY = drawHeader(false);
          curY = drawTableHeader(curY);
        }

        const isEven = idx % 2 === 0;
        const rowBg = isEven ? '#ffffff' : '#f8fafc';
        doc.rect(45, curY, 505, 22).fill(rowBg);
        doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(45, curY + 22).lineTo(550, curY + 22).stroke();

        const rankStr = `#${idx + 1}`;
        const nameStr = p.user?.name || 'Student';
        const totalMarksStr = `${exam.totalMarks}`;
        const scoreStr = `${p.score}`;
        const statusStr = p.passed ? 'PASSED' : 'FAILED';
        const statusColor = p.passed ? '#16a34a' : '#dc2626';

        doc.fillColor('#475569').font(boldFont).fontSize(9).text(rankStr, 52, curY + 6, { width: 40 });
        doc.fillColor('#0f172a').font(regularFont).fontSize(9.5).text(nameStr, 98, curY + 6, { width: 190, ellipsis: true });
        doc.fillColor('#64748b').font(regularFont).fontSize(9.5).text(totalMarksStr, 295, curY + 6, { width: 75, align: 'center' });
        doc.fillColor('#0f172a').font(boldFont).fontSize(10).text(scoreStr, 375, curY + 5, { width: 85, align: 'center' });
        doc.fillColor(statusColor).font(boldFont).fontSize(9).text(statusStr, 465, curY + 6, { width: 80, align: 'center' });

        curY += 22;
      });
    }

    // Add footer on last page
    doc.fillColor('#94a3b8').font(regularFont).fontSize(8).text(
      'Official Merit List • Generated automatically by Exam Management System',
      45,
      780,
      { align: 'center', width: 505 }
    );

    doc.end();
  });
};

module.exports = { generateResultPDF, generateMasterExamResultPDF };
