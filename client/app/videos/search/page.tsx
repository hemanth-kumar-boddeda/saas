"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSearchVideoQuery } from "@/redux/features/videos/videosApi";
import Loader from "../.././components/Loader/Loader";
import VideoCard from "../.././components/Cards/VideoCard";
import Footer from "../.././components/Footer/Footer";
import Lottie from "lottie-react";
import noDataAnimation from "../../../public/assets/no-data.json";

type Props = {};

const SearchContent: React.FC<Props> = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams?.get("title") || "";
  const [videos, setVideos] = useState<any[]>([]);

  const { data, isLoading } = useSearchVideoQuery(searchQuery, {});

  useEffect(() => {
    if (searchQuery.trim() === "") {
      router.replace("/videos");
      return;
    }
    if (data) setVideos(data.videos || []);
  }, [data, router, searchQuery]);

  return (
    <div className="pt-20 min-h-screen bg-gray-50 dark:bg-gray-900">
      {isLoading ? (
        <Loader />
      ) : videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center w-full h-[60vh] text-center px-4">
          <Lottie
            animationData={noDataAnimation}
            loop
            className="w-[250px] md:w-[400px] mb-6"
          />
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mb-2">
            No results found for <span className="text-[#5FBDFF]">{`"${searchQuery}"`}</span>
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Try a different keyword or explore our video library.
          </p>
        </div>
      ) : (
        <div className="w-[95%] 800px:w-[85%] m-auto pb-16">
          <h1 className="font-bold text-2xl md:text-3xl dark:text-white text-gray-900 py-6">
            {data?.pagination?.totalVideos || videos.length} results for{" "}
            <span className="text-[#5FBDFF]">{`"${searchQuery}"`}</span>
          </h1>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 1500px:grid-cols-4 mb-12">
            {videos.map((item: any, index: number) => (
              <VideoCard item={item} key={index} />
            ))}
          </div>
          <Footer />
        </div>
      )}
    </div>
  );
};

const SearchPage: React.FC<Props> = () => (
  <React.Suspense fallback={<Loader />}>
    <SearchContent />
  </React.Suspense>
);

export default SearchPage;
