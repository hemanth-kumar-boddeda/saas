"use client"
import AdminProtected from '@/app/hooks/adminProtected';
import Heading from '../../../../app/utils/Heading';
import DashboardHero from '../../../components/Admin/Dashboard/DashboardHero';
import AdminSidebar from '../../../components/Admin/Sidebar/AdminSidebar';
import EditVideo from '../../../components/Admin/Video/EditVideo';
import React from "react";
type Props = {}

const page = ({params}:any) => {
    const id = params?.id;

  return (
    <div>
      <AdminProtected>
        <Heading 
          title="VIDTOUCH // Admin - Edit Video"
          description="VidTouch is a platform for creators to edit videos and share them with their audience"
          keywords="VidTouch, video editing, editing, video"
        />
        <div className="flex">
          <div className="1500px:w-[18%] w-1/5">
            <AdminSidebar/>
          </div>
          <div className="w-[85%]">
            <DashboardHero />
            <EditVideo id={id}/>
          </div>
        </div>
        </AdminProtected>
    </div>
  )
}

export default page;