"use client"
import React, { FC } from "react";
import Footer from "../components/Footer/Footer";
import Hero from "../components/Hero/Hero";
import FAQ from "../components/Route/FAQ";
import Reviews from "../components/Route/Reviews";
import Videos from "../components/Route/Videos";
import Heading from "../utils/Heading";

interface Props {}

// The CreatorFlow landing page lives at "/". The marketplace keeps the original
// VidTouch home page here.
const Page: FC<Props> = (props) => {
  return (
    <div>
      <Heading
        title="VIDTOUCH // Learning Management System"
        description="VIDTOUCH is an online editing marketplace with over 213000 videos and 62 million editors. Learn editing, marketing, and more."
        keywords="editing community, editing skills, expert insights"
      />
      <Hero />
      <Videos />
      <Reviews />
      <FAQ />
      <Footer />
    </div>
  );
};

export default Page;
