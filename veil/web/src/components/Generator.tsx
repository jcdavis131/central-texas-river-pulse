import { useEffect, useState } from "react";
import { generatePassword, passwordEntropyBits } from "../lib/generators";
import { CopyButton } from "./ui";

/** Standalone password generator with live options. */
export function Generator() {
  const [length, setLength] = useState(20);
  const [upper, setUpper] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [value, setValue] = useState("");

  function regenerate() {
    setValue(generatePassword({ length, upper, digits, symbols }));
  }

  // Regenerate whenever an option changes.
  useEffect(() => {
    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, upper, digits, symbols]);

  const bits = passwordEntropyBits(value);
  const strength = bits < 40 ? "weak" : bits < 70 ? "fair" : "strong";

  return (
    <div className="generator">
      <h2 className="page-title">Password generator</h2>
      <p className="page-sub">Strong, random passwords — generated on your device.</p>

      <div className="gen-output">
        <span className="gen-value mono">{value}</span>
        <div className="gen-output-actions">
          <CopyButton value={value} label="password" />
          <button className="copy-btn" onClick={regenerate}>↻ new</button>
        </div>
      </div>

      <div className={`strength strength-${strength}`}>
        <div className="strength-track">
          <div className="strength-fill" style={{ width: `${Math.min(100, bits)}%` }} />
        </div>
        <span className="strength-label">
          {strength[0].toUpperCase() + strength.slice(1)} · ~{bits} bits of entropy
        </span>
      </div>

      <div className="gen-controls">
        <label className="gen-length">
          <span>Length</span>
          <span className="gen-length-val mono">{length}</span>
          <input
            type="range"
            min={8}
            max={64}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
          />
        </label>

        <div className="toggles">
          <label className="toggle">
            <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} />
            Uppercase (A–Z)
          </label>
          <label className="toggle">
            <input type="checkbox" checked={digits} onChange={(e) => setDigits(e.target.checked)} />
            Digits (2–9)
          </label>
          <label className="toggle">
            <input type="checkbox" checked={symbols} onChange={(e) => setSymbols(e.target.checked)} />
            Symbols (!@#…)
          </label>
        </div>
      </div>
    </div>
  );
}
