'use client'
import React, { FC, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import { useActivationMutation } from '@/redux/features/auth/authApi';

const Verification: FC<{ onVerified: () => void }> = ({ onVerified }) => {
  const { token } = useSelector((state: any) => state.auth);
  const [activation, { isSuccess, isLoading, error }] = useActivationMutation();
  const [digits, setDigits] = useState(['', '', '', '']);
  const [bad, setBad] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isSuccess) { toast.success('Account activated. Sign in to continue.'); onVerified(); }
    if (error) { toast.error((error as any)?.data?.message || 'Could not verify'); setBad(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, error]);

  const set = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    setBad(false);
    setDigits((p) => p.map((x, j) => (j === i ? d : x)));
    if (d && i < 3) refs.current[i + 1]?.focus();
  };
  const paste = (e: React.ClipboardEvent) => {
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (t.length === 4) { e.preventDefault(); setDigits(t.split('')); refs.current[3]?.focus(); }
  };
  const submit = () => {
    const code = digits.join('');
    if (code.length !== 4) return setBad(true);
    if (!token) return toast.error('Session expired. Go back and sign up again.');
    activation({ active_code: code, active_token: token });
  };

  return (
    <div>
      <div className="flex justify-between gap-3" onPaste={paste}>
        {digits.map((d, i) => (
          <input
            key={i} ref={(el) => { refs.current[i] = el; }} inputMode="numeric" autoComplete="one-time-code" aria-label={`Digit ${i + 1}`}
            className={`cf-input h-16 text-center text-2xl ${bad ? 'shake !border-red-400' : ''}`} value={d}
            onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus(); if (e.key === 'Enter') submit(); }}
          />
        ))}
      </div>
      {bad && <p role="alert" className="mt-2 text-xs text-red-300">Enter the 4 digit code from your email.</p>}
      <button className="cf-btn cf-btn-primary mt-5 w-full py-2.5" onClick={submit} disabled={isLoading}>{isLoading ? 'Verifying…' : 'Verify and activate'}</button>
    </div>
  );
};

export default Verification;
