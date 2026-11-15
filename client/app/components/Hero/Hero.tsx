"use client";
import React, { FC, useState } from "react";
import Image from "next/image";
import { useGetLayoutDataQuery } from "@/redux/features/layout/layoutApi";
import Loader from "../Loader/Loader";
import { useRouter } from "next/navigation";

type Props = {};

const Hero: FC<Props> = (props) => {
  const { data, isLoading } = useGetLayoutDataQuery("Banner", {});
  const [search, setSearch] = useState("");
  const router = useRouter();

  const handleSearch = () => {
    if (search.trim() === "") return;
    router.push(`/videos/search?title=${search}`);
  };

  // Get banner image with fallback
  const bannerImage =
    data?.layout?.banner?.image?.url || "/assets/banner-img.png";

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <div className="grid max-w-screen-xl px-4 pb-8 mx-auto lg:gap-8 xl:gap-0 lg:grid-cols-12 min-h-screen">
          {/* Left section: Title + Subtitle + Search */}
          <div className="place-self-center lg:col-span-7 400px:mt-20 300px:mt-10">
            <h1 className="max-w-2xl my-4 text-4xl font-extrabold leading-none tracking-tight md:text-5xl xl:text-6xl text-black dark:text-white">
              {data?.layout?.banner?.title || "Discover Amazing Videos"}
            </h1>
            <p className="max-w-2xl mb-6 font-light text-gray-500 lg:mb-8 md:text-lg lg:text-xl dark:text-gray-400">
              {data?.layout?.banner?.subTitle ||
                "Explore, learn, and be inspired by creative content."}
            </p>
            <div>
              <div className="flex items-center bg-white rounded-lg overflow-hidden px-2 py-2 justify-between w-[95%] shadow-xl">
                <input
                  className="text-[16px] text-black flex-grow outline-none px-2 bg-white"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search Videos..."
                />
                <div className="flex items-center px-2 rounded-lg space-x-4 mx-auto">
                  <div
                    onClick={handleSearch}
                    className="dark:bg-[#ff3377] bg-[#5FBDFF] text-white font-Poppins font-semibold text-[16px] rounded-lg px-4 py-2 cursor-pointer"
                  >
                    Search
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right section: Banner image (visible on all screens) */}
          <div className="mt-10 lg:mt-0 lg:col-span-5 flex justify-center">
            <Image
              src={bannerImage}
              width={400}
              height={400}
              alt="hero-image"
              className="object-contain w-[90%] h-auto lg:w-[100%]"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Hero;
