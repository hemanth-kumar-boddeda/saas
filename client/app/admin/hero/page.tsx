"use client"
import EditHero from '@/app/components/Admin/Customization/EditHero';
import DashboardHero from '@/app/components/Admin/Dashboard/DashboardHero';
import AdminSidebar from '@/app/components/Admin/Sidebar/AdminSidebar';
import AdminProtected from '@/app/hooks/adminProtected';
import Heading from '@/app/utils/Heading';

type Props = {}

const page = (props: Props) => {
  return (
    <div>

      <AdminProtected>
        <Heading
        title="VIDTOUCH - Admin"
        description="VIDTOUCH is an online editing marketplace with over 213000 videos and 62 million editors. Learn editing, marketing, and more."
        keywords="editing community, editing skills, expert insights"
        />
        <div className="flex h-screen">
            <div className="1500px:w-[16%] w-1/5">
                <AdminSidebar />
            </div>
            <div className="w-[85%]">
                <DashboardHero />
                <EditHero />
            </div>
        </div>
    </AdminProtected>
    </div>
  )
}

export default page