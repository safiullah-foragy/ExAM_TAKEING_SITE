import { useState, useEffect } from 'react';

export default function AngryCheatingAlert({
  duration,
  message,
  userName,
  onComplete,
}) {
  // Resolve user name from prop or localStorage
  let resolvedUserName = userName;
  if (!resolvedUserName) {
    try {
      const stored = JSON.parse(localStorage.getItem('user'));
      if (stored?.name) resolvedUserName = stored.name;
    } catch {}
  }

  // Resolve duration: prop -> VITE_CHEATING_WARNING_DURATION -> default 3s
  const rawDuration = duration ?? import.meta.env.VITE_CHEATING_WARNING_DURATION;
  const alertDuration = Math.max(1, parseInt(rawDuration, 10) || 3);

  const rawMessage =
    message ||
    import.meta.env.VITE_CHEATING_WARNING_MESSAGE ||
    '';

  // Format message: prepend username followed by comma if available
  let displayMessage = rawMessage;
  if (resolvedUserName && rawMessage) {
    if (!rawMessage.toLowerCase().startsWith(resolvedUserName.toLowerCase())) {
      displayMessage = `${resolvedUserName}, ${rawMessage}`;
    }
  } else if (!rawMessage && resolvedUserName) {
    displayMessage = `${resolvedUserName}, চিটিং করার চেষ্টা করিস না!`;
  }

  const [secondsRemaining, setSecondsRemaining] = useState(alertDuration);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    setSecondsRemaining(alertDuration);

    // Tick countdown every second
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // After duration seconds, trigger exit animation and finish
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 350); // wait for exit fade-out
    }, alertDuration * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [alertDuration, onComplete]);

  return (
    <div
      className={`angry-alert-overlay ${isExiting ? 'fade-out' : ''}`}
      id="angry-cheating-alert"
      role="alert"
      aria-live="assertive"
    >
      <div className="angry-alert-stage">
        {/* Comic Speech Bubble */}
        <div className="angry-speech-bubble" id="angry-speech-bubble">
          <div className="speech-bubble-badge">
            <span className="badge-pulse"></span>
            🚨 পরীক্ষা সতর্কতা
          </div>
          <p className="speech-bubble-message">
            "{displayMessage}"
          </p>
          <div className="speech-bubble-footer">
            <div className="timer-pill">
              <span className="timer-icon">⏱️</span>
              পরীক্ষা শুরু হচ্ছে: <strong>{secondsRemaining}</strong> সেকেন্ডে
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ animationDuration: `${alertDuration}s` }}
              />
            </div>
          </div>
          <div className="speech-bubble-tail" />
        </div>

        {/* Walking Angry Emoji Character with Legs and Menacing Knife */}
        <div className="angry-walker-container">
          <svg
            className="angry-character-svg"
            viewBox="-10 -18 190 232"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Radial gradient for angry face */}
              <radialGradient id="angryFaceGrad" cx="40%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#ff5252" />
                <stop offset="45%" stopColor="#ef233c" />
                <stop offset="85%" stopColor="#d90429" />
                <stop offset="100%" stopColor="#800f2f" />
              </radialGradient>

              {/* Gradient for limbs / shoes */}
              <linearGradient id="legGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2b2d42" />
                <stop offset="100%" stopColor="#11121c" />
              </linearGradient>

              <linearGradient id="shoeGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>

              {/* Knife Blade metallic gradient */}
              <linearGradient id="knifeBladeGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#94a3b8" />
                <stop offset="35%" stopColor="#cbd5e1" />
                <stop offset="70%" stopColor="#f1f5f9" />
                <stop offset="100%" stopColor="#ffffff" />
              </linearGradient>

              {/* Knife Handle wooden/tactical gradient */}
              <linearGradient id="knifeHandleGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3e1f0b" />
                <stop offset="50%" stopColor="#78350f" />
                <stop offset="100%" stopColor="#1c0d05" />
              </linearGradient>

              {/* Steam puff gradient */}
              <radialGradient id="steamGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
                <stop offset="80%" stopColor="rgba(255,255,255,0.2)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>

              {/* Glow filter for eyes and forehead vein */}
              <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Shadow on ground */}
            <ellipse
              className="character-ground-shadow"
              cx="80"
              cy="200"
              rx="48"
              ry="8"
              fill="rgba(0,0,0,0.4)"
            />

            {/* STEAM PUFFS (Ears) */}
            <g className="steam-puff steam-left">
              <circle cx="20" cy="40" r="10" fill="url(#steamGrad)" />
              <circle cx="12" cy="30" r="7" fill="url(#steamGrad)" />
              <circle cx="18" cy="20" r="5" fill="url(#steamGrad)" />
            </g>
            <g className="steam-puff steam-right">
              <circle cx="140" cy="40" r="10" fill="url(#steamGrad)" />
              <circle cx="148" cy="30" r="7" fill="url(#steamGrad)" />
              <circle cx="142" cy="20" r="5" fill="url(#steamGrad)" />
            </g>

            {/* LEFT LEG (Back leg in walk cycle) */}
            <g className="walker-leg leg-left">
              {/* Thigh & shin */}
              <path
                d="M 64 125 L 60 165 L 56 185"
                stroke="url(#legGrad)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Shoe */}
              <path
                d="M 46 182 Q 54 178 68 184 L 70 193 C 70 196 50 198 42 194 C 38 190 40 183 46 182 Z"
                fill="url(#shoeGrad)"
              />
              {/* Shoe sole */}
              <path
                d="M 40 193 L 70 193 C 70 196 40 197 40 193 Z"
                fill="#ffffff"
              />
            </g>

            {/* RIGHT LEG (Front leg in walk cycle) */}
            <g className="walker-leg leg-right">
              {/* Thigh & shin */}
              <path
                d="M 96 125 L 100 165 L 104 185"
                stroke="url(#legGrad)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Shoe */}
              <path
                d="M 94 182 Q 106 178 120 184 L 122 193 C 122 196 100 198 90 194 C 86 190 88 183 94 182 Z"
                fill="url(#shoeGrad)"
              />
              {/* Shoe sole */}
              <path
                d="M 88 193 L 122 193 C 122 196 88 197 88 193 Z"
                fill="#ffffff"
              />
            </g>

            {/* CHARACTER BODY (Bobs up and down with steps) */}
            <g className="walker-body-group">
              {/* LEFT ARM & FIST */}
              <g className="walker-arm arm-left">
                <path
                  d="M 28 85 Q 12 100 20 115"
                  stroke="#ef233c"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Clenched fist */}
                <circle cx="21" cy="116" r="7" fill="#d90429" />
              </g>

              {/* RIGHT ARM BRANDISHING MENACING KNIFE */}
              <g className="walker-arm arm-right-knife">
                {/* Arm raised / angled threateningly forward */}
                <path
                  d="M 130 85 Q 154 90 148 68"
                  stroke="#ef233c"
                  strokeWidth="8"
                  strokeLinecap="round"
                />

                {/* THE KNIFE & GRIPPING FIST */}
                <g className="menacing-knife-group" transform="translate(148, 68) rotate(-18)">
                  {/* Knife Handle */}
                  <rect
                    x="-3"
                    y="2"
                    width="6.5"
                    height="15"
                    rx="2"
                    fill="url(#knifeHandleGrad)"
                    stroke="#1c0a02"
                    strokeWidth="0.8"
                  />
                  {/* Handle Brass Rivets */}
                  <circle cx="0.2" cy="6" r="0.9" fill="#fbbf24" />
                  <circle cx="0.2" cy="12" r="0.9" fill="#fbbf24" />

                  {/* Knife Crossguard */}
                  <rect
                    x="-6"
                    y="-1.5"
                    width="12.5"
                    height="3.5"
                    rx="1"
                    fill="#cbd5e1"
                    stroke="#64748b"
                    strokeWidth="0.8"
                  />

                  {/* Sharp Steel Blade */}
                  <path
                    d="M -3.5 -1.5 L -3.5 -38 Q -3 -46 5 -50 Q 6.5 -30 4.5 -1.5 Z"
                    fill="url(#knifeBladeGrad)"
                    stroke="#94a3b8"
                    strokeWidth="0.9"
                    filter="drop-shadow(0 0 3px rgba(255, 255, 255, 0.6))"
                  />

                  {/* Sharp bevel light reflection */}
                  <path
                    d="M 0.5 -1.5 L 0.5 -44 Q 3.5 -40 4 -1.5 Z"
                    fill="rgba(255, 255, 255, 0.55)"
                  />

                  {/* Menacing blood drop at tip */}
                  <path
                    d="M 3.5 -50 C 4.5 -53 5 -54 5 -54 C 5 -54 5.5 -53 6.5 -50 C 7 -48 6 -47 5 -47 C 4 -47 3 -48 3.5 -50 Z"
                    fill="#dc2626"
                  />

                  {/* Clenched red fist wrapping tightly around the handle */}
                  <circle cx="0" cy="8" r="7" fill="#d90429" stroke="#991b1b" strokeWidth="1" />
                  {/* Finger creases */}
                  <line x1="-3" y1="6" x2="3" y2="6" stroke="#991b1b" strokeWidth="1.2" />
                  <line x1="-3" y1="9" x2="3" y2="9" stroke="#991b1b" strokeWidth="1.2" />

                  {/* Blade glint star sparkle */}
                  <g className="knife-glint" transform="translate(5, -45) scale(0.65)">
                    <path
                      d="M 0 -9 L 2.5 -2.5 L 9 0 L 2.5 2.5 L 0 9 L -2.5 2.5 L -9 0 L -2.5 -2.5 Z"
                      fill="#ffffff"
                    />
                  </g>
                </g>
              </g>

              {/* MAIN ROUND HEAD / FACE */}
              <circle
                cx="80"
                cy="80"
                r="55"
                fill="url(#angryFaceGrad)"
                filter="drop-shadow(0 8px 16px rgba(217, 4, 41, 0.45))"
              />

              {/* Top highlight for glossy 3D emoji feel */}
              <ellipse
                cx="70"
                cy="42"
                rx="30"
                ry="12"
                fill="rgba(255, 255, 255, 0.22)"
                transform="rotate(-10 70 42)"
              />

              {/* ANGER VEIN (💢) on forehead */}
              <g
                className="anger-vein"
                transform="translate(104, 34) scale(0.65)"
                filter="url(#glowFilter)"
              >
                <path
                  d="M 10 0 L 10 24 M 0 10 L 24 10 M 17 3 L 7 21 M 3 7 L 21 17"
                  stroke="#ffffff"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </g>

              {/* LEFT EYEBROW (Fierce diagonal slant) */}
              <path
                d="M 36 56 Q 52 64 68 70"
                stroke="#1f0308"
                strokeWidth="7"
                strokeLinecap="round"
              />

              {/* RIGHT EYEBROW (Fierce diagonal slant) */}
              <path
                d="M 124 56 Q 108 64 92 70"
                stroke="#1f0308"
                strokeWidth="7"
                strokeLinecap="round"
              />

              {/* LEFT EYE (Glaring, slanted) */}
              <g>
                <ellipse cx="52" cy="76" rx="10" ry="12" fill="#ffffff" />
                <ellipse cx="56" cy="76" rx="5.5" ry="6.5" fill="#1f0308" />
                <circle cx="58" cy="73" r="2" fill="#ffffff" />
              </g>

              {/* RIGHT EYE (Glaring, slanted) */}
              <g>
                <ellipse cx="108" cy="76" rx="10" ry="12" fill="#ffffff" />
                <ellipse cx="104" cy="76" rx="5.5" ry="6.5" fill="#1f0308" />
                <circle cx="106" cy="73" r="2" fill="#ffffff" />
              </g>

              {/* ANGRY GRITTED MOUTH */}
              <g transform="translate(0, 5)">
                {/* Mouth background */}
                <path
                  d="M 52 105 Q 80 96 108 105 Q 80 120 52 105 Z"
                  fill="#450a0a"
                  stroke="#2b0505"
                  strokeWidth="3"
                />
                {/* Clenched Teeth */}
                <path
                  d="M 55 106 Q 80 99 105 106 Q 80 116 55 106 Z"
                  fill="#ffffff"
                />
                {/* Teeth vertical dividing lines */}
                <line x1="67" y1="102" x2="67" y2="111" stroke="#b91c1c" strokeWidth="1.5" />
                <line x1="80" y1="100" x2="80" y2="112" stroke="#b91c1c" strokeWidth="1.5" />
                <line x1="93" y1="102" x2="93" y2="111" stroke="#b91c1c" strokeWidth="1.5" />
                <line x1="56" y1="106" x2="104" y2="106" stroke="#b91c1c" strokeWidth="1.2" />
              </g>
            </g>
          </svg>

          {/* Stepping Dust Puffs */}
          <div className="dust-puff dust-left"></div>
          <div className="dust-puff dust-right"></div>
        </div>
      </div>
    </div>
  );
}
