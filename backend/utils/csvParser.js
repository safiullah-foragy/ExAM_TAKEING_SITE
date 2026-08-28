const { parse } = require('csv-parse/sync');
const fs = require('fs');

// Map Bangla numerals to Arabic
const banglaToArabic = (str) => {
  const map = { '০': 0, '১': 1, '২': 2, '৩': 3, '৪': 4, '৫': 5, '৬': 6, '৭': 7, '৮': 8, '৯': 9 };
  return parseInt(
    String(str)
      .trim()
      .replace(/[০-৯]/g, (d) => map[d])
  );
};

// Normalize answer: accept both Bangla letters and English equivalents
const normalizeAnswer = (answer) => {
  const str = String(answer).trim();
  // Mapping for English equivalents
  const map = { ko: 'ক', kho: 'খ', go: 'গ', gho: 'ঘ', a: 'ক', b: 'খ', c: 'গ', d: 'ঘ' };
  if (map[str.toLowerCase()]) return map[str.toLowerCase()];
  return str; // return as-is if already Bangla
};

/**
 * Parse answer CSV file
 * Accepts two column formats:
 *   1. Bangla headers: প্রশ্ন নম্বর, উত্তর
 *   2. English headers: question_no, answer
 *
 * @param {string} filePath - absolute path to CSV file
 * @returns {Array} - [{ questionNo: Number, answer: String }]
 */
const parseAnswerCSV = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true, // handle BOM for UTF-8 files
  });

  if (!records.length) {
    throw new Error('CSV file is empty or has no data rows');
  }

  // Detect column names (flexible matching)
  const headers = Object.keys(records[0]);
  let qNoCol = null;
  let answerCol = null;

  for (const h of headers) {
    const lower = h.toLowerCase().trim();
    if (
      lower.includes('প্রশ্ন') ||
      lower.includes('question') ||
      lower.includes('no') ||
      lower === 'q' ||
      lower === 'qno'
    ) {
      qNoCol = h;
    }
    if (
      lower.includes('উত্তর') ||
      lower.includes('answer') ||
      lower === 'ans' ||
      lower === 'a'
    ) {
      answerCol = h;
    }
  }

  if (!qNoCol || !answerCol) {
    // Fallback: use first col as question number, second as answer
    qNoCol = headers[0];
    answerCol = headers[1];
  }

  const parsed = records.map((row, idx) => {
    const rawNo = row[qNoCol];
    const rawAns = row[answerCol];

    // Handle both Bangla and Arabic numerals
    let qNo;
    if (/[০-৯]/.test(rawNo)) {
      qNo = banglaToArabic(rawNo);
    } else {
      qNo = parseInt(rawNo, 10);
    }

    if (isNaN(qNo)) {
      throw new Error(`Invalid question number at row ${idx + 2}: "${rawNo}"`);
    }

    const answer = normalizeAnswer(rawAns);
    if (!['ক', 'খ', 'গ', 'ঘ'].includes(answer)) {
      throw new Error(
        `Invalid answer "${rawAns}" at row ${idx + 2}. Must be ক, খ, গ, or ঘ (or ko, kho, go, gho)`
      );
    }

    return { questionNo: qNo, answer };
  });

  // Sort by question number
  parsed.sort((a, b) => a.questionNo - b.questionNo);

  return parsed;
};

module.exports = { parseAnswerCSV };
