"use client";
import { useParams } from "next/navigation";
import AiEditor from "../../../../components/Editor/AiEditor";

export default function EditorPage() {
  const id = useParams<{ id: string }>()?.id;
  return id ? <AiEditor projectId={id} /> : null;
}
