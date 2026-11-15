"use client";
import React from "react";
import VideoDetailsPage from "../../components/Videos/VideoDetailsPage";

const page = ({ params }: { params: { id: string } }) => {
  return (
    <div className="pt-20">
      <VideoDetailsPage id={params.id} />
    </div>
  );
};

export default page;
