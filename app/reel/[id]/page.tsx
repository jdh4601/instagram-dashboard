"use client";
import { useParams } from "next/navigation";
import { MediaDetailScreen } from "@/components/MediaDetailScreen";

export default function ReelDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <MediaDetailScreen id={id} kind="REELS" />;
}
