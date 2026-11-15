"use client";
import Link from "next/link";
import React, { FC, useState } from "react";
import NavItems from "./NavItems";
import { ThemeSwitcher } from "../../utils/ThemeSwitcher";
import { HiOutlineMenuAlt3 } from "react-icons/hi";
import { BiSolidUser } from "react-icons/bi";
import MModal from "../Modal/MModal";
import Login from "../../components/Auth/Login";
import SignUp from "../../components/Auth/SignUp";
import Verification from "../../components/Auth/Verification";
import Image from "next/image";
import avatar from "../../../public/assets/avatar.png";
import { useLoadUserQuery } from "@/redux/features/api/apiSlice";
import { usePathname } from "next/navigation";

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  route: string;
  setRoute: (route: string) => void;
};

const Navbar: FC<Props> = ({ open, setOpen, route, setRoute }) => {
  const [active, setActive] = useState(false);
  const [openSidebar, setOpenSidebar] = useState(false);
  const {
    data: userData,
    refetch,
  } = useLoadUserQuery(undefined, {});
  const pathname = usePathname();

  if (typeof window !== "undefined") {
      window.addEventListener("scroll", () => {
        if (window.screenY > 85) {
          setActive(true);
        } else {
          setActive(false);
        }
      });
    }

  //   return () => {
  //     window.removeEventListener("scroll", handleScroll);
  //   };
  // }, []);

  const handleCloseSidebar = (e: any) => {
    if (e.target.id === "screen") {
      setOpenSidebar(false);
    }
  };

  return (
    <div className="w-full fixed top-0 left-0 z-[9999] backdrop-blur bg-transparent supports-backdrop-blur:bg-white/60 dark:bg-transparent transition duration-300">
      <div
        className={`${
          active
            ? "dark:bg-opacity-50 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black w-full h-[80px] dark:border-[#ffffff1c] shadow-xl transition duration-300"
            : "w-full border-b dark:border-[#ffffff1c] h-[80px] z-[80] dark:shadow"
        }`}
      >
        <div className="w-[95%] 800px:w-[92%] m-auto h-full">
          <div className="w-full h-[80px] flex items-center justify-between p-3">
            <div>
              <Link
                href={"/marketplace"}
                className={`text-[25px] font-Poppins font-[600] text-black dark:text-white whitespace-nowrap flex items-center`}
              >
                <Image
                  src={require("../../../public/assets/avatar.jpg")}
                  alt="logo"
                  width={50}
                  height={50}
                  className="w-[50px] h-[50px] object-cover"
                />
                <span className="ml-2 text-transparent bg-clip-text bg-gradient-to-r from-[#5FBDFF] to-[#ff3377] hidden lg:block">
                  V I D T O U C H
                </span>
              </Link>
            </div>
            <div className="flex items-center">
              <NavItems isMobile={false} />
              <ThemeSwitcher />
              <div className="hidden 800px:flex items-center justify-center mx-4">
                {userData ? (
                  <Link
                    href={"/profile"}
                    className={`${
                      pathname === "/profile"
                        ? "w-[30px] h-[30px] rounded-full border-solid border-2 border-[#5fbdff] dark:border-[#ff3377] overflow-hidden"
                        : "w-[30px] h-[30px] rounded-full border-solid border-2 border-[#000] dark:border-[#fff] overflow-hidden"
                    }`}
                  >
                    <Image
                      src={
                        userData?.user.avatar
                          ? userData.user.avatar.url
                          : avatar
                      }
                      alt="avatar"
                      width={30}
                      height={30}
                      className="cursor-pointer object-cover"
                    />
                  </Link>
                ) : (
                  <BiSolidUser
                    size={23}
                    className="cursor-pointer dark:text-white text-black"
                    onClick={() => setOpen(true)}
                  />
                )}
              </div>
              <div className="800px:hidden">
                <HiOutlineMenuAlt3
                  size={23}
                  className="cursor-pointer dark:text-white text-black"
                  onClick={() => setOpenSidebar(true)}
                />
              </div>
            </div>
          </div>
        </div>
        {/* mobile sidebar */}
        {openSidebar && (
          <div
            className="fixed w-full h-screen top-0 left-0 z-[9999] dark:bg-[0000005a] bg-[#0000005a]"
            onClick={handleCloseSidebar}
            id="screen"
          >
            <div className="w-[65%] fixed z-[99999] h-screen bg-white dark:bg-slate-900 top-0 right-0">
              <NavItems isMobile={true} />
              <div className="w-full flex justify-center">
                {userData ? (
                  <Link
                    href={"/profile"}
                    className={`${
                      pathname === "/profile"
                        ? "w-[30px] h-[30px] rounded-full border-solid border-2 border-[#5fbdff] dark:border-[#ff3377] overflow-hidden"
                        : "w-[30px] h-[30px] rounded-full border-solid border-2 border-[#000] dark:border-[#fff] overflow-hidden"
                    }`}
                  >
                    <Image
                      src={
                        userData?.user.avatar
                          ? userData.user.avatar.url
                          : avatar
                      }
                      alt="avatar"
                      width={30}
                      height={30}
                      className="cursor-pointer object-cover"
                    />
                  </Link>
                ) : (
                  <BiSolidUser
                    size={23}
                    className="cursor-pointer dark:text-white text-black"
                    onClick={() => setOpen(true)}
                  />
                )}
              </div>

              <p className="w-full text-[12px] absolute bottom-5 flex justify-center text-center text-black dark:text-white">
                Copyright © 2024 V I D T O U C H
              </p>
            </div>
          </div>
        )}
      </div>
      {/* Modals */}
      {route === "Login" && (
        <>
          {open && (
            <MModal
              open={open}
              setOpen={setOpen}
              setRoute={setRoute}
              component={Login}
              refetch={refetch}
            />
          )}
        </>
      )}
      {route === "Sign-Up" && (
        <>
          {open && (
            <MModal
              open={open}
              setOpen={setOpen}
              setRoute={setRoute}
              component={SignUp}
            />
          )}
        </>
      )}
      {route === "Verification" && (
        <>
          {open && (
            <MModal
              open={open}
              setOpen={setOpen}
              setRoute={setRoute}
              component={Verification}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Navbar;
