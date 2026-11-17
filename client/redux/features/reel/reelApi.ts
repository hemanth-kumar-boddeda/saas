// Thin client for the ReelFlow API (/v1/reel). All editing logic lives on the server.
import { apiSlice } from "../api/apiSlice";

const base = (id: string) => `reel/projects/${id}`;
export const reelApi = apiSlice.injectEndpoints({
  endpoints: (b) => ({
    reelAssets: b.query<any, string>({ query: (id) => `${base(id)}/assets`, providesTags: ["Reel"] }),
    reelTimeline: b.query<any, { id: string; version?: number }>({ query: ({ id, version }) => ({ url: `${base(id)}/timeline`, params: version ? { version } : {} }), providesTags: ["Reel"] }),
    reelTimelines: b.query<any, string>({ query: (id) => `${base(id)}/timelines`, providesTags: ["Reel"] }),
    reelPlans: b.query<any, string>({ query: (id) => `${base(id)}/plans`, providesTags: ["Reel"] }),
    reelUpload: b.mutation<any, { id: string; form: FormData }>({ query: ({ id, form }) => ({ url: `${base(id)}/assets`, method: "POST", body: form }), invalidatesTags: ["Reel"] }),
    reelTranscribe: b.mutation<any, { id: string; assetId: string; script?: "native" | "roman" }>({ query: ({ id, ...body }) => ({ url: `${base(id)}/transcribe`, method: "POST", body }), invalidatesTags: ["Reel"] }),
    reelEdit: b.mutation<any, { id: string; op: string; args: any; baseVersion: number }>({ query: ({ id, ...body }) => ({ url: `${base(id)}/edits`, method: "POST", body }), invalidatesTags: ["Reel"] }),
    reelCreatePlan: b.mutation<any, { id: string; instruction: string; idempotencyKey: string; captionScript?: "native" | "roman"; targetSeconds?: number }>({
      query: ({ id, instruction, idempotencyKey, captionScript, targetSeconds }) => ({ url: `${base(id)}/plans`, method: "POST", body: { instruction, idempotencyKey, preferences: { captionScript, targetSeconds } } }),
      invalidatesTags: ["Reel"],
    }),
    reelApprovePlan: b.mutation<any, { id: string; planId: string; opIds?: string[] }>({ query: ({ id, planId, opIds }) => ({ url: `${base(id)}/plans/${planId}/approve`, method: "POST", body: { opIds } }), invalidatesTags: ["Reel"] }),
    reelRejectPlan: b.mutation<any, { id: string; planId: string; reason: string }>({ query: ({ id, planId, reason }) => ({ url: `${base(id)}/plans/${planId}/reject`, method: "POST", body: { reason } }), invalidatesTags: ["Reel"] }),
    reelExecutePlan: b.mutation<any, { id: string; planId: string }>({ query: ({ id, planId }) => ({ url: `${base(id)}/plans/${planId}/execute`, method: "POST" }), invalidatesTags: ["Reel"] }),
    reelRender: b.mutation<any, { id: string; version: number; quality: "preview" | "final" }>({ query: ({ id, ...body }) => ({ url: `${base(id)}/renders`, method: "POST", body }) }),
    reelJob: b.query<any, { id: string; jobId: string }>({ query: ({ id, jobId }) => `${base(id)}/jobs/${jobId}`, keepUnusedDataFor: 0 }),
    reelApproveTimeline: b.mutation<any, { id: string; version: number }>({ query: ({ id, version }) => ({ url: `${base(id)}/timelines/${version}/approve`, method: "POST" }), invalidatesTags: ["Reel", "Project"] }),
  }),
});
export const {
  useReelAssetsQuery, useReelTimelineQuery, useReelTimelinesQuery, useReelPlansQuery, useReelUploadMutation, useReelTranscribeMutation, useReelEditMutation,
  useReelCreatePlanMutation, useReelApprovePlanMutation, useReelRejectPlanMutation, useReelExecutePlanMutation, useReelRenderMutation, useReelJobQuery, useReelApproveTimelineMutation,
} = reelApi;
