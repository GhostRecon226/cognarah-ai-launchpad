import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { stripEmDashes } from "@/lib/strip-em-dashes";

interface Props {
  companyName?: string;
  founderName?: string;
  country?: string;
  city?: string;
  companyStage?: string;
  productDescription?: string;
  problemSolved?: string;
  founderEmail?: string;
  contactMethod?: string;
  whatsappNumber?: string | null;
  submittedAt?: string;
  reviewUrl?: string;
}

const clean = (v: unknown) => stripEmDashes(typeof v === "string" ? v : "");

const NewStartupSubmission: React.FC<Props> = (props) => {
  const companyName = clean(props.companyName) || "Unknown company";
  const founderName = clean(props.founderName) || "Unknown founder";
  const country = clean(props.country);
  const city = clean(props.city);
  const location = [city, country].filter(Boolean).join(", ") || "Not provided";
  const companyStage = clean(props.companyStage) || "Not provided";
  const productDescription = clean(props.productDescription) || "Not provided";
  const problemSolved = clean(props.problemSolved) || "Not provided";
  const founderEmail = clean(props.founderEmail) || "Not provided";
  const contactMethodBase = clean(props.contactMethod) || "Not provided";
  const whatsapp = clean(props.whatsappNumber);
  const contactMethod =
    contactMethodBase === "WhatsApp" && whatsapp
      ? `${contactMethodBase} (${whatsapp})`
      : contactMethodBase;
  const submittedAt = clean(props.submittedAt) || new Date().toISOString();
  const reviewUrl = clean(props.reviewUrl) || "https://cognarah.com/admin/startups";

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`New startup submission: ${companyName}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading as="h1" style={h1}>
            New startup submission
          </Heading>
          <Text style={lead}>
            {founderName} just submitted {companyName} for review on Cognarah.
          </Text>

          <Section style={card}>
            <Row label="Company" value={companyName} />
            <Row label="Founder" value={founderName} />
            <Row label="Location" value={location} />
            <Row label="Company stage" value={companyStage} />
            <Row label="Founder email" value={founderEmail} />
            <Row label="Preferred contact" value={contactMethod} />
            <Row label="Submitted at" value={submittedAt} />
          </Section>

          <Section style={block}>
            <Text style={label}>What the product does</Text>
            <Text style={body}>{productDescription}</Text>
          </Section>

          <Section style={block}>
            <Text style={label}>Problem it solves</Text>
            <Text style={body}>{problemSolved}</Text>
          </Section>

          <Section style={{ textAlign: "center", marginTop: "28px" }}>
            <Button href={reviewUrl} style={button}>
              Review submission
            </Button>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            You received this because a startup submission was created on Cognarah.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

function Row({ label: l, value }: { label: string; value: string }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <tbody>
        <tr>
          <td style={rowLabel}>{l}</td>
          <td style={rowValue}>{value}</td>
        </tr>
      </tbody>
    </table>
  );
}

const main: React.CSSProperties = {
  backgroundColor: "#ffffff",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
  color: "#0f172a",
};
const container: React.CSSProperties = { padding: "24px", maxWidth: "600px" };
const h1: React.CSSProperties = {
  fontFamily: "'Archivo Black', Arial, sans-serif",
  fontSize: "24px",
  margin: "0 0 8px",
  color: "#0b1437",
};
const lead: React.CSSProperties = { fontSize: "15px", lineHeight: "22px", margin: "0 0 20px", color: "#334155" };
const card: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "12px 16px",
  backgroundColor: "#f8fafc",
};
const rowLabel: React.CSSProperties = {
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#64748b",
  padding: "8px 8px 8px 0",
  width: "40%",
  verticalAlign: "top",
};
const rowValue: React.CSSProperties = {
  fontSize: "14px",
  color: "#0f172a",
  padding: "8px 0",
  verticalAlign: "top",
};
const block: React.CSSProperties = { marginTop: "20px" };
const label: React.CSSProperties = {
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#64748b",
  margin: "0 0 4px",
};
const body: React.CSSProperties = { fontSize: "14px", lineHeight: "21px", color: "#0f172a", margin: 0 };
const button: React.CSSProperties = {
  backgroundColor: "#7c3aed",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
};
const hr: React.CSSProperties = { borderColor: "#e2e8f0", margin: "28px 0 16px" };
const footer: React.CSSProperties = { fontSize: "12px", color: "#64748b", margin: 0 };

export const template = {
  component: NewStartupSubmission,
  subject: (d: Record<string, any>) =>
    `New Startup Submission: ${stripEmDashes((d?.companyName as string) || "")}`.trim() ||
    "New Startup Submission",
  displayName: "New startup submission notification",
  to: "cognarah.ai@gmail.com",
  previewData: {
    companyName: "Acme AI",
    founderName: "Jane Doe",
    country: "Nigeria",
    city: "Lagos",
    companyStage: "Seed",
    productDescription:
      "Acme AI builds a conversational assistant for African small businesses that automates customer support in local languages.",
    problemSolved:
      "SMBs across the continent lose sales because they cannot respond to customer messages 24/7 in the languages their customers speak.",
    founderEmail: "jane@acme.ai",
    contactMethod: "Email",
    whatsappNumber: null,
    submittedAt: new Date().toISOString(),
    reviewUrl: "https://cognarah.com/admin/startups",
  },
} satisfies TemplateEntry;
