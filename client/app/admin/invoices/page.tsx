"use client";
import DashboardHero from "@/app/components/Admin/Dashboard/DashboardHero";
import AllInvoices from "@/app/components/Admin/Order/AllInvoices";
import AdminSidebar from "@/app/components/Admin/Sidebar/AdminSidebar";
import AdminProtected from "@/app/hooks/adminProtected";
import Heading from "@/app/utils/Heading";
import React from "react";

type Props = {};

const page = (props: Props) => {
  return (
    <>
      <AdminProtected>
        <Heading
          title="VIDTOUCH // Admin - All Invoices"
          description="VIDTOUCH is an online editing marketplace with over 213000 videos and 62 million editors. Learn editing, marketing, and more."
          keywords="editing community, editing skills, expert insights"
        />
        <div className="flex min-h-screen">
          <div className="1500px:w-[18%] w-1/5">
            <AdminSidebar />
          </div>
          <div className="w-[85%]">
            <DashboardHero />
            <AllInvoices />
          </div>
        </div>
      </AdminProtected>
    </>
  );
};

export default page;
