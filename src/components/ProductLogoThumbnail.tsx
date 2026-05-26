import { Package } from "lucide-react";

export type LogoOverlay = {
  logo_url: string;
  position: {
    x_pct: number;
    y_pct: number;
    width_pct: number;
    rotation_deg: number;
  };
};

/**
 * Renders a product mockup thumbnail with an optional corporate logo overlay
 * positioned using percentage coordinates (matches PushProductsDialog).
 */
export function ProductLogoThumbnail({
  mockupUrl,
  overlay,
  alt = "",
  className = "h-full w-full",
  iconClassName = "h-6 w-6 text-muted-foreground",
}: {
  mockupUrl: string | null;
  overlay?: LogoOverlay | null;
  alt?: string;
  className?: string;
  iconClassName?: string;
}) {
  if (!mockupUrl) {
    return (
      <div className={`${className} flex items-center justify-center bg-muted`}>
        <Package className={iconClassName} />
      </div>
    );
  }

  return (
    <div className={`${className} relative overflow-hidden bg-muted`}>
      <img src={mockupUrl} alt={alt} className="h-full w-full object-cover" />
      {overlay && (
        <img
          src={overlay.logo_url}
          alt=""
          aria-hidden
          className="absolute pointer-events-none select-none"
          style={{
            left: `${overlay.position.x_pct * 100}%`,
            top: `${overlay.position.y_pct * 100}%`,
            width: `${overlay.position.width_pct * 100}%`,
            transform: `translate(-50%, -50%) rotate(${overlay.position.rotation_deg}deg)`,
            height: "auto",
          }}
        />
      )}
    </div>
  );
}
