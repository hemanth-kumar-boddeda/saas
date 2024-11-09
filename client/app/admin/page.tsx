"use client"
import DashboardHero from '../components/Admin/Dashboard/DashboardHero';
import AdminSidebar from '../components/Admin/Sidebar/AdminSidebar';
import AdminProtected from '../hooks/adminProtected';
import Heading from '../utils/Heading';
import React from "react";

type Props = {};


const page = (props: Props) => {
  return (
    <div>
      <AdminProtected>
        <Heading
          title="Admin - VidTouch"
          description="VidTouch is a platform for creators to edit videos and share them with their audience"
          keywords="VidTouch, video editing, editing, video"
        />
        <div className="flex min-h-screen"> 
          <div className="1500px:w-[18%] w-1/5"> 
            <AdminSidebar/>
          </div>
          <div className="w-[85%]"> 
          <DashboardHero isDashboard={true} />
          </div>
        </div>
      </AdminProtected>
    </div>
  );
}

export default page; 
