"use client"
import React, { FC, useEffect, useState } from 'react'
import VideoInformation from './VideoInformation';
import VideoOptions from './VideoOptions';
import VideoData from './VideoData';
import VideoContent from './VideoContent';
import VideoPreview from './VideoPreview';
import { useEditVideoMutation, useGetAllVideosAdminQuery} from '../../../../redux/features/videos/videosApi';
import { redirect } from 'next/navigation';
import toast from 'react-hot-toast';
type Props = {
    id:string;
}

const EditVideo: FC<Props> = ({id}) => {
    const [editVideo,{isSuccess,error}] = useEditVideoMutation();
    const {data,refetch} = useGetAllVideosAdminQuery(
        {},
        {
          refetchOnMountOrArgChange: true,
        }
    );

    const editVideoData = data && data.videos.find((i:any) => i._id === id);
        


  useEffect(() => {
    if(isSuccess){
      toast.success("Video updated successfully");
      redirect("/admin/videos");
    }
    if(error){
    if("data" in error){
      const errorMessage = error as any;
      toast.error(errorMessage.data.message);
    }
    }
  },[isSuccess,error]);
  const [active, setActive] = useState(0);

        useEffect(() => {
            if(editVideoData){
                setVideoInfo({
                    name: editVideoData.name,
                    description: editVideoData.description,
                    price: editVideoData.price,
                    estimatedPrice: editVideoData?.estimatedPrice,
                    tags: editVideoData.tags,
                    level: editVideoData.level,
                    demoUrl: editVideoData.demoUrl,
                    thumbnail: editVideoData?.thumbnail?.url,
                })
                setBenefits(editVideoData.benefits);
                setPrerequisites(editVideoData.prequsites);
                setVideoContentData(editVideoData.videoData);
            }
        },[editVideoData]);

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
    const formattedPrequsites = prerequisites.map((prerequisite) => ({title: prerequisite.title}));
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
      prequesites: formattedPrequsites,
      videoContent: formattedVideoContentData,
    };
    setVideoData(data);
  };

  const handleVideoCreate = async (e:any) => {
    const data = videoData;
   await editVideo({id:editVideoData?._id,data});
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
          isAuthenticated = {true}
          
          active = {active}
          setActive = {setActive}
          videoData={videoData}
          handleVideoCreate = {handleVideoCreate}
          isEdit = {true}
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

export default EditVideo;