"use client"
import DashboardHeader from '@/app/components/Admin/Dashboard/DashboardHeader'
import AdminSidebar from '@/app/components/Admin/Sidebar/AdminSidebar'
import AdminProtected from '@/app/hooks/adminProtected'
import Heading from '@/app/utils/Heading'
import AllUsers from '../../components/Admin/Users/AllUsers'
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
    <div className="flex h-screen">
      <div className=" w-1/5">
        <AdminSidebar/>
      </div>
      <div className="w-full min-h-screen">
        <DashboardHeader />
        <AllUsers isTeam={true} />
      </div>
    </div>
    </AdminProtected>
</div>
  )
}

export default page