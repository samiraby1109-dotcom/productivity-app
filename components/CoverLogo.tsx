"use client";
/**
 * CoverLogo — renders the active cover's wordmark.
 *
 * The default cover ("belle") keeps the existing image logo so its look is
 * unchanged. Other covers render their name as styled text (a real per-cover
 * logo image would be the production follow-up — see SKINS.md).
 */
import Image from "next/image";
import { useCover } from "./CoverProvider";
import { DEFAULT_COVER_ID } from "@/lib/covers";

export default function CoverLogo({ className = "h-9 w-auto" }: { className?: string }) {
  const { cover } = useCover();

  if (cover.id === DEFAULT_COVER_ID) {
    return <Image src="/logo.png" alt={cover.name} width={140} height={56} className={className} priority />;
  }

  return (
    <span className="font-semibold text-gray-900 text-lg tracking-tight" aria-label={cover.name}>
      {cover.name}
    </span>
  );
}

/** The active cover's name as plain text — for places that already render the
 *  name as text (landing nav/footer) rather than a logo. */
export function CoverName({ className }: { className?: string }) {
  const { cover } = useCover();
  return <span className={className}>{cover.name}</span>;
}

