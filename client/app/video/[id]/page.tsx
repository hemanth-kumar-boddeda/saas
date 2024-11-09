"use client";
import React from "react";
import VideoDetailsPage from "../../components/Videos/VideoDetailsPage";
type Props = {};

const page = ({ params }: any) => {
  return (
    <div className="pt-20">
      <VideoDetailsPage id={params.id} user={undefined} />
    </div>
  );
};

export default page;
