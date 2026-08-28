const OPTIONS = ['ক', 'খ', 'গ', 'ঘ'];

// Convert number to Bangla numeral string
const toBanglaNumeral = (n) => {
  const map = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
  return String(n).replace(/\d/g, (d) => map[parseInt(d)]);
};

export default function AnswerSheet({ totalQuestions, answers, onAnswer }) {
  return (
    <div>
      {Array.from({ length: totalQuestions }, (_, i) => {
        const qNo = i + 1;
        const selected = answers[qNo];
        return (
          <div key={qNo} className="mcq-row">
            <span className="mcq-qno bangla">{toBanglaNumeral(qNo)}</span>
            <div className="mcq-options">
              {OPTIONS.map((opt) => (
                <button
                  key={opt}
                  id={`q${qNo}-opt-${opt}`}
                  className={`mcq-option bangla${selected === opt ? ' selected' : ''}`}
                  onClick={() => onAnswer(qNo, opt)}
                  title={`Question ${qNo} — ${opt}`}
                  aria-label={`Question ${qNo} option ${opt}`}
                  aria-pressed={selected === opt}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
