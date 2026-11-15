import React, { useEffect, useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Button, Link, Modal } from '@mui/material';
import { AiOutlineDelete } from 'react-icons/ai';
import { useTheme } from 'next-themes';
import { FiEdit2 } from 'react-icons/fi';
import { useGetAllVideosAdminQuery, useDeleteVideoMutation } from '@/redux/features/videos/videosApi';
import Loader from '../../Loader/Loader';
import { format } from "timeago.js";
import { styles } from '@/app/styles/style';
import toast from 'react-hot-toast';
import {BiPencil} from "react-icons/bi";
type Props = {};

const AllVideos = (props: Props) => {
    const { theme, setTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const [deleteVideo, { isSuccess:deleteSuccess, error:deleteError }] = useDeleteVideoMutation();
    const { isLoading, data, error, refetch } = useGetAllVideosAdminQuery({},{refetchOnMountOrArgChange: true});
    const [videoId, setVideoId] = useState("");
useEffect(() => {
    if(deleteSuccess) {
        setOpen(false);
        refetch();
        toast.success("Video deleted successfully!");
    }
    if(deleteError){
        if("data" in deleteError){
            const errorMessage = deleteError as any;
            toast.error(errorMessage.data.message);
        }
    }
},[deleteError,deleteSuccess,refetch]);
    const columns = [
        { field: "id", headerName: "ID", flex: 0.5 },
        { field: "title", headerName: "Title", flex: 1 },
        { field: "ratings", headerName: "Ratings", flex: 0.5 },
        { field: "purchased", headerName: "Purchased", flex: 0.5 },
        { field: "created_at", headerName: "Created At", flex: 0.5 },
        {
            field: "  ",
            headerName: "Edit",
            flex: 0.2,
            renderCell: (params: any) => {
                return (
                    <>
                        <Link href={`/admin/edit-video/${params.row.id}`}>
                            <FiEdit2
                                className="dark:text-white text-black"
                                size={20}
                            />

                        </Link>
                    </>
                )

            }
        },
        {
            field: " ",
            headerName: "Delete",
            flex: 0.2,
            renderCell: (params: any) => {
                return (
                    <>
                        <Button
                            onClick={() => {
                                setOpen(!open);
                                setVideoId(params.row.id);
                            }}
                        >
                            <AiOutlineDelete
                                className="dark:text-white text-black"
                                size={20}
                            />

                        </Button>
                    </>
                );

            },
        },
    ];
    const rows: any = [];

    {
        data && data.videos.forEach((item: any) => {
            rows.push({
                id: item._id,
                title: item.name,
                ratings: item.ratings,
                purchased: item.purchased,
                created_at: format(item.createdAt),
            });
        });
    }
    const handleDeleteVideo = async() => {
        const id = videoId;
        await deleteVideo(id);
    };

   
    return (
        <div className="mt-[120px]">
            {
                isLoading ? (
                    <Loader />

                ) : (
                    <Box m="20px">
                        <Box
                            m="40px 0 0 0"
                            height="80vh"
                            sx={{
                                "& .MuiDataGrid-root": {
                                    border: "none",
                                    outline: "none",
                                },
                                "& .css-pqjvzy-MuiSvgIcon-root-MuiSelect-icon": {
                                    color: theme === "dark" ? "white" : "black",
                                },
                                "& .MuiDataGrid-sortIcon": {
                                    color: theme === "dark" ? "white" : "black",
                                },
                                "& .MuiDataGrid-row": {
                                    color: theme === "dark" ? "white" : "black",
                                    borderBottom:
                                        theme === "dark"
                                            ? "1px solid #ffffff30!important"
                                            : "1px solid #ccc!important",
                                },
                                "& .MuiTablePagination-root": {
                                    color: theme === "dark" ? "white" : "black",
                                },
                                "& .MuiDataGrid-cell": {
                                    borderBottom: "none",
                                },
                                "& .name-column--cell": {
                                    color: theme === "dark" ? "white" : "black",
                                },
                                "& .MuiDataGrid-columnHeaders": {
                                    backgroundColor: theme === "dark" ? "#3e4396" : "#A4A9FC",
                                    borderBottom: "none",
                                    color: theme === "dark" ? "white" : "black",
                                },
                                "& .MuiDataGrid-virtualScroller": {
                                    backgroundColor: theme === "dark" ? "#1F2A40" : "#f2f0f0",
                                },
                                "& .MuiDataGrid-footerContainer": {
                                    borderTop: "none",
                                    backgroundColor: theme === "dark" ? "#3e4396" : "#A4A9FC",
                                    color: theme === "dark" ? "white" : "black",
                                },
                                "& .MuiCheckbox-root": {
                                    color: theme === "dark" ? `#b7ebde !important` : `#000 !important`,
                                },
                                "& .MuiDataGrid-toolbarContainer .MuiButton-text": {
                                    color: `#fff !important`,
                                },
                            }}
                        >


                            <DataGrid checkboxSelection rows={rows} columns={columns} />
                        </Box>
                        {open && (
                        <Modal
                            open={open}
                            onClose={() => setOpen(!open)}
                            aria-labelledby="modal-modal-title"
                            aria-describedby="modal-modal-description"
                            className="!z-[99999]"
                        >
                            <Box className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[450px] bg-white dark:bg-slate-900 rounded-[8px] shadow p-8 outline-none ">
                <h1 className={`${styles.title} mb-4`}>
                  Are you sure you want to delete this user?
                </h1>
                <div className="flex w-full items-center justify-between mb-6">
                  <div
                    className="relative inline-flex group items-center justify-center py-3 px-6 cursor-pointer border-none text-white rounded-full min-h-[45px] text-[16px] font-Poppins font-semibold !w-[120px] h-[30px] !bg-[#00ffca]"
                    onClick={() => setOpen(!open)}
                  >
                    Cancel
                  </div>
                  <div
                    className="relative inline-flex group items-center justify-center py-3 px-6 cursor-pointer border-none text-white rounded-full min-h-[45px] text-[16px] font-Poppins font-semibold !w-[120px] h-[30px] !bg-[#ff3377]"
                    onClick={handleDeleteVideo}
                  >
                    Delete
                  </div>
                </div>
              </Box>
            </Modal>
          )}
        </Box>
      )}
    </div>
  );
};

export default AllVideos;
