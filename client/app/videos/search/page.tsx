"use client";
import { redirect, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useSearchVideoQuery } from "@/redux/features/videos/videosApi";
import Loader from "../../components/Loader/Loader";
import Heading from "../../utils/Heading";
import Navbar from "../../components/Navbar/Navbar";
import Image from "next/image";
import VideoCard from "../../components/Cards/VideoCard";
import Footer from "../../components/Footer/Footer";
import { useRouter } from "next/navigation";
type Props = {};

const Page = (props: Props) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams?.get("title");
  const [videos, setVideos] = useState([]);

  // Use the mutation to search for videos
  // const pageNumber = parseInt(searchParams?.get("page") || "1", 10);
  // const limit = 1;
  const { data, isLoading } = useSearchVideoQuery(searchQuery, {});

  // const handlePageChange = (newPage: number) => {
  //   // Update the URL parameters to reflect the new page
  //   router.push(`/videos?page=${newPage}`);
  // };

  useEffect(() => {
    if (data) {
      setVideos(data?.videos);
    }
    // Check if query === ""
    if (searchQuery === "") {
      redirect("/");
    }
    // Check if the URL without any query parameters
    if (location.pathname === "/videos/search" && location.search === "") {
      // Redirect to the home page
      redirect("/");
    }
  }, [data, searchQuery]);

  return (
    <div className="pt-20">
      {isLoading ? (
        <Loader />
      ) : (
        <>
          <Heading
            title={`Search Results for "${searchQuery}" - M1LKY`}
            description={
              "VIDTOUCH is an online editing marketplace with over 213000 videos and 62 million editors. Learn editing, marketing, and more."
            }
            keywords="editing community, editing skills, expert insights"
          />
          {videos && videos.length === 0 && (
            <div className="flex items-center justify-center flex-col w-full h-[50vh] mt-4">
              <div className="w-[95%] 800px:w-[85%] m-auto py-8">
                <h1 className="font-[600] text-[26px] text-black dark:text-white">
                  Sorry, we could not find any results for {`"${searchQuery}"`}
                </h1>
              </div>
              <Image
                src={require("../../../../public/assets/no_data.png")}
                width={300}
                height={300}
                alt=""
              />
              <p className="dark:text-white text-black text-[20px]">
                {searchQuery
                  ? "No videos found"
                  : "No videos found in this category. Please try another one."}
              </p>
            </div>
          )}
          <div className="w-[95%] 800px:w-[85%] m-auto pb-16">
            {videos && videos.length > 0 && (
              <h1 className="font-[600] text-[26px] text-black dark:text-white py-8">
                {data.pagination.totalVideos} results for {`"${searchQuery}"`}
              </h1>
            )}

            <div className="grid grid-cols-1 gap-[20px] md:grid-cols-2 md:gap-[25px] lg:grid-cols-3 lg:gap-[25px] 1500px:grid-cols-4 1500px:gap-[35px] mb-12 border-0">
              {videos &&
                videos.map((item: any, index: number) => (
                  <VideoCard item={item} key={index} />
                ))}
            </div>
            {/* <div className="flex justify-center mt-4">
              {Array.from(
                { length: data?.pagination.totalPages || 1 },
                (_, index) => index + 1
              ).map((page) => (
                <button
                  key={page}
                  className={`mx-1 px-3 py-2 rounded-full focus:outline-none ${
                    page === data?.pagination.currentPage
                      ? "bg-[#5fbdff] text-white"
                      : "bg-transparent border dark:border-[#ff3377] border-[#5fbdff] dark:text-white text-black"
                  }`}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              ))}
            </div> */}
          </div>
          <Footer />
        </>
      )}
    </div>
  );
};

export default Page;
