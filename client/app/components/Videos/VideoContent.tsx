import { useGetVideoContentQuery } from "@/redux/features/videos/videosApi";
import React, { useState } from "react";
import Loader from "../Loader/Loader";
import Heading from "@/app/utils/Heading";
import VideoContentMedia from "./VideoContentMedia";
import VideoContentList from "./VideoContentList";
import Footer from "../Footer/Footer";

type Props = {
  id: string;
  user: any;
};

const VideoContent = ({ id, user }: Props) => {
  const {
    data: contentData,
    isLoading,
    refetch,
  } = useGetVideoContentQuery(id, {
    refetchOnMountOrArgChange: true,
  });
  const data = contentData?.content;
  const [activeVideo, setActiveVideo] = useState(0);
  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <>
          <div className="w-full grid 800px:grid-cols-10">
            <Heading
              title={data[activeVideo]?.title}
              description={data[activeVideo]?.description}
              keywords={data[activeVideo]?.tags}
            />
            <div className="col-span-7">
              <VideoContentMedia
                data={data}
                user={user}
                id={id}
                activeVideo={activeVideo}
                setActiveVideo={setActiveVideo}
                refetch={refetch}
              />
            </div>
            <div className="hidden 800px:block 800px:col-span-3">
              <VideoContentList
                data={data}
                activeVideo={activeVideo}
                setActiveVideo={setActiveVideo}
              />
            </div>
          </div>
          <Footer />
        </>
      )}
    </>
  );
};

export default VideoContent;
