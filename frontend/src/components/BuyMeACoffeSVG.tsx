import React, { useEffect, useState } from "react";

interface SvgBackgroundProps {
  svgUrl: string;
  fillColor: string;
  width?: number | string;
  height?: number | string;
}

const SvgBackground: React.FC<SvgBackgroundProps> = ({
  svgUrl,
  fillColor,
  width = 100,
  height = 100,
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetch(svgUrl)
      .then((res) => res.text())
      .then((svgText) => {
        if (!isMounted) return;

        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const svgElement = doc.querySelector("svg");
        if (!svgElement) {
          setDataUrl(null);
          return;
        }

        // Modify fill color of paths and text
        svgElement.querySelectorAll("path, text").forEach((el) => {
          el.setAttribute("fill", fillColor);
        });

        const serializer = new XMLSerializer();
        const modifiedSvg = serializer.serializeToString(svgElement);

        // Encode SVG for use in data URI
        const encoded = encodeURIComponent(modifiedSvg)
          .replace(/'/g, "%27")
          .replace(/"/g, "%22");

        const uri = `data:image/svg+xml;utf8,${encoded}`;

        setDataUrl(uri);
      })
      .catch(() => {
        setDataUrl(null);
      });

    return () => {
      isMounted = false;
    };
  }, [svgUrl, fillColor]);

  if (!dataUrl) {
    return <div>Loading...</div>;
  }

  return (
    <div
      className="w-support"
      style={{
        backgroundImage: `url("${dataUrl}")`,
      }}
      role="img"
      aria-label="SVG icon"
    />
  );
};

export default SvgBackground;
