import clsx from "clsx";

interface CoverPhotoProps {
  url?: string | null;
  label: string;
  className?: string;
}

export function CoverPhoto({ url, label, className }: CoverPhotoProps) {
  if (url) {
    return (
      <img
        src={url}
        alt={label}
        className={clsx("block object-cover", className)}
      />
    );
  }

  return (
    <div
      className={clsx(
        "cover-placeholder flex items-center justify-center text-faint text-[11px] font-mono text-center px-2",
        className,
      )}
    >
      {label}
    </div>
  );
}
