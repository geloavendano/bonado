import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Button } from "@/components/ui/Button";
import { useOverlayA11y } from "@/hooks/useOverlayA11y";

const ASPECT = 12 / 5;

async function croppedFile(source: string, area: Area) {
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 1440;
  canvas.height = 600;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo editor is unavailable.");
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("Unable to crop photo.")),
      "image/jpeg",
      0.9,
    ),
  );
  return new File([blob], "trip-cover.jpg", { type: "image/jpeg" });
}

export function CoverCropSheet({
  source,
  onCancel,
  onConfirm,
}: {
  source: string;
  onCancel: () => void;
  onConfirm: (file: File) => Promise<void>;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useOverlayA11y(true, onCancel, dialogRef);
  const complete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  async function save() {
    if (!area || saving) return;
    setSaving(true);
    try {
      await onConfirm(await croppedFile(source, area));
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[160] flex flex-col bg-bg">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Adjust cover photo"
        className="flex min-h-0 flex-1 flex-col pt-[env(safe-area-inset-top)]"
      >
        <div className="flex h-14 items-center justify-between px-6">
          <button onClick={onCancel} className="text-[13px] font-bold text-secondary">
            Cancel
          </button>
          <div className="text-[16px] font-extrabold">Adjust cover</div>
          <div className="w-12" />
        </div>
        <div className="relative min-h-0 flex-1 bg-black">
          <Cropper
            image={source}
            crop={crop}
            zoom={zoom}
            aspect={ASPECT}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={complete}
            showGrid
          />
        </div>
        <div className="space-y-4 px-6 pb-[max(18px,env(safe-area-inset-bottom))] pt-5">
          <label className="grid gap-2 text-[11px] font-bold uppercase tracking-[0.07em] text-secondary">
            Zoom
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full accent-teal"
            />
          </label>
          <Button fullWidth disabled={!area || saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Use photo"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
