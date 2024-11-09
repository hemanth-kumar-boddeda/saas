"use client";
import React, { useState } from "react";
import Heading from "../utils/Heading";
import Navbar from "../components/Navbar/Navbar";
import Footer from "../components/Footer/Footer";
import Policy from "./Policy";

type Props = {};

const Page = (props: Props) => {
  return (
    <div>
      <Heading
        title="Policy - VIDTOUCH"
        description={
          "VIDTOUCH is an online editing marketplace with over 213000 videos and 62 million editors. Learn editing, marketing, and more."
        }
        keywords="editing community, editing skills, expert insights"
      />
      <Policy />
      <Footer />
    </div>
  );
};

export default Page;
