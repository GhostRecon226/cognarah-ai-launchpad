import { useState } from "react";
import { mediaUrl } from "@/lib/media-url";
import { ImageOff } from "lucide-react";

interface MediaImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  fallbackClassName?: string;
  showIcon?: boolean;
}

/**
 * Renders an image from the private media bucket via the signed-URL redirect.
 * Falls back to a branded gradient placeholder when the source is missing,
 * the signed URL 404s, or the browser fails to load the image.
 */
export function MediaImage({
  src,
  alt = "",
  className,
  fallbackClassName,
  showIcon = true,
  ...rest
}: MediaImageProps) {
  const resolved = mediaUrl(src);
  const [failed, setFailed] = useState(false);

  if (!resolved || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-gradient-to-br from-navy to-[var(--africa-surface,#2A1A3D)] text-white/40 ${className ?? ""} ${fallbackClassName ?? ""}`}
      >
        {showIcon && <ImageOff className="h-6 w-6" aria-hidden />}
      </div>
    );
  }

  return (
    <img
      {...rest}
      src={resolved}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
