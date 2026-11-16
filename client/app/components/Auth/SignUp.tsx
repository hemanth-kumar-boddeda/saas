'use client'
import React, { FC, useEffect, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import { useRegisterMutation } from '@/redux/features/auth/authApi';
import { toast } from 'react-toastify';

type Props = { onRegistered: () => void };

const schema = Yup.object().shape({
  name: Yup.string().trim().required('Enter your name'),
  email: Yup.string().email('Enter a valid email').required('Enter your email'),
  password: Yup.string().required('Choose a password').min(6, 'At least 6 characters'),
});

const SignUp: FC<Props> = ({ onRegistered }) => {
  const [show, setShow] = useState(false);
  const [register, { data, error, isSuccess, isLoading }] = useRegisterMutation();

  useEffect(() => {
    if (isSuccess) { toast.success(data?.message || 'Check your email for the code'); onRegistered(); }
    if (error) toast.error((error as any)?.data?.message || 'Could not sign up. Try again.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, error]);

  const formik = useFormik({
    initialValues: { name: '', email: '', password: '' },
    validationSchema: schema,
    onSubmit: async (v) => { await register(v); },
  });
  const { errors, touched, values, handleChange, handleBlur, handleSubmit } = formik;
  const err = (k: 'name' | 'email' | 'password') => errors[k] && touched[k] && <p role="alert" className="mt-1 text-xs text-red-300">{errors[k]}</p>;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-cf-muted" htmlFor="name">Name</label>
        <input id="name" name="name" autoComplete="name" placeholder="Your name" className="cf-input" value={values.name} onChange={handleChange} onBlur={handleBlur} />
        {err('name')}
      </div>
      <div>
        <label className="mb-1 block text-sm text-cf-muted" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="you@studio.com" className="cf-input" value={values.email} onChange={handleChange} onBlur={handleBlur} />
        {err('email')}
      </div>
      <div>
        <label className="mb-1 block text-sm text-cf-muted" htmlFor="password">Password</label>
        <div className="relative">
          <input id="password" name="password" type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 6 characters" className="cf-input pr-10" value={values.password} onChange={handleChange} onBlur={handleBlur} />
          <button type="button" aria-label={show ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-3 text-cf-muted hover:text-cf-text" onClick={() => setShow(!show)}>
            {show ? <AiOutlineEye size={18} /> : <AiOutlineEyeInvisible size={18} />}
          </button>
        </div>
        {err('password')}
      </div>
      <button type="submit" className="cf-btn cf-btn-primary w-full py-2.5" disabled={isLoading}>{isLoading ? 'Creating account…' : 'Create account'}</button>
    </form>
  );
};

export default SignUp;
