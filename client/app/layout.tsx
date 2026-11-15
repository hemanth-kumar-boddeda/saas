"use client"
import "./globals.css";
import type { Metadata } from "next";
import { Josefin_Sans, Poppins } from "next/font/google";
import { ThemeProvider } from "./utils/theme-provider";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useEffect, useState } from "react";
import { Providers } from "./Provider";
import { useLoadUserQuery } from "./../redux/features/api/apiSlice";
import { initializeApp } from "./../redux/store";
import Loader from "./components/Loader/Loader";
import MainLayout from "./layouts/MainLayout";
import { usePathname } from "next/navigation";
import socketIO from "socket.io-client";
import { GeistSans } from "geist/font/sans";

const ENDPOINT = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || "";

// Marketing pages are public: no app shell, no session probe, no socket.
const MARKETING_ROUTES = ["/", "/login", "/signup", "/privacy"];

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
  const pathname = usePathname();
  const isMarketing = MARKETING_ROUTES.includes(pathname || "");
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} ${josefin.variable} ${GeistSans.variable} !bg-white bg-no-repeat dark:bg-gradient-to-b dark:from-gray-900 dark:to-black duration-300`}
      >
        <div className="w-full h-full absolute top-0 bottom-0 bg-center bg-no-repeat bg-fixed bg-hero-light dark:bg-hero-dark duration-300 bg-cover z-[-1]"></div>
        <Providers>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              {isMarketing ? (
                <>{children}</>
              ) : (
                <Custom>
                  {pathname?.includes("admin") ? (
                    <>{children}</>
                  ) : (
                    <MainLayout>{children}</MainLayout>
                  )}
                </Custom>
              )}
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


const Custom: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading } = useLoadUserQuery(undefined, {});

  const [loadingPage, setLoadingPage] = useState(false);

  useEffect(() => {
    initializeApp();
    const socketId = socketIO(ENDPOINT, {
      transports: ["websocket"],
      withCredentials: true,
    });
    socketId.on("connect", () => {});

    const handleStart = (url: any) => {
      if (url !== window.location.pathname) {
        setLoadingPage(true);
      }
    };

    const handleComplete = (url: any) => {
      if (url !== window.location.pathname) {
        setLoadingPage(false);
      }
    };

    const handleRouteChange = (url: any) => {
      handleStart(url);
    };

    window.addEventListener("popstate", handleRouteChange);

    return () => {
      window.removeEventListener("popstate", handleRouteChange);
      socketId.disconnect();
    };
  }, []);

  return <>{loadingPage && isLoading ? <Loader /> : <>{children}</>}</>;
};
