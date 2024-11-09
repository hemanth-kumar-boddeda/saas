"use client";
import React, { useState } from "react";
import Heading from "../utils/Heading";
import Navbar from "../components/Navbar/Navbar";
import About from "./About";
import Footer from "../components/Footer/Footer";

type Props = {};

const Page = (props: Props) => {
  return (
    <div>
      <Heading
        title="About us - VIDTOUCH"
        description={
          "VIDTOUCH is an online editing marketplace with over 213000 videos and 62 million editors. Learn editing, marketing, and more ."
        }
        keywords="editing community, editing skills, expert insights"
      />
      <About />
      <Footer />
    </div>
  );
};

export default Page;
