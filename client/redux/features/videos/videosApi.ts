import { apiSlice } from "../api/apiSlice";

export const videosApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    createVideo: builder.mutation({
      query: (data) => ({
        url: "create-video",
        method: "POST",
        body: data,
        credentials: "include" as const,
      }),
    }),
    getAllVideosAdmin: builder.query({
      query: () => ({
        url: "videos/get-all-videos",
        method: "GET",
        credentials: "include" as const,
      }),
    }),
    getAllVideoUser: builder.query({
      query:({pageNumber,limit}) => ({
        url:`videos/get-videos ${
          pageNumber && limit ? `?page=${pageNumber}&limit=${limit}` : ""

        }`,
        method:"GET",
        credentials:"include" as const,
      }),
    }),
    deleteVideo: builder.mutation({
      query: (id) => ({
        url:`videos/delete-video/${id}`,
        method:"DELETE",
        credentials:"include" as const,
      }),
    }),
    editVideo: builder.mutation({
      query:({id,data})=>({
        url:`videos/update-video/${id}`,
        method:"PUT",
        body:data,
        credentials: "include" as const,
      }),
    }),
    getVideoDetails: builder.query({
      query:(id) =>({
        url:`videos/get-video/${id}`,
        method:"GET",
        credentials:"include" as const,
      }),
    }),
    getVideoContent: builder.query({
      query:(id) => ({
        url:`videos/get-video-content/${id}`,
        method:"GET",
        credentials: "include" as const,
      }),
    }),
    addNewQuestion: builder.mutation({
      query:({question,videoId,contentId}) =>({
        url: "videos/add-question",
        method: "PUT",
        body: {
          question,
          videoId,
          contentId,
        },
        credentials: "include" as const,
      }),
    }),
    addNewAnswer: builder.mutation({
      query:({answer,videoId,contentId,questionId}) => ({
        url: "videos/add-answer",
        method:"PUT",
        body:{answer,videoId,contentId,questionId},
        credentials: "include" as const,
      }),
    }),
    addReview:builder.mutation({
      query:({review,videoId,rating}) => ({
        url:`videos/add-review/${videoId}`,
        method:"PUT",
        body:{review,rating},
        credentials:"include" as const,
      }),
    }),
   addReplyToReview:builder.mutation({
    query:({comment,videoId,reviewId}:any)=> ({
      url:"videos/add-reply",
      method:"PUT",
      body:{
        comment,
        videoId,
        reviewId,
      },
      credentials:"include" as const,
    }),
   }),
   searchVideo:builder.query({
    query:(title) => ({
      url:`${title === "" ? null : `videos/search?title=${title}`}`,
      method:"GET",
      credentials:"include" as const,
    }),
   }),

  }),
});

export const {
  useCreateVideoMutation,
  useGetAllVideosAdminQuery,
  useGetAllVideoUserQuery,
  useDeleteVideoMutation,
  useEditVideoMutation,
  useGetVideoDetailsQuery,
  useGetVideoContentQuery,
  useAddNewQuestionMutation,
  useAddNewAnswerMutation,
  useAddReviewMutation,
  useAddReplyToReviewMutation,
  useSearchVideoQuery
} = videosApi;
