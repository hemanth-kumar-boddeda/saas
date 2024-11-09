"use client"
import React, { FC, useState } from "react";
import Footer from "./components/Footer/Footer";
import Hero from "./components/Hero/Hero";
import FAQ from "./components/Route/FAQ";
import Reviews from "./components/Route/Reviews";
import Videos from "./components/Route/Videos";
import Heading from "./utils/Heading";
import Navbar from "./components/Navbar/Navbar";
interface Props {}

const Page: FC<Props> = (props) => {
  const [open, setOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(0);
  const [route, setRoute] = useState("Login");
  return (
    <div>
      <Heading
        title="VIDTOUCH // Learning Management System"
        description="VIDTOUCH is an online editing marketplace with over 213000 videos and 62 million editors. Learn editing, marketing, and more."
        keywords="editing community, editing skills, expert insights"
      />
        
      {/* <Navbar
        open={open}
        setOpen={setOpen}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        route={route}
        setRoute={setRoute}
      /> */}
      <Hero />
      <Videos />
      <Reviews />
      <FAQ />
      <Footer />
    </div>
  );
};

export default Page;