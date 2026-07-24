import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { toast } from "sonner";

// Preview frame size (kept at 4:3 to match how the banner is actually displayed
// on the videos page, i.e. an `aspect-[4/3]` box with `object-cover`).
const FRAME_W = 480;
const FRAME_H = 360;
// Exported image resolution. Higher than the preview frame so the uploaded
// banner still looks sharp on larger screens.
const OUTPUT_W = 1280;
const OUTPUT_H = 960;

interface BannerEditorDialogProps {
  /** URL of the image to edit — either a local object URL or a remote (public) URL. */
  imageUrl: string;
  /** Set to true when imageUrl is a remote URL, so it's loaded with crossOrigin so the canvas can export it. */
  crossOrigin?: boolean;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}

/**
 * A small "mini photo editor" for banner images: lets the admin pan and zoom
 * the picture inside a 16:9 frame before it's uploaded, so the banner shows
 * exactly what they intend instead of whatever object-cover happens to crop.
 */
export function BannerEditorDialog({ imageUrl, crossOrigin, onCancel, onSave }: BannerEditorDialogProps) {
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [minScale, setMinScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const dragStart = useRef<{ x: number; y: number; offX: number; offY: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNaturalSize(null);
    setLoadError(false);
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth, h = img.naturalHeight;
      const cover = Math.max(FRAME_W / w, FRAME_H / h);
      setNaturalSize({ w, h });
      setMinScale(cover);
      setScale(cover);
      setOffset({ x: 0, y: 0 });
      imgElRef.current = img;
    };
    img.onerror = () => { if (!cancelled) setLoadError(true); };
    img.src = imageUrl;
    return () => { cancelled = true; };
  }, [imageUrl, crossOrigin]);

  const clampOffset = useCallback((offX: number, offY: number, s: number, size: { w: number; h: number } | null) => {
    if (!size) return { x: 0, y: 0 };
    const dispW = size.w * s;
    const dispH = size.h * s;
    const maxX = Math.max(0, (dispW - FRAME_W) / 2);
    const maxY = Math.max(0, (dispH - FRAME_H) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, offX)), y: Math.min(maxY, Math.max(-maxY, offY)) };
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, offX: offset.x, offY: offset.y };
    setDragging(true);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset(clampOffset(dragStart.current.offX + dx, dragStart.current.offY + dy, scale, naturalSize));
  }
  function onPointerUp() {
    dragStart.current = null;
    setDragging(false);
  }

  function onZoomChange(v: number[]) {
    const next = v[0];
    setScale(next);
    setOffset((o) => clampOffset(o.x, o.y, next, naturalSize));
  }

  function onReset() {
    setScale(minScale);
    setOffset({ x: 0, y: 0 });
  }

  async function onApply() {
    if (!imgElRef.current || !naturalSize) return;
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_W;
      canvas.height = OUTPUT_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Your browser doesn't support the canvas needed to crop this image.");
      const outRatio = OUTPUT_W / FRAME_W;
      const dispW = naturalSize.w * scale * outRatio;
      const dispH = naturalSize.h * scale * outRatio;
      const dx = OUTPUT_W / 2 - dispW / 2 + offset.x * outRatio;
      const dy = OUTPUT_H / 2 - dispH / 2 + offset.y * outRatio;
      ctx.drawImage(imgElRef.current, dx, dy, dispW, dispH);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92));
      if (!blob) throw new Error("Couldn't export the cropped image.");
      onSave(blob);
    } catch {
      toast.error("Couldn't process that image here — try re-selecting the file instead.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust banner</DialogTitle>
        </DialogHeader>

        {loadError ? (
          <p className="text-sm text-destructive">Couldn't load this image for editing. Please try selecting the file again.</p>
        ) : !naturalSize ? (
          <div className="flex items-center justify-center" style={{ height: FRAME_H }}>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div
              className="relative mx-auto overflow-hidden rounded-md bg-muted touch-none select-none"
              style={{ width: FRAME_W, height: FRAME_H, cursor: dragging ? "grabbing" : "grab" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              <img
                src={imageUrl}
                alt="Banner being edited"
                draggable={false}
                className="absolute top-1/2 left-1/2 max-w-none pointer-events-none"
                style={{
                  width: naturalSize.w * scale,
                  height: naturalSize.h * scale,
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Drag to reposition — this is exactly how it'll appear as the video thumbnail
            </p>

            <div className="flex items-center gap-3 px-1">
              <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
              <Slider value={[scale]} min={minScale} max={minScale * 3} step={0.01} onValueChange={onZoomChange} />
              <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>

            <Button type="button" variant="ghost" size="sm" onClick={onReset} className="w-fit mx-auto text-xs text-muted-foreground">
              <RotateCcw className="h-3 w-3 mr-1" /> Reset
            </Button>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="button" onClick={onApply} disabled={!naturalSize || loadError || saving}>
            {saving ? "Saving…" : "Use this banner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
