"use client";
import React, { useState } from "react";
import Heading from "../utils/Heading";
import Navbar from "../components/Navbar/Navbar";
import Footer from "../components/Footer/Footer";
import FAQ from "../components/Route/FAQ";

type Props = {};

const Page = (props: Props) => {
  return (
    <div>
      <Heading
        title="FAQ - VIDTOUCH"
        description={
          "VIDTOUCH is an online editing marketplace with over 213000 videos and 62 million editors. Learn editing, marketing, and more."
        }
        keywords="editing community, editing skills, expert insights"
      />
      <div className="py-20">
        <FAQ />
      </div>
      <Footer />
    </div>
  );
};

export default Page;
