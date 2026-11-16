"use client"
import "./globals.css";
import type { Metadata } from "next";
import { Josefin_Sans, Poppins } from "next/font/google";
import { ThemeProvider } from "./utils/theme-provider";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useEffect } from "react";
import { Providers } from "./Provider";
import { initializeApp } from "./../redux/store";
import { GeistSans } from "geist/font/sans";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-Poppins",
});

const josefin = Josefin_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-Josefin",
});


export default function RootLayout({ children }: { children: React.ReactNode; }) {
  useEffect(() => { initializeApp(); }, []);
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} ${josefin.variable} ${GeistSans.variable} !bg-white bg-no-repeat dark:bg-gradient-to-b dark:from-gray-900 dark:to-black duration-300`}
      >
        <div className="w-full h-full absolute top-0 bottom-0 bg-center bg-no-repeat bg-fixed bg-hero-light dark:bg-hero-dark duration-300 bg-cover z-[-1]"></div>
        <Providers>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              {children}
              <ToastContainer
                position="bottom-right"
                autoClose={5000}
                closeOnClick
                theme="dark"
              />
            </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}

