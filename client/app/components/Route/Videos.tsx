import { useGetAllVideoUserQuery } from "@/redux/features/videos/videosApi";
import React, { useEffect, useState } from "react";
import VideoCard from "../Cards/VideoCard";
import Loader from "../Loader/Loader";

type Props = {};

const Videos = (props: Props) => {
  const { data, isLoading } = useGetAllVideoUserQuery({});
  const [topRated, setTopRated] = useState<any[]>([]);
  const [newest, setNewest] = useState<any[]>([]);
  const [popular, setPopular] = useState<any[]>([]);
  useEffect(() => {
    // Filter videos with rating >= 4
    const sortTopRatedVideos = [...(data?.videos || [])].filter(
      (video: any) => video?.ratings >= 4
    );
    const topRatedVideos = sortTopRatedVideos.slice(0, 8);
    setTopRated(topRatedVideos);
    // Filter
    const sortNewestVideos = [...(data?.videos || [])].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const newestVideos = sortNewestVideos.slice(0, 8);
    setNewest(newestVideos);
    // Filter popular videos
    const sortPopularVideos = [...(data?.videos || [])]
      .filter((video: any) => video.purchased >= 10)
      .sort((a, b) => b.purchased - a.purchased);
    const popularVideos = sortPopularVideos.slice(0, 8);
    setPopular(popularVideos);
  }, [data]);

  return (
    <div>
      <div className={`w-[90%] 800px:w-[80%] m-auto`}>
        <h1 className="text-center font-Poppins text-[25px] leading-[35px] sm:text-3l lg:text-4xl dark:text-white 800px:!leading-[60px] text-[#000] font-[700] tracking-tight">
          Expand Your Video{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r dark:from-purple-400 dark:to-pink-600 from-[#96EFFF] to-[#5FBDFF]">
            Quality
          </span>{" "}
          <br />
          With Our Videos
        </h1>
        <br />
        <br />
        {/* Newest */}
        <section>
          <h1 className="font-Poppins text-[20px] leading-[35px] sm:text-2l lg:text-3xl dark:text-white 800px:!leading-[60px] text-[#000] font-[700] tracking-tight mb-4">
            Newest
          </h1>
          {isLoading ? (
            <Loader />
          ) : (
            <div className="grid grid-cols-1 gap-[20px] md:grid-cols-2 md:gap-[25px] lg:grid-cols-3 lg:gap-[25px] 1500px:grid-cols-4 1500px:gap-[35px] mb-20 border-0">
              {newest.map((item: any, index: number) => (
                <>
                  <VideoCard item={item} key={index} />
                </>
              ))}
            </div>
          )}
        </section>
        {/* Top Rated */}
        <section>
          <h1 className="font-Poppins text-[20px] leading-[35px] sm:text-2l lg:text-3xl dark:text-white 800px:!leading-[60px] text-[#000] font-[700] tracking-tight mb-4">
            Top Rated
          </h1>
          {isLoading ? (
            <Loader />
          ) : (
            <div className="grid grid-cols-1 gap-[20px] md:grid-cols-2 md:gap-[25px] lg:grid-cols-3 lg:gap-[25px] 1500px:grid-cols-4 1500px:gap-[35px] mb-20 border-0">
              {topRated.map((item: any, index: number) => (
                <>
                  <VideoCard item={item} key={index} />
                </>
              ))}
            </div>
          )}
        </section>
        {/* Popular */}
        <section>
          <h1 className="font-Poppins text-[20px] leading-[35px] sm:text-2l lg:text-3xl dark:text-white 800px:!leading-[60px] text-[#000] font-[700] tracking-tight mb-4">
            Popular
          </h1>
          {isLoading ? (
            <Loader />
          ) : (
            <div className="grid grid-cols-1 gap-[20px] md:grid-cols-2 md:gap-[25px] lg:grid-cols-3 lg:gap-[25px] 1500px:grid-cols-4 1500px:gap-[35px] mb-20 border-0">
              {popular.map((item: any, index: number) => (
                <>
                  <VideoCard item={item} key={index} />
                </>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Videos;
