"use client";
import { useParams } from "next/navigation";
import ReviewScreen from "../../components/Review/ReviewScreen";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  return <ReviewScreen projectId={id} guest={false} />;
}
