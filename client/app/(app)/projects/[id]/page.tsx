"use client";
import { useParams } from "next/navigation";
import ReviewScreen from "../../../components/Review/ReviewScreen";

export default function ProjectPage() {
  const id = String(useParams()?.id ?? "");
  return <ReviewScreen projectId={id} guest={false} />;
}
