import { useGetAllVideoUserQuery } from "@/redux/features/videos/videosApi";
import React, { useEffect, useState } from "react";
import VideoCard from "../Cards/VideoCard";
import Loader from "../Loader/Loader";
import { useRouter } from "next/navigation";
import Lottie from "lottie-react";
import noDataAnimation from "../../../public/assets/no-data.json"; // make sure this path is correct

type Props = {};

const Videos = (props: Props) => {
  const router = useRouter();
  const { data, isLoading } = useGetAllVideoUserQuery({});
  const [topRated, setTopRated] = useState<any[]>([]);
  const [newest, setNewest] = useState<any[]>([]);
  const [popular, setPopular] = useState<any[]>([]);

  useEffect(() => {
    const videos = data?.videos || [];

    setTopRated(videos.filter((v: any) => v.ratings >= 4).slice(0, 8));
    setNewest(
      [...videos].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8)
    );
    setPopular(
      [...videos]
        .filter((v: any) => v.purchased >= 10)
        .sort((a, b) => b.purchased - a.purchased)
        .slice(0, 8)
    );
  }, [data]);

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center w-full h-96 mt-10">
      <Lottie animationData={noDataAnimation} loop={true} className="w-60 h-60" />
      <p className="mt-4 text-center text-gray-500 dark:text-gray-400 text-lg">
        No videos available right now. Check back later or explore other sections!
      </p>
    </div>
  );

  const renderSection = (title: string, videosArray: any[]) => (
    <section className="mb-12">
      <h2 className="font-Poppins text-2xl lg:text-3xl font-bold dark:text-white text-black mb-4">
        {title}
      </h2>
      {isLoading ? (
        <Loader />
      ) : videosArray.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 1500px:grid-cols-4 mb-6">
          {videosArray.map((item: any, index: number) => (
            <VideoCard item={item} key={index} />
          ))}
        </div>
      ) : (
        renderEmptyState()
      )}
    </section>
  );

  return (
    <div className="w-[90%] 800px:w-[80%] m-auto">
      <h1 className="text-center font-Poppins text-3xl sm:text-4xl lg:text-5xl font-bold text-black dark:text-white mb-8">
        Expand Your Video{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r dark:from-purple-400 dark:to-pink-600 from-[#96EFFF] to-[#5FBDFF]">
          Quality
        </span>
      </h1>

      {renderSection("Newest", newest)}
      {renderSection("Top Rated", topRated)}
      {renderSection("Popular", popular)}
    </div>
  );
};

export default Videos;
