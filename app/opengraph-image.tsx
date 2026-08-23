import { ImageResponse } from "next/og";

// Social share card shown when a NorthEDM link is posted anywhere (texts, DMs,
// Instagram, Discord, search). Auto-attached as og:image + twitter:image on
// every route via Next's file convention. 1200x630, self-contained (no external
// fonts/assets) so it always renders.
export const alt = "NorthEDM — Unite the Northeast";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#050506",
          backgroundImage:
            "radial-gradient(1000px 500px at 18% 8%, rgba(57,255,20,0.20), transparent 60%), radial-gradient(1000px 500px at 82% 12%, rgba(204,0,255,0.20), transparent 60%), radial-gradient(1200px 600px at 50% 120%, rgba(0,212,255,0.18), transparent 60%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 44,
            letterSpacing: 14,
            color: "rgba(57,255,20,0.75)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Northeast Dance Music
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 180,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1,
          }}
        >
          NorthEDM
        </div>
        <div
          style={{
            display: "flex",
            width: 620,
            height: 10,
            marginTop: 28,
            borderRadius: 9999,
            backgroundImage:
              "linear-gradient(90deg, #39FF14 0%, #00D4FF 50%, #CC00FF 100%)",
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 46,
            color: "#e5e5e5",
            marginTop: 34,
          }}
        >
          Unite the Northeast
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            color: "rgba(255,255,255,0.55)",
            marginTop: 20,
            letterSpacing: 2,
          }}
        >
          Festivals · EDM · Foraging · Marketplace · FestDash Delivery
        </div>
      </div>
    ),
    { ...size }
  );
}
