"use client";
import React, { FC, useState } from "react";
import Protected from "../hooks/useProtected";
import Heading from "../utils/Heading";
import Navbar from "../components/Navbar/Navbar";
import Profile from "../components/Profile/Profile";
import { useSelector } from "react-redux";
import { useLoadUserQuery } from "../../redux/features/api/apiSlice";
import Footer from "../components/Footer/Footer";

type Props = {};

const Page: FC<Props> = (props: Props) => {
  const [open, setOpen] = useState(false);
  const [route, setRoute] = useState("Login");
  // const { user } = useSelector((state: any) => state.auth);
  const { data: userData } = useLoadUserQuery(undefined, {});
  const user = userData?.user;

  return (
    <div>
      <Protected>
        <Heading
          title={`${user?.name} // My Profile`}
          description="VIDTOUCH is an online editing marketplace with over 213000 videos and 62 million editors. Learn editing, marketing, and more."
          keywords="editing community, editing skills, expert insights"
        />
        <Profile user={user} />
        <Footer />
      </Protected>
    </div>
  );
};

export default Page;
