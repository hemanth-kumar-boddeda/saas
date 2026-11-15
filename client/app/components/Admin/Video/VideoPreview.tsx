import React, { FC } from 'react'
import VideoPlayer from '../../../utils/VideoPlayer';
import { styles } from '@/app/styles/style';
import Ratings from '../../../utils/Ratings';
import { IoCheckmarkDoneOutline } from 'react-icons/io5';

type Props = {
    active: number;
    setActive: (active: number) => void;
    videoData: any;
    handleVideoCreate: any;
    isEdit: boolean;
    isAuthenticated: boolean;
}

const VideoPreview: FC<Props> = ({ active, setActive, videoData, handleVideoCreate,isEdit,isAuthenticated}) => {
    const discountPercentage = ((videoData?.estimatedPrice - videoData?.price) / videoData?.estimatedPrice) * 100;

    const discountPercentagePrice = discountPercentage.toFixed(0);

    const prevButton = () => {
        setActive(active - 1);
    }
    const CreateVideo = () => {
        if(!isAuthenticated){
            handleVideoCreate();
            setActive(active + 1);
        }

    }
  return (
    <div className="w-[90%] m-auto py-5 mb-5 text-black dark:text-white">
        <div className="w-full relative">
            <div className="w-full mt-10">
                <VideoPlayer
                videoUrl={videoData?.demoUrl}
                title={videoData?.title}
                />
            </div>
            <div className="flex items-center">
                <h1 className="pt-5 text-[25px]">
                    {videoData?.price === 0 ? "Free" : videoData?.price + " $"}
                </h1>
                <h5 className="text-[20px] pl-3 mt-2 line-through opacity-80">
                    {videoData?.estimatedPrice}$
                </h5>

                <h4 className="text-[22px] pl-4 pt-4">
                    {discountPercentagePrice}% Off
                </h4>
            </div>
            <div className="flex items-center">
                <div
                className={`${styles.button} !w-[180px] my-3 font-Poppins !bg-[crimson] cursor-not-allowed`}
                >
                    Buy Now {videoData?.price}$

                </div>
            </div>
            <div className="flex items-center">
                <input
                type="text"
                name=""
                id=""
                placeholder="Discount Code..."
                className={`${styles.input}1500px:!w-[60%] 1100px:w-[60%] ml-3 !mt-0`}
                />
                <div
                className={`${styles.button} !w-[120px] my-3 ml-4 font-Poppins cursor-pointer`}
                >
                    Apply
                </div>
            </div>
            <p className="pb-1">. Source Code included</p>
            <p className="pb-1">. Full lifetime access</p>
            <p className="pb-1">. Complete Scured Process</p>
            <p className="pb-3 800px:pb-1">. Premium Support</p>
        </div>
        <div className="w-full">
            <div className="w-full 800px:pr-5">
                <h1 className="text-[25px] font-Poppins font-[600]">
                    {videoData?.name}
                </h1>
                <div className="flex items-center justify-between pt-3">
                    <div className="flex items-center">
                        <Ratings rating={0} />
                        <h5>0 Reviews</h5>
                    </div>
                    <h5>0 Viewers</h5>
                </div>
                <br/>
                <h1 className="text-[25px] font-Poppins font-[600]">
                    What do you get from this platform?
                    </h1>
            </div>
            {videoData?.benefits?.map((item: any, index: number) => (
                <div
                className="w-full flex 800px:items-center py-2"
                key={index}
                >
                    <div className="w-[15px] mr-1">
                    <IoCheckmarkDoneOutline size={20} />
                    </div>
                    <p className="pl-2">{item.title}</p>
                    
                    </div>
            ))}
            <br />
            <br />
            <h1 className="text-[25px] font-Poppins font-[600]">
                What are the prerequisites for starting the work in this platform?
            </h1>
            {videoData?.prerequisites?.map((item: any, index: number) => (
                <div className="w-full flex 800px:items-center py-2" key={index}>
                <div className="w-[15px] mr-1">
                    <IoCheckmarkDoneOutline size={20} />

                </div>
                <p className="pl-2">{item.title}</p>
                
                </div>
            ))}
            <br />
            <br />
            <div className="w-full">
            <h1 className="text-[25px] font-Poppins font-[600]">
                Video Details
            </h1>
            <p className="text-[18px] mt-[20px] whitespace-pre-line w-full overflow-hidden">
            {videoData?.description}
            </p>
            </div>
            <br />
            <br />
        </div>
        <div className="w-full flex items-center justify-between">
            <div
            className="w-full 800px:w-[180px] flex items-center justify-center h-[40px] bg-[#37a39a] text-center text-[#fff] rounded mt-8 cursor-pointer"
            onClick={() => prevButton()}
            >
                Prev
            </div>
            <div
            className="w-full 800px:w-[180px] flex items-center justify-center h-[40px] bg-[#37a39a] text-center text-[#fff] rounded mt-8 cursor-pointer"
            onClick={() => CreateVideo()}
            >
            {
                isEdit ? "Update" : "Create"
            }
            </div>
        </div>

    </div>
  );
};

export default VideoPreview;