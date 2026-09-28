import { useId } from "react";
import { backgroundCss, chartSvg, getDeckTheme, getFontPair, iconDataUrl, resolvePaint, shapePath, svgDataUrl, themeColors } from "@/lib/studio/library";
import type { SceneDeck, SceneElement, ScenePage } from "@/lib/studio/scene";
import { resolveTextElementStyle } from "@/lib/studio/text-styles";

export type ScenePreviewProps = {
  page: ScenePage;
  deck: Pick<SceneDeck, "width" | "height" | "themeId" | "fontPairId" | "colorOverrides">;
  width: number;
  className?: string;
};

export default function ScenePreview({ page, deck, width, className }: ScenePreviewProps) {
  const instanceId = useId().replace(/:/g, "");
  const theme = getDeckTheme(deck.themeId);
  const colors = themeColors(theme, deck.colorOverrides);
  const fontPair = getFontPair(deck.fontPairId ?? theme.fontPairId);
  const paint = (value: string | undefined, fallback = "transparent") => resolvePaint(value, colors, fallback);
  const px = (value: number, axis: "x" | "y") => value * (axis === "x" ? deck.width : deck.height);

  const renderElement = (element: SceneElement) => {
    if (element.hidden) return null;
    const x = px(element.x, "x");
    const y = px(element.y, "y");
    const w = px(element.w, "x");
    const h = px(element.h, "y");
    const transform = element.rotation ? `rotate(${element.rotation} ${x + w / 2} ${y + h / 2})` : undefined;
    const props = { key: element.id, opacity: element.opacity ?? 1, transform };

    if (element.kind === "text") {
      const style = resolveTextElementStyle(element, fontPair, deck);
      const padding = element.padding ?? 0;
      return (
        <foreignObject {...props} x={x} y={y} width={w} height={h}>
          <div
            style={{
              boxSizing: "border-box",
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: element.verticalAlign === "middle" ? "center" : element.verticalAlign === "bottom" ? "flex-end" : "flex-start",
              overflow: "hidden",
              padding,
              borderRadius: element.radius ?? 0,
              background: element.fill ? paint(element.fill) : undefined,
              color: paint(element.color, colors.text),
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              fontStyle: style.italic ? "italic" : undefined,
              lineHeight: style.lineHeight,
              letterSpacing: style.letterSpacing,
              textAlign: element.align ?? "left",
              textDecoration: element.underline ? "underline" : undefined,
              textTransform: style.uppercase ? "uppercase" : undefined,
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
            }}
          >
            <div style={{ width: "100%" }}>{element.text}</div>
          </div>
        </foreignObject>
      );
    }

    if (element.kind === "shape") {
      const fill = element.shape.includes("line") ? "none" : paint(element.fill, colors.accent);
      const stroke = paint(element.stroke, element.shape.includes("line") ? colors.accent : "none");
      if (element.shape === "rect" || element.shape === "rounded" || element.shape === "pill") {
        return <rect {...props} x={x} y={y} width={w} height={h} rx={element.shape === "rect" ? 0 : element.shape === "pill" ? h / 2 : element.radius ?? theme.radius} fill={fill} stroke={stroke} strokeWidth={element.strokeWidth ?? 0} strokeDasharray={element.dash?.join(" ")} />;
      }
      if (element.shape === "circle" || element.shape === "ellipse") {
        return <ellipse {...props} cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill={fill} stroke={stroke} strokeWidth={element.strokeWidth ?? 0} strokeDasharray={element.dash?.join(" ")} />;
      }
      return <g {...props}><path d={shapePath(element.shape, w, h, element.radius)} transform={`translate(${x} ${y})`} fill={fill} stroke={stroke} strokeWidth={element.strokeWidth ?? 0} strokeDasharray={element.dash?.join(" ")} /></g>;
    }

    if (element.kind === "image") {
      const clipId = `${instanceId}-${element.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
      if (element.placeholder || !element.src) {
        return <g {...props}><rect x={x} y={y} width={w} height={h} rx={element.radius ?? 12} fill={colors.surface2} stroke={colors.border} /><text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="middle" fill={colors.muted} fontFamily={fontPair.body} fontSize={Math.max(12, Math.min(w, h) * 0.07)}>{element.query?.slice(0, 36) || "Image"}</text></g>;
      }
      return (
        <g {...props}>
          <defs><clipPath id={clipId}>{element.mask === "circle" ? <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} /> : <rect x={x} y={y} width={w} height={h} rx={element.radius ?? (element.mask === "rounded" ? theme.radius : 0)} />}</clipPath></defs>
          <image href={element.src} x={x} y={y} width={w} height={h} preserveAspectRatio={element.fit === "contain" ? "xMidYMid meet" : "xMidYMid slice"} clipPath={`url(#${clipId})`} />
        </g>
      );
    }

    if (element.kind === "icon") {
      const src = iconDataUrl(element.icon, { color: paint(element.color, colors.accent), fill: paint(element.fill, "none"), strokeWidth: element.strokeWidth, size: 128 });
      return src ? <image {...props} href={src} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet" /> : null;
    }

    if (element.kind === "chart") {
      const src = svgDataUrl(chartSvg(element, { accent: paint(element.color, colors.accent), accent2: colors.accent2, text: colors.text, muted: colors.muted, surface2: colors.surface2 }, w, h, { fontFamily: fontPair.body }));
      return <image {...props} href={src} x={x} y={y} width={w} height={h} />;
    }

    const rows = element.rows.length || 1;
    const cols = Math.max(1, ...element.rows.map((row) => row.length));
    return (
      <foreignObject {...props} x={x} y={y} width={w} height={h}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, width: "100%", height: "100%", background: paint(element.fill, colors.surface), color: paint(element.color, colors.text), border: `1px solid ${paint(element.stroke, colors.border)}`, fontFamily: fontPair.body, fontSize: Math.max(10, Math.min(w / cols, h / rows) * 0.22) }}>
          {Array.from({ length: rows * cols }, (_, index) => <div key={index} style={{ minWidth: 0, overflow: "hidden", padding: "4%", borderRight: `1px solid ${paint(element.stroke, colors.border)}`, borderBottom: `1px solid ${paint(element.stroke, colors.border)}`, fontWeight: element.header && index < cols ? 600 : 400 }}>{element.rows[Math.floor(index / cols)]?.[index % cols] ?? ""}</div>)}
        </div>
      </foreignObject>
    );
  };

  return (
    <div className={className} role="img" aria-label={page.name ? `Preview of ${page.name}` : "Design preview"} style={{ width, aspectRatio: `${deck.width} / ${deck.height}`, overflow: "hidden", background: backgroundCss(page.background, (value) => paint(value)) }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${deck.width} ${deck.height}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {page.elements.map(renderElement)}
      </svg>
    </div>
  );
}
