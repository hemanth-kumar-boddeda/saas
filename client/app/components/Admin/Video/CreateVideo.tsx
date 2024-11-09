"use client"
import React, { useEffect, useState } from 'react'
import VideoInformation from './VideoInformation';
import VideoOptions from './VideoOptions';
import VideoData from './VideoData';
import VideoContent from './VideoContent';
import VideoPreview from './VideoPreview';
import { useCreateVideoMutation } from '@/redux/features/videos/videosApi';
import { redirect } from 'next/navigation';
import toast from 'react-hot-toast';
type Props = {}

const CreateVideo = (props: Props) => {
  const [createVideo,{isLoading,isSuccess,error}] = useCreateVideoMutation();
  useEffect(() => {
    if(isSuccess){
      toast.success("Video created successfully");
      redirect("/admin/videos");
    }
    if(error){
    if("data" in error){
      const errorMessage = error as any;
      toast.error(errorMessage.data.message);
    }
    }
  },[isLoading,isSuccess,error]);
  const [active, setActive] = useState(0);
  const [videoInfo, setVideoInfo] = useState({
    name: "",
    description: "",
    price:"",
    estimatedPrice:"",
    tags:"",
    level:"",
    demoUrl:"",
    thumbnail:"",
  });
  const [benefits, setBenefits] = useState([{title:""}]);
  const [prerequisites, setPrerequisites] = useState([{title:""}]);
  const [videoContentData, setVideoContentData] = useState([{
    videoUrl:"",
    title:"",
    description:"",
    videoSection:"Untitled Section",
    links: [
      {
        title:"",
        url:"",
      },
    ],
    suggestion:"",
  }]);

  const [videoData, setVideoData] = useState({});
  const handleSubmit = async () => {
    const formattedBenefits = benefits.map((benefit) => ({title: benefit.title}));
    const formattedPrerequisites = prerequisites.map((prerequisite) => ({title: prerequisite.title}));
    const formattedVideoContentData = videoContentData.map((videoContent) => ({
      videoUrl: videoContent.videoUrl,
      title: videoContent.title,
      description: videoContent.description,
      videoSection: videoContent.videoSection,
      links: videoContent.links.map((link) => ({
        title: link.title,
        url: link.url,
      })),
      suggestion: videoContent.suggestion,
    }));


    const data = {
      name: videoInfo.name,
      description: videoInfo.description,
      price: videoInfo.price,
      estimatedPrice: videoInfo.estimatedPrice,
      tags: videoInfo.tags,
      thumbnail: videoInfo.thumbnail,
      level: videoInfo.level,
      demoUrl: videoInfo.demoUrl,
      totalVideos: videoContentData.length,
      benefits: formattedBenefits,
      prerequisites: formattedPrerequisites,
      videoContent: formattedVideoContentData,
    };
    setVideoData(data);
  };

  const handleVideoCreate = async (e: any) => {
    const data = videoData;
      if(!isLoading){
      await createVideo(data);
    }
  };  
  

  return (
    <div className=" flex min-h-screen">
      <div className="w-[80%]">
      {
        active === 0 && (
          <VideoInformation
          videoInfo = {videoInfo}
          setVideoInfo = {setVideoInfo}
          active = {active}
          setActive = {setActive} 
          
          />
        )
        
      }
      {
        active === 1 && (
          <VideoData
          benefits = {benefits}
          setBenefits = {setBenefits}
          prerequisites = {prerequisites}
          setPrerequisites = {setPrerequisites}
          active = {active}
          setActive = {setActive} 
          
          />
        )
        
      }
       {
        active === 2 && (
          <VideoContent
          active = {active}
          setActive = {setActive}
          videoContentData = {videoContentData}
          setVideoContentData = {setVideoContentData}
          handleSubmit ={handleSubmit} 
          
          />
        )
        
      }
       {
        active === 3 && (
          <VideoPreview
              isAuthenticated={true}
              active={active}
              setActive={setActive}
              videoData={videoData}
              handleVideoCreate={handleVideoCreate} isEdit={false}          
          />
        )
        
      }
      </div>
      <div className="w-[20%] mt-[100px] h-screen fixed z-[-1] top-18 right-0">
        <VideoOptions active={active} setActive={setActive}/>
      </div>
    </div>
  )
}

export default CreateVideo;