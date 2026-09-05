import * as React from "react";
import {
  Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { stripEmDashes } from "@/lib/strip-em-dashes";

interface ArticleItem {
  title: string;
  score: number;
  articleId: string;
}

interface Props {
  articles?: ArticleItem[];
  runId?: string;
}

const clean = (v: unknown) => stripEmDashes(typeof v === "string" ? v : "");
const editUrl = (id: string) => `https://cognarah.com/admin/articles/${id}`;

const ArticleAutoPublished: React.FC<Props> = (props) => {
  const articles = Array.isArray(props.articles) ? props.articles : [];
  const runId = clean(props.runId);

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${articles.length} article${articles.length === 1 ? "" : "s"} auto-published on Cognarah`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading as="h1" style={h1}>Articles auto-published</Heading>
          <Text style={lead}>
            {articles.length} article{articles.length === 1 ? " was" : "s were"} automatically published by
            the news agent because {articles.length === 1 ? "its" : "their"} newsworthiness score cleared the
            configured threshold. Spot check retroactively, and unpublish from the edit page if any of these
            shouldn't have gone live.
          </Text>

          <Section style={card}>
            {articles.length === 0 ? (
              <Text style={body}>No articles in this run.</Text>
            ) : (
              articles.map((a, i) => (
                <div key={i} style={{ padding: "10px 0", borderBottom: i === articles.length - 1 ? "none" : "1px solid #e2e8f0" }}>
                  <Text style={title}>
                    <Link href={editUrl(a.articleId)} style={link}>{clean(a.title) || "Untitled article"}</Link>
                  </Text>
                  <Text style={source}>Newsworthiness score: {a.score}/100</Text>
                </div>
              ))
            )}
          </Section>

          <Section style={{ marginTop: "20px" }}>
            <Text style={body}>
              Review all articles: <Link href="https://cognarah.com/admin/articles" style={link}>https://cognarah.com/admin/articles</Link>
            </Text>
            {runId && <Text style={footer}>Run ID: {runId}</Text>}
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            You received this because the Cognarah news agent auto-published new articles. Adjust or disable
            the auto-publish threshold under Admin &rarr; AI Agent &rarr; Schedule.
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
const source: React.CSSProperties = { fontSize: "12px", color: "#64748b", margin: 0 };
const body: React.CSSProperties = { fontSize: "14px", lineHeight: "21px", color: "#0f172a", margin: 0 };
const link: React.CSSProperties = { color: "#7c3aed", textDecoration: "underline" };
const hr: React.CSSProperties = { borderColor: "#e2e8f0", margin: "24px 0 12px" };
const footer: React.CSSProperties = { fontSize: "12px", color: "#64748b", margin: "4px 0 0" };

export const template = {
  component: ArticleAutoPublished,
  subject: (d: Record<string, any>) => {
    const n = Array.isArray(d?.articles) ? d.articles.length : 0;
    return `${n} article${n === 1 ? "" : "s"} auto-published on Cognarah`;
  },
  displayName: "Articles auto-published notification",
  to: "info@cognarah.com",
  previewData: {
    articles: [
      { title: "OpenAI Launches GPT-6 With Native Robotics Control", score: 92, articleId: "example-article-id-1" },
      { title: "Nigerian Fintech Raises $40M Series B for AI Credit Scoring", score: 78, articleId: "example-article-id-2" },
    ],
    runId: "example-run-id",
  },
} satisfies TemplateEntry;
