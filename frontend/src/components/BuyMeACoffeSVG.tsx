import React, { useEffect, useState } from "react";

interface SvgBackgroundProps {
  svgUrl: string;
  fillColor: string;
}

const SvgBackground: React.FC<SvgBackgroundProps> = ({ svgUrl, fillColor }) => {
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
    return (
      <div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="[var(--color-foreground)]"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Heart icon"
          role="img"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </div>
    );
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
