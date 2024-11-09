"use client"
import AdminProtected from '@/app/hooks/adminProtected';
import Heading from '../../../app/utils/Heading';
import DashboardHero from '../../components/Admin/Dashboard/DashboardHero';
import AdminSidebar from '../../components/Admin/Sidebar/AdminSidebar';
import CreateVideo from '../../components/Admin/Video/CreateVideo';
import React from "react";
type Props = {}

const page = (props: Props) => {
  return (
    <div>
      <AdminProtected>
        <Heading 
          title="Admin - VidTouch"
          description="VidTouch is a platform for creators to edit videos and share them with their audience"
          keywords="VidTouch, video editing, editing, video"
        />
        <div className="flex">
          <div className=" w-1/5">
            <AdminSidebar/>
          </div>
          <div className="w-full min-h-screen">
            <DashboardHero />
            <CreateVideo />
          </div>
        </div>
        </AdminProtected>
    </div>
  )
}

export default page;