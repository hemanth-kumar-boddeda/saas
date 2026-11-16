import { apiSlice } from "../api/apiSlice";

export const reviewApi = apiSlice.injectEndpoints({
  endpoints: (b) => ({
    listProjects: b.query<any, void>({ query: () => "projects", providesTags: ["Projects"] }),
    createProject: b.mutation<any, { title: string }>({
      query: (body) => ({ url: "projects", method: "POST", body }),
      invalidatesTags: ["Projects"],
    }),
    getProject: b.query<any, string>({ query: (id) => `projects/${id}`, providesTags: ["Project"] }),
    addVersion: b.mutation<any, { id: string; form: FormData | { externalUrl: string; note?: string } }>({
      query: ({ id, form }) => ({ url: `projects/${id}/versions`, method: "POST", body: form }),
      invalidatesTags: ["Project", "Projects"],
    }),
    streamUrl: b.query<any, { id: string; vid: string }>({
      query: ({ id, vid }) => `projects/${id}/versions/${vid}/stream-url`,
      keepUnusedDataFor: 0,
    }),
    listComments: b.query<any, { id: string; vid: string; status?: string; mine?: boolean }>({
      query: ({ id, vid, status, mine }) => ({
        url: `projects/${id}/versions/${vid}/comments`,
        params: { ...(status ? { status } : {}), ...(mine ? { mine: "true" } : {}) },
      }),
      providesTags: ["Comments"],
    }),
    addComment: b.mutation<any, { id: string; vid: string; body: string; timecode: number; parentId?: string }>({
      query: ({ id, vid, ...body }) => ({ url: `projects/${id}/versions/${vid}/comments`, method: "POST", body }),
      invalidatesTags: ["Comments"],
    }),
    setCommentStatus: b.mutation<any, { id: string; cid: string; status: "open" | "resolved" }>({
      query: ({ id, cid, status }) => ({ url: `projects/${id}/comments/${cid}/status`, method: "PATCH", body: { status } }),
      invalidatesTags: ["Comments"],
    }),
    decide: b.mutation<any, { id: string; action: "approve" | "request_changes"; versionId: string; note?: string }>({
      query: ({ id, ...body }) => ({ url: `projects/${id}/approval`, method: "POST", body }),
      invalidatesTags: ["Project", "Projects", "Approvals"],
    }),
    approvals: b.query<any, string>({ query: (id) => `projects/${id}/approvals`, providesTags: ["Approvals"] }),
    createLink: b.mutation<any, { id: string; password?: string; expiresInDays?: number }>({
      query: ({ id, ...body }) => ({ url: `projects/${id}/links`, method: "POST", body }),
      invalidatesTags: ["Links"],
    }),
    listLinks: b.query<any, string>({ query: (id) => `projects/${id}/links`, providesTags: ["Links"] }),
    revokeLink: b.mutation<any, { id: string; lid: string }>({
      query: ({ id, lid }) => ({ url: `projects/${id}/links/${lid}`, method: "DELETE" }),
      invalidatesTags: ["Links"],
    }),
    getKit: b.query<any, string>({ query: (id) => `projects/${id}/kit`, providesTags: ["Kit"] }),
    startKit: b.mutation<any, string>({
      query: (id) => ({ url: `projects/${id}/kit`, method: "POST" }),
      invalidatesTags: ["Kit"],
    }),
    editKit: b.mutation<any, { id: string; edit: Record<string, unknown> }>({
      query: ({ id, edit }) => ({ url: `projects/${id}/kit`, method: "PATCH", body: edit }),
      invalidatesTags: ["Kit"],
    }),
    listChannels: b.query<any, void>({ query: () => "channels", providesTags: ["Channels"] }),
    createChannel: b.mutation<any, Record<string, unknown>>({
      query: (body) => ({ url: "channels", method: "POST", body }),
      invalidatesTags: ["Channels"],
    }),
    setProjectChannel: b.mutation<any, { id: string; channelId: string | null }>({
      query: ({ id, channelId }) => ({ url: `projects/${id}/channel`, method: "PUT", body: { channelId } }),
      invalidatesTags: ["Project"],
    }),
    enterLink: b.mutation<any, { token: string; name: string; password?: string }>({
      query: (body) => ({ url: "review-links/enter", method: "POST", body }),
    }),
  }),
});

export const {
  useListProjectsQuery, useCreateProjectMutation, useGetProjectQuery, useAddVersionMutation, useStreamUrlQuery,
  useListCommentsQuery, useAddCommentMutation, useSetCommentStatusMutation, useDecideMutation, useApprovalsQuery,
  useCreateLinkMutation, useListLinksQuery, useRevokeLinkMutation, useEnterLinkMutation,
  useGetKitQuery, useStartKitMutation, useEditKitMutation, useListChannelsQuery, useCreateChannelMutation, useSetProjectChannelMutation,
} = reviewApi;

export const errMsg = (e: any): string => e?.data?.message || "Something went wrong. Please try again.";
