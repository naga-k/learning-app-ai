import { cn } from "@/lib/utils";
import type { Experimental_GeneratedImage } from "ai";
import NextImage from "next/image";
import type { ComponentProps } from "react";

type NextGeneratedImageProps = Omit<
  ComponentProps<typeof NextImage>,
  "src" | "alt" | "className"
>;

export type ImageProps = Omit<Experimental_GeneratedImage, "uint8Array"> &
  NextGeneratedImageProps & {
    className?: string;
    alt?: string;
  };

export const Image = ({
  base64,
  mediaType,
  alt,
  className,
  ...imageProps
}: ImageProps) => {
  const src = `data:${mediaType};base64,${base64}`;

  return (
    <NextImage
      {...imageProps}
      alt={alt ?? ""}
      className={cn(
        "h-auto max-w-full overflow-hidden rounded-md",
        className
      )}
      src={src}
    />
  );
};
