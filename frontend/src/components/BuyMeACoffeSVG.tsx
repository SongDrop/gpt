import React, { useEffect, useState } from "react";

interface BuyMeACoffeeSVGProps {
  svgUrl: string;
  fillColor: string; // color to set on path fill(s)
  width?: number | string;
  height?: number | string;
}

const BuyMeACoffeeSVG: React.FC<BuyMeACoffeeSVGProps> = ({
  svgUrl,
  fillColor,
  width = 16,
  height = 16,
}) => {
  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetch(svgUrl)
      .then((res) => res.text())
      .then((svgText) => {
        if (!isMounted) return;

        // Parse SVG text to a DOM element
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const svgElement = doc.querySelector("svg");

        if (!svgElement) {
          setSvgContent(svgText); // fallback to raw if no svg found
          return;
        }

        // Modify all <path> fill attributes
        svgElement.querySelectorAll("path").forEach((path) => {
          path.setAttribute("fill", fillColor);
        });

        // Modify all <text> fill attributes
        svgElement.querySelectorAll("text").forEach((textEl) => {
          textEl.setAttribute("fill", fillColor);
        });

        // Serialize back to string
        const serializer = new XMLSerializer();
        const newSvgStr = serializer.serializeToString(svgElement);

        setSvgContent(newSvgStr);
      })
      .catch(() => {
        setSvgContent(null);
      });

    return () => {
      isMounted = false;
    };
  }, [svgUrl, fillColor]);

  if (!svgContent) {
    return <div>Loading SVG...</div>;
  }

  return (
    <div
      id="w-support"
      className="w-support"
      style={{ width, height, display: "inline-block" }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
      aria-label="Buy Me a Coffee button"
      role="img"
    />
  );
};

export default BuyMeACoffeeSVG;
