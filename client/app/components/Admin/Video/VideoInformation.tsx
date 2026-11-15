"use client"
import { styles } from '@/app/styles/style';
import Image from 'next/image';
import React, { FC, useState } from 'react'


type Props = {
  videoInfo: any;
  setVideoInfo: (videoInfo: any) => void;
  active: number;
  setActive: (active: number) => void;
}

const VideoInformation: FC<Props> = ({ videoInfo, setVideoInfo, active, setActive }) => {
  const [dragging, setDragging] = useState(false);
  const handleSubmit = (e: any) => {
    e.preventDefault();
    setActive(active + 1);
  };

  const handleFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        if (reader.readyState === 2) {
          setVideoInfo({ ...videoInfo, thumbnail: e.target.result })
        }
      };
      reader.readAsDataURL(file);

    }
  };
  const handleDragOver = (e: any) => {
    e.preventDefault();
    setDragging(true);
  }

  const handleDragLeave = (e: any) => {
    e.preventDefault();
    setDragging(false);
  }

  const handleDrop = (e: any) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setVideoInfo({ ...videoInfo, thumbnail: reader.result })
      }
      reader.readAsDataURL(file);
    }
  }
  return (
    <div className="flex justify-center items-center w-full h-full">
      <form onSubmit={handleSubmit} className={`${styles.label}`}>
        <div>
          <label htmlFor="name"> 
            Video Name
          </label>
         <input
         type="text"
         name=""
         id="name"
         required
         value={videoInfo.title}
         onChange={(e: any) => setVideoInfo({ ...videoInfo, title: e.target.value })}
         className={`${styles.input}`}
         placeholder="Video Name"
         />
        
        </div>
        <br />
        <div className="mb-5">
          <label className={`${styles.label}`}>
            Video Description
          </label>
          <textarea name="" id="" cols={30} rows={5}
            placeholder='Write something amazing...'
            className={` ${styles.input} !h-min !py-2`}
            value={videoInfo.description}
            onChange={(e: any) => setVideoInfo({ ...videoInfo, description: e.target.value })}
          ></textarea>

        </div>
        <br />
        <div className="w-full flex justify-between">
          <div className="w-[45%]">
            <label className={`${styles.label}`}>
              Video Price
            </label>
            <input
              type="number"
              name=""
              required
              value={videoInfo.price}
              onChange={(e: any) => setVideoInfo({ ...videoInfo, price: e.target.value })}
              id="price"
              placeholder="69"
              className={`${styles.input}`}
            />
          </div>
          <div className="w-[50%]">
            <label className={`${styles.label} w-[50%]`}>
              Estimated Price
            </label>
            <input
              type="number"
              name=""
              value={videoInfo.estimatedPrice}
              onChange={(e: any) => setVideoInfo({ ...videoInfo, estimatedPrice: e.target.value })}
              id="price"
              placeholder="99"
              className={`${styles.input}`}
            />
          </div>
        </div>
        <br />
        <div>
          <label className={`${styles.label} htmlFor="email"`}>
            Video Tags
          </label>
          <input
            type="text"
            name=""
            required
            value={videoInfo.tags}
            onChange={(e: any) => setVideoInfo({ ...videoInfo, tags: e.target.value })}
            id="tags"
            placeholder="Harkirat, VidTouch"
            className={`${styles.input}`}
          />

        </div>
        <br />
        <div className="w-full flex justify-between">
          <div className="w-[45%]">
            <label className={`${styles.label}`}>
              Video Level
            </label>
            <input
              type="text"
              name=""
              required
              value={videoInfo.level}
              onChange={(e: any) => setVideoInfo({ ...videoInfo, level: e.target.value })}
              id="level"
              placeholder="Beginner/Intermediate/Advanced"
              className={`${styles.input}`}
            />
          </div>
          <div className="w-[50%]">
            <label className={`${styles.label} w-[50%]`}>
              Video Demo Url
            </label>
            <input
              type="text"
              name=""
              required
              value={videoInfo.demoUrl}
              onChange={(e: any) => setVideoInfo({ ...videoInfo, demoUrl: e.target.value })}
              id="demoUrl"
              placeholder="https://youtu.be/..."
              className={`${styles.input}`}
            />
          </div>
        </div>
        <br />
        <div className="w-full">
          <input
            type="file"
            accept="image/*"
            id="file"
            className="hidden"
            onChange={handleFileChange}
          />
          <label htmlFor="file" className={`w-full min-h-[10vh] dark:border-white border-[#00000026] p-3 border flex items-center justify-center${dragging ? " bg-blue-500" : " bg-transparent"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {
              videoInfo.thumbnail ? (
                <Image src={videoInfo.thumbnail} alt="thumbnail" className="max-h-full w-full object-cover"/>
              ) : (
                <span className="dark:text-white text-black">
                  Drag & Drop Thumbnail Here or Click to Select
                </span>
              )
            }

          </label>
        </div>

        <br />
        <div className="w-full flex items-center justify-end">
          <input
            type="submit"
            value="Next"
            className="w-full 800px:w-[180px] h-[40px] bg-[#37a39a] text-center text-[#fff] rounded mt-8 cursor-pointer"
          />
        </div>
        <br />
        <br />
      </form>
    </div>
  );
};

export default VideoInformation;