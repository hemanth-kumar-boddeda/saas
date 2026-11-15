import { styles } from '@/app/styles/style';
import NavItems from '@/app/utils/NavItems';
import React, { FC, useState } from 'react'
import toast from 'react-hot-toast';
import { AiOutlineDelete, AiOutlinePlusCircle } from 'react-icons/ai';
import { BsLink45Deg, BsPencil } from 'react-icons/bs';
import { MdOutlineKeyboardArrowDown } from 'react-icons/md';

type Props = {
    active: number;
    setActive: (active: number) => void;
    videoContentData: any;
    setVideoContentData: (videoContentData: any) => void;
    handleSubmit: any;
}

const VideoContent: FC<Props> = ({ active, setActive, videoContentData, setVideoContentData, handleSubmit: handleVideoSubmit }) => {
    const [isCollapsed, setIsCollapsed] = useState(
        Array(videoContentData.length).fill(false)
    );

    const [activeSection, setActiveSection] = useState(1);

    const handleSubmit = (e: any) => {
        e.preventDefault();
    };

    const handleCollapseToggle = (index: number) => {
        const updatedCollapsed = [...isCollapsed];
        updatedCollapsed[index] = !updatedCollapsed[index];
        setIsCollapsed(updatedCollapsed);

    };

    const handleRemoveLink = (index: number, linkIndex: number) => {
        const updatedData = [...videoContentData];
        updatedData[index].links.splice(linkIndex, 1);
        setVideoContentData(updatedData);
    };

    const handleAddLink = (index: number) => {
        const updatedData = [...videoContentData];
        updatedData[index].links.push({ title: "", url: "" });
        setVideoContentData(updatedData);
    };



    const newContentHandler = (item: any) => {
        const hasEmptyFields = item.title === "" || item.videoUrl === "" || item.videoDescription === "";

        if (hasEmptyFields || item.links.some((link: any) => link.title === "" || link.url === "")) {
            toast.error("Please fill all the fields");
        } else {
            let newVideoSection = "";

            if (videoContentData.length > 0) {
                const lastVideoSection =
                    videoContentData[videoContentData.length - 1].videoSection;

                if (lastVideoSection) {
                    newVideoSection = lastVideoSection;
                }
            }
            const newContent = {
                videoUrl: "",
                title: "",
                description: "",
                videoSection: newVideoSection,
                links: [
                    {
                        title: "",
                        url: "",
                    },
                ],
            };

            setVideoContentData([...videoContentData, newContent]);
        }
    };

    const addNewSection = () => {
        const lastItem = videoContentData[videoContentData.length - 1];
    
        if (
            lastItem.title === "" ||
            lastItem.description === "" ||
            lastItem.videoUrl === "" ||
            lastItem.links[0].title === "" ||
            lastItem.links[0].url === ""
        ) {
            toast.error("Please fill all the fields");
        } else {
            setActiveSection(activeSection + 1);
            const newContent = {
                videoUrl: "",
                title: "",
                description: "",
                videoSection: "Untitled Section ${activeSection}",
                links: [
                    {
                        title: "",
                        url: "",
                    }
                ],
            };
        }
    };
    
    const prevButton = () => {
        setActive(active - 1);
    }

    const handleOptions = () => {
        if (videoContentData[videoContentData.length -1].title==="" ||
          videoContentData[videoContentData.length -1].description==="" ||
          videoContentData[videoContentData.length -1].videoUrl===""
          ) {
            toast.error("Please fill all the fields before moving to next step");
        }else {
            setActive(active + 1);
            handleVideoSubmit();
        }
    };




    return (
        <div className="w-[80%] m-auto mt-24 p-3">
            <form onSubmit={handleSubmit}>
                {videoContentData?.map((item: any, index: number) => {

                    const showSectionInput =
                        index === 0 ||
                        item.videoSection !== videoContentData[index - 1].videoSection;


                    return (
                        <>
                            <div
                                className={`w-full h-min overflowY:hidden bg-[#cdc8c817] p-4 $ {
                        showSectionInput ? "mt-10":"mb-0"
                    }`}
                            >
                                {
                                    showSectionInput && (
                                        <>
                                            <div className="flex w-full items-center">
                                                <input
                                                    type="text"
                                                    className={`text-[20px] ${item.videoSection === "Untitled Section"
                                                        ? "w-[170px]"
                                                        : "w-min"
                                                        } font-Poppins cursor-pointer dark:text-white text-black bg-transparent outline-none`}
                                                    value={item.videoSection}
                                                    onChange={(e) => {
                                                        const updatedData = [...videoContentData];
                                                        updatedData[index].videoSection = e.target.value;
                                                        setVideoContentData(updatedData);
                                                    }}
                                                />
                                                <BsPencil className="dark:text-white text-black cursor-pointer" />
                                            </div>
                                            <br />
                                        </>
                                    )
                                }
                                <div className="w-full flex items-center justify-between my-0">
                                    {
                                        isCollapsed[index] ? (
                                            <>
                                                {item.title ? (
                                                    <p className="font-Poppins dark:text-white text-black">
                                                        {index + 1}. {item.title}
                                                    </p>
                                                ) : (
                                                    <></>
                                                )}
                                            </>
                                        ) : (

                                            <div></div>

                                        )
                                    }

                                    <div className="flex items-center">
                                        <AiOutlineDelete
                                            className={`dark:text-white text-[20px] mr-2 text-black ${index > 0 ? "cursor-pointer" : "cursor-no-drop"
                                                }`}
                                            onClick={() => {
                                                if (index > 0) {
                                                    const updatedData = [...videoContentData];
                                                    updatedData.splice(index, 1);
                                                    setVideoContentData(updatedData);
                                                }
                                            }}

                                        />
                                        <MdOutlineKeyboardArrowDown
                                            fontSize="large"
                                            className="dark:text-white text-black"
                                            style={{
                                                transform: isCollapsed[index]
                                                    ? "rotate(180deg)"
                                                    : "rotate(0deg)",
                                            }}
                                            onClick={() => {
                                                handleCollapseToggle(index);
                                            }}
                                        />
                                    </div>
                                </div>
                                {
                                    !isCollapsed[index] && (
                                        <>
                                            <div className="my-3">
                                                <label className={styles.label}>Video Title</label>
                                                <input
                                                    type="text"
                                                    placeholder="Project Plan..."
                                                    className={`${styles.input}`}
                                                    value={item.title}
                                                    onChange={(e) => {
                                                        const updatedData = [...videoContentData];
                                                        updatedData[index].title = e.target.value;
                                                        setVideoContentData(updatedData);
                                                    }}
                                                />
                                            </div>
                                            <div className="mb-3">
                                                <label className={styles.label}>Video Url</label>
                                                <input
                                                    type="text"
                                                    placeholder="https://www.youtube.com/watch?v=..."
                                                    className={`${styles.input}`}
                                                    value={item.videoUrl}
                                                    onChange={(e) => {
                                                        const updatedData = [...videoContentData];
                                                        updatedData[index].videoUrl = e.target.value;
                                                        setVideoContentData(updatedData);
                                                    }}
                                                />
                                            </div>
                                            <div className="mb-3">
                                                <label className={styles.label}>Video Description</label>
                                                <textarea
                                                    rows={8}
                                                    cols={30}
                                                    placeholder="Project Plan..."
                                                    className={`${styles.input} !h-min py-2`}
                                                    value={item.description}
                                                    onChange={(e) => {
                                                        const updatedData = [...videoContentData];
                                                        updatedData[index].description = e.target.value;
                                                        setVideoContentData(updatedData);
                                                    }}
                                                />
                                                <br />

                                            </div>
                                            {item?.links.map((link: any, linkIndex: number) => (
                                                <div className="mb-3 block" key={linkIndex}>
                                                    <div className="w-full flex items-center justify-between">
                                                        <label className={styles.label}>
                                                            Link {linkIndex + 1}
                                                        </label>
                                                        <AiOutlineDelete
                                                            className={`${linkIndex === 0 ? "cursor-no-drop" : "cursor-pointer"
                                                                } text-black dark:text-white text-[20px] `}
                                                            onClick={() =>
                                                                linkIndex === 0
                                                                    ? null
                                                                    : handleRemoveLink(index, linkIndex)
                                                            }
                                                        />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Source Code ...(Link title)"
                                                        className={`${styles.input}`}
                                                        value={link.title}
                                                        onChange={(e) => {
                                                            const updatedData = [...videoContentData];
                                                            updatedData[index].links[linkIndex].title = e.target.value;
                                                            setVideoContentData(updatedData);
                                                        }}
                                                    />
                                                    <input
                                                        type="url"
                                                        placeholder="Source Code Url...(Link url)"
                                                        className={`${styles.input} mt-6`}
                                                        value={link.url}
                                                        onChange={(e) => {
                                                            const updatedData = [...videoContentData];
                                                            updatedData[index].links[linkIndex].url = e.target.value;
                                                            setVideoContentData(updatedData);
                                                        }}
                                                    />
                                                </div>
                                            ))}

                                            <br />
                                            <div className="inline-block mb-4">
                                                <p
                                                    className="flex items-center text-[18px] dark:text-white text-black cursor-pointer"
                                                    onClick={() =>
                                                        handleAddLink(index)}
                                                >
                                                    <BsLink45Deg className="mr-2" />
                                                    Add Link


                                                </p>
                                            </div>
                                        </>
                                    )
                                }
                                <br />
                                {index === videoContentData.length - 1 && (
                                    <div>
                                        <p
                                            className="flex items-center text-[18px] dark:text-white text-black cursor-pointer"
                                            onClick={(e: any) => newContentHandler(item)}
                                        >
                                            <AiOutlinePlusCircle className="mr-2" />
                                            Add New Content
                                        </p>
                                    </div>
                                )

                                }
                            </div>
                        </>
                    );
                })}
                <br/>
                <div
                className="flex items-center text-[20px] dark:text-white text-black cursor-pointer"
                onClick={() => addNewSection()}
                >
                    <AiOutlinePlusCircle className="mr-2" />
                    Add New Section
                
                </div>
            </form>
                <br/>
                <div className="w-full flex items-center justify-between">
                    <div
                    className="w-full 800px:w-[180px] flex items-center justify-center h-[40px] bg-[#37a39a] text-center text-[#fff] rounded mt-8 cursor-pointer"
                    onClick={() => prevButton()}
                    >
                        Prev


                    </div>
                    <div
                    className="w-full 800px:w-[180px] flex items-center justify-center h-[40px] bg-[#37a39a] text-center text-[#fff] rounded mt-8 cursor-pointer"
                    onClick={() => handleOptions()}
                    >
                        Next


                    </div>

                </div>
                <br/>
                <br/>
                <br/>
        </div>
    )
};

export default VideoContent;