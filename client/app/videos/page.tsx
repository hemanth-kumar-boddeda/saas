"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useGetAllVideoUserQuery } from "@/redux/features/videos/videosApi";
import { useGetLayoutDataQuery } from "@/redux/features/layout/layoutApi";
import Loader from ".././components/Loader/Loader";
import VideoCard from ".././components/Cards/VideoCard";
import Footer from ".././components/Footer/Footer";
import Lottie from "lottie-react";
import noDataAnimation from "@/public/assets/no-data.json";

const VideosContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageNumber = parseInt(searchParams?.get("page") || "1", 10);
  const limit = 8;

  const { data, isLoading } = useGetAllVideoUserQuery({ pageNumber, limit });
  const { data: categoriesData } = useGetLayoutDataQuery("Categories", {});

  const [videos, setVideos] = useState<any[]>([]);
  const [category, setCategory] = useState("");
  const [totalPage, setTotalPage] = useState(1);

  const categories = categoriesData?.layout?.categories || [];

  useEffect(() => {
    // Always ensure videos is an array
    setVideos(data?.videos || []);
    setTotalPage(data?.pagination?.totalPages || 1);
  }, [data]);

  const handlePageChange = (newPage: number) => {
    router.push(`/videos?page=${newPage}`);
  };

  useEffect(() => {
    if (!category) return;

    const fetchByCategory = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_SERVER_URL;
        if (!apiUrl) {
          throw new Error("NEXT_PUBLIC_SERVER_URL is not configured");
        }
        const url = new URL("videos/get-videos", apiUrl);
        url.search = new URLSearchParams({
          category,
          page: String(pageNumber),
          limit: String(limit),
        }).toString();
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
          throw new Error(`Video request failed with status ${res.status}`);
        }
        const result = await res.json();
        setVideos(result.videos || []);
        setTotalPage(result.pagination?.totalPages || 1);
      } catch (err) {
        console.error("Error fetching category videos:", err);
        setVideos([]); // fallback
      }
    };

    fetchByCategory();
  }, [category, pageNumber]);

  return (
    <div className="pt-20 min-h-screen bg-gray-50 dark:bg-gray-900">
      {isLoading ? (
        <Loader />
      ) : (
        <div className="w-[95%] 800px:w-[85%] m-auto pb-16">
          <h1 className="text-3xl md:text-4xl font-bold dark:text-white text-gray-900 py-6">
            Explore Videos
          </h1>

          {/* Categories */}
          <div className="flex flex-wrap items-center mb-6">
            <button
              className={`mx-1 my-2 px-6 py-2 rounded-full font-semibold transition ${
                category === ""
                  ? "bg-[#5FBDFF] dark:bg-[#ff3377] text-white"
                  : "bg-transparent border border-[#5FBDFF] dark:border-[#ff3377] text-gray-900 dark:text-white"
              }`}
              onClick={() => {
                setCategory("");
                handlePageChange(1);
              }}
            >
              All
            </button>
            {categories.map((cat: any) => (
              <button
                key={cat._id}
                className={`mx-1 my-2 px-6 py-2 rounded-full font-semibold transition ${
                  category === cat._id
                    ? "bg-[#5FBDFF] dark:bg-[#ff3377] text-white"
                    : "bg-transparent border border-[#5FBDFF] dark:border-[#ff3377] text-gray-900 dark:text-white"
                }`}
                onClick={() => {
                  setCategory(cat._id);
                  handlePageChange(1);
                }}
              >
                {cat.title}
              </button>
            ))}
          </div>

          {/* Videos Grid */}
          {videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[50vh]">
              <Lottie
                animationData={noDataAnimation}
                loop
                className="w-[250px] md:w-[400px] mb-4"
              />
              <p className="text-lg md:text-xl dark:text-white text-gray-700">
                No videos found in this category. Try another one!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 1500px:grid-cols-4 mb-6">
              {videos.map((item: any, index: number) => (
                <VideoCard item={item} key={index} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {videos.length > 0 && (
            <div className="flex justify-center mt-4 flex-wrap">
              {Array.from({ length: totalPage }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`mx-1 my-1 w-[35px] h-[35px] flex items-center justify-center rounded-full font-semibold transition ${
                    page === pageNumber
                      ? "bg-[#5FBDFF] dark:bg-[#ff3377] text-white"
                      : "bg-transparent border border-[#5FBDFF] dark:border-[#ff3377] text-gray-900 dark:text-white"
                  }`}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              ))}
            </div>
          )}

          <Footer />
        </div>
      )}
    </div>
  );
};

const VideosPage: React.FC = () => (
  <React.Suspense fallback={<Loader />}>
    <VideosContent />
  </React.Suspense>
);

export default VideosPage;
