import { useState, useEffect, useRef } from 'react';

const pad = (n) => String(n).padStart(2, '0');

export default function CountdownTimer({ totalSeconds, onTimeUp }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const timerRef = useRef();
  const firedRef = useRef(false);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!firedRef.current) {
            firedRef.current = true;
            setTimeout(onTimeUp, 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [onTimeUp]);

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  let timerClass = 'timer';
  if (remaining <= 300 && remaining > 60) timerClass += ' warning';
  if (remaining <= 60) timerClass += ' critical';

  return (
    <div className={timerClass} id="countdown-timer" aria-label={`Time remaining: ${hours > 0 ? `${hours} hours ` : ''}${minutes} minutes ${seconds} seconds`}>
      ⏱
      {hours > 0 && <>{pad(hours)}:</>}
      {pad(minutes)}:{pad(seconds)}
    </div>
  );
}
