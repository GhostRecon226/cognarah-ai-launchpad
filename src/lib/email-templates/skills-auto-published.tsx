import * as React from "react";
import {
  Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { stripEmDashes } from "@/lib/strip-em-dashes";

interface SkillItem {
  title: string;
  source: string;
  slug?: string;
}

interface Props {
  skills?: SkillItem[];
  runId?: string;
  reviewUrl?: string;
}

const clean = (v: unknown) => stripEmDashes(typeof v === "string" ? v : "");

const SkillsAutoPublished: React.FC<Props> = (props) => {
  const skills = Array.isArray(props.skills) ? props.skills : [];
  const reviewUrl = clean(props.reviewUrl) || "https://cognarah.com/admin/skills";
  const runId = clean(props.runId);

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${skills.length} skill${skills.length === 1 ? "" : "s"} auto-published on Cognarah`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading as="h1" style={h1}>Skills auto-published</Heading>
          <Text style={lead}>
            {skills.length} skill{skills.length === 1 ? " was" : "s were"} automatically published from
            trusted sources. Spot check retroactively if needed.
          </Text>

          <Section style={card}>
            {skills.length === 0 ? (
              <Text style={body}>No skills in this run.</Text>
            ) : (
              skills.map((s, i) => (
                <div key={i} style={{ padding: "10px 0", borderBottom: i === skills.length - 1 ? "none" : "1px solid #e2e8f0" }}>
                  <Text style={title}>{clean(s.title) || "Untitled skill"}</Text>
                  <Text style={source}>
                    Source: <Link href={clean(s.source)} style={link}>{clean(s.source)}</Link>
                  </Text>
                </div>
              ))
            )}
          </Section>

          <Section style={{ marginTop: "20px" }}>
            <Text style={body}>
              Review all skills: <Link href={reviewUrl} style={link}>{reviewUrl}</Link>
            </Text>
            {runId && <Text style={footer}>Run ID: {runId}</Text>}
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            You received this because the Cognarah Skills agent auto-published new entries.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

const main: React.CSSProperties = { backgroundColor: "#ffffff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif", color: "#0f172a" };
const container: React.CSSProperties = { padding: "24px", maxWidth: "600px" };
const h1: React.CSSProperties = { fontFamily: "'Archivo Black', Arial, sans-serif", fontSize: "22px", margin: "0 0 8px", color: "#0b1437" };
const lead: React.CSSProperties = { fontSize: "15px", lineHeight: "22px", margin: "0 0 20px", color: "#334155" };
const card: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: "8px", padding: "4px 16px", backgroundColor: "#f8fafc" };
const title: React.CSSProperties = { fontSize: "14px", fontWeight: 600, color: "#0f172a", margin: "0 0 4px" };
const source: React.CSSProperties = { fontSize: "12px", color: "#64748b", margin: 0, wordBreak: "break-all" };
const body: React.CSSProperties = { fontSize: "14px", lineHeight: "21px", color: "#0f172a", margin: 0 };
const link: React.CSSProperties = { color: "#7c3aed", textDecoration: "underline" };
const hr: React.CSSProperties = { borderColor: "#e2e8f0", margin: "24px 0 12px" };
const footer: React.CSSProperties = { fontSize: "12px", color: "#64748b", margin: "4px 0 0" };

export const template = {
  component: SkillsAutoPublished,
  subject: (d: Record<string, any>) => {
    const n = Array.isArray(d?.skills) ? d.skills.length : 0;
    return `${n} skill${n === 1 ? "" : "s"} auto-published on Cognarah`;
  },
  displayName: "Skills auto-published notification",
  to: "cognarah.ai@gmail.com",
  previewData: {
    skills: [
      { title: "Web Search Skill", source: "https://github.com/anthropics/skills/tree/main/web-search" },
      { title: "PDF Reader Skill", source: "https://github.com/anthropics/skills/tree/main/pdf-reader" },
    ],
    runId: "example-run-id",
    reviewUrl: "https://cognarah.com/admin/skills",
  },
} satisfies TemplateEntry;
