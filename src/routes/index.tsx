import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import logoAsset from "../assets/cognarah-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cognarah — Everything AI. Nothing Else." },
      {
        name: "description",
        content:
          "Cognarah is launching soon. Everything AI. Nothing else.",
      },
      { property: "og:title", content: "Cognarah — Everything AI. Nothing Else." },
      {
        property: "og:description",
        content: "Cognarah is launching soon. Everything AI. Nothing else.",
      },
      { property: "og:image", content: logoAsset.url },
      { name: "twitter:image", content: logoAsset.url },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-16">
      {/* Ambient gradient glow echoing the logo swirl */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 55%, rgba(216, 70, 160, 0.18) 0%, rgba(255, 138, 40, 0.08) 35%, rgba(10, 15, 44, 0) 70%)",
        }}
      />

      <h1 className="sr-only">Cognarah — Everything AI. Nothing Else.</h1>

      <motion.img
        src={logoAsset.url}
        alt="Cognarah"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
        transition={{
          opacity: { duration: 1.2, ease: "easeOut" },
          scale: { duration: 1.2, ease: "easeOut" },
          y: {
            duration: 6,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "loop",
            delay: 1.2,
          },
        }}
        className="relative z-10 w-[min(82vw,480px)] select-none"
        draggable={false}
      />

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.6 }}
        className="relative z-10 mt-10 text-center text-[0.7rem] font-light uppercase text-foreground sm:text-sm md:text-base"
        style={{ letterSpacing: "0.32em" }}
      >
        Everything AI. Nothing Else.
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut", delay: 1.1 }}
        className="relative z-10 mt-6 text-center text-xs font-light text-muted-foreground sm:text-sm"
        style={{ letterSpacing: "0.08em" }}
      >
        Launching soon. Stay tuned.
      </motion.p>
    </main>
  );
}
