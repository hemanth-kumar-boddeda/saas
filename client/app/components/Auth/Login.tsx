'use client'
import React, { FC, useEffect, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import { styles } from '../../../app/styles/style';
import {useLoginMutation} from '@/redux/features/auth/authApi';
import GoogleAuthButton from './GoogleAuthButton';
import toast from 'react-hot-toast';
type Props = {
    setRoute: (route: string) => void;
    setOpen: (open: boolean) => void;
    title?: string;
};

const schema = Yup.object().shape({
    email: Yup.string().email('Invalid email!').required("Please enter your email"),
    password: Yup.string().required("Please enter your password").min(6),
});

const Login: FC<Props> = ({ setRoute,setOpen, title = "Login with VidTouch" }) => {
    const [show, setShow] = useState(false);
    const [login,{isSuccess,error}] = useLoginMutation();
    const formik = useFormik({
        initialValues: {
            email: "",
            password: ""
        },
        validationSchema: schema,
        onSubmit: async ({ email, password }) => {
          await login({email,password})
            
        },
    });

    useEffect(() => {
       if(isSuccess){
        toast.success("Login successfully");
        setOpen(false);
       }
       if (error){
        if("data" in error){
            const errorData = error as any;
            toast.error(errorData.data.message);
        }
       }
    },[isSuccess, error, setOpen] )

    const { errors, touched, values, handleChange, handleSubmit } = formik;

    return (
        <div className="w-full ">
            <h1 className={styles.title}>
                {title}
            </h1>
            <form onSubmit={handleSubmit}>
                <label className={styles.label} htmlFor="email">
                    Enter your Email
                </label>
                <input
                    type="email"
                    name="email"
                    value={values.email}
                    onChange={handleChange}
                    id="email"
                    placeholder="loginmail@gmail.com"
                    className={`${errors.email && touched.email && "border-red-500"} ${styles.input}`}
                />
                {errors.email && touched.email && (
                    <span className="text-red-500 pt-2 block">{errors.email}</span>
                )}
                <div className="w-full mt-5 relative mb-1 text-black dark:text-white">
                    <label className={styles.label} htmlFor="password">
                        Enter your Password
                    </label>
                    <input
                        type={show ? "text" : "password"}
                        name="password"
                        value={values.password}
                        onChange={handleChange}
                        id="password"
                        placeholder="password!@%"
                        className={`${errors.password && touched.password && "border-red-500"} ${styles.input}`}
                    />
                    {!show ? (
                        <AiOutlineEyeInvisible
                            className="absolute bottom-3 right-2 z-1 cursor-pointer"
                            size={20}
                            onClick={() => setShow(true)}
                        />
                    ) : (
                        <AiOutlineEye
                            className="absolute bottom-3 right-2 z-1 cursor-pointer"
                            size={20}
                            onClick={() => setShow(false)}
                        />
                    )}
                    {errors.password && touched.password && (
                        <span className="text-red-500 pt-2 block">{errors.password}</span>
                    )}
                </div>
                <div className="w-full mt-5">
                    <input
                        type="submit"
                        value="Login"
                        className={`${styles.button}`}
                    />
                </div>
                <br/>
                <h5 className="text-center pt-4 font-Poppins text-[14px] text-black dark:text-white">
                        Or join with
                </h5>
                <div className="flex items-center justify-center my-3">
                    {/* SEC-01: server-verified Google sign-in. GitHub sign-in is
                        deliberately absent until a server-side code exchange exists. */}
                    <GoogleAuthButton
                        onSuccess={() => {
                            toast.success("Login successfully");
                            setOpen(false);
                        }}
                    />
                    </div>
                    <h5 className="text-center pt-4 font-Poppins text-[14px] text-black dark:text-white">
                        Dont have an account?{" "}
                        <span
                            className="text-[#2190ff] cursor-pointer pl-1"
                            onClick={() => setRoute("Sign-Up")}
                        >
                            Sign-Up
                        </span>

                    </h5>
            </form>
        </div>
    );
}

export default Login;
