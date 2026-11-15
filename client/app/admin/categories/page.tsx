"use client";
import EditCategories from "@/app/components/Admin/Customization/EditCategories";
import DashboardHero from "@/app/components/Admin/Dashboard/DashboardHero";
import AdminSidebar from "@/app/components/Admin/Sidebar/AdminSidebar";
import AdminProtected from "@/app/hooks/adminProtected";
import Heading from "@/app/utils/Heading";

type Props = {};

const page = (props: Props) => {
  return (
    <>
      <AdminProtected>
        <Heading
                  title="VIDTOUCH // Admin - Categories"
                  description="VIDTOUCH is an online editing marketplace with over 213000 videos and 62 million editors. Learn editing, marketing, and more." keywords={""}        />
        <div className="flex min-h-screen">
          <div className="1500px:w-[18%] w-1/5">
            <AdminSidebar />
          </div>
          <div className="w-[85%]">
            <DashboardHero />
            <EditCategories />
          </div>
        </div>
      </AdminProtected>
    </>
  );
};

export default page;
