'use client'
import React, { FC, useEffect, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import { useLoginMutation } from '@/redux/features/auth/authApi';
import GoogleAuthButton from './GoogleAuthButton';
import { toast } from 'react-toastify';

type Props = { onDone: () => void };

const schema = Yup.object().shape({
  email: Yup.string().email('Enter a valid email').required('Enter your email'),
  password: Yup.string().required('Enter your password').min(6, 'At least 6 characters'),
});

const Login: FC<Props> = ({ onDone }) => {
  const [show, setShow] = useState(false);
  const [login, { isSuccess, isLoading, error }] = useLoginMutation();
  const formik = useFormik({
    initialValues: { email: '', password: '' },
    validationSchema: schema,
    onSubmit: async ({ email, password }) => { await login({ email, password }); },
  });

  useEffect(() => {
    if (isSuccess) { toast.success('Signed in'); onDone(); }
    if (error) toast.error((error as any)?.data?.message || 'Could not sign in. Check your connection and try again.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, error]);

  const { errors, touched, values, handleChange, handleBlur, handleSubmit } = formik;
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-cf-muted" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="you@studio.com" className="cf-input" value={values.email} onChange={handleChange} onBlur={handleBlur} aria-invalid={!!(errors.email && touched.email)} />
        {errors.email && touched.email && <p role="alert" className="mt-1 text-xs text-red-300">{errors.email}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm text-cf-muted" htmlFor="password">Password</label>
        <div className="relative">
          <input id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" className="cf-input pr-10" value={values.password} onChange={handleChange} onBlur={handleBlur} aria-invalid={!!(errors.password && touched.password)} />
          <button type="button" aria-label={show ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-3 text-cf-muted hover:text-cf-text" onClick={() => setShow(!show)}>
            {show ? <AiOutlineEye size={18} /> : <AiOutlineEyeInvisible size={18} />}
          </button>
        </div>
        {errors.password && touched.password && <p role="alert" className="mt-1 text-xs text-red-300">{errors.password}</p>}
      </div>
      <button type="submit" className="cf-btn cf-btn-primary w-full py-2.5" disabled={isLoading}>{isLoading ? 'Signing in…' : 'Sign in'}</button>
      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
        <>
          <div className="flex items-center gap-3 text-xs text-cf-muted"><span className="h-px flex-1 bg-cf-line" />or<span className="h-px flex-1 bg-cf-line" /></div>
          <div className="flex justify-center"><GoogleAuthButton onSuccess={() => { toast.success('Signed in'); onDone(); }} /></div>
        </>
      )}
    </form>
  );
};

export default Login;
