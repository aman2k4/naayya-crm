import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Text,
  Hr,
} from "@react-email/components";
import * as React from "react";

interface MerrithewPilatesOutreachProps {
  firstName?: string;
  studioName?: string;
}

export const MerrithewPilatesOutreachV2 = ({
  firstName = "there",
}: MerrithewPilatesOutreachProps) => (
  <Html>
    <Head />
    <Preview>Quick question about your Pilates teaching</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={paragraph}>Hello {firstName},</Text>

        <Text style={paragraph}>
          Are you teaching Pilates independently or planning to open your own studio?
        </Text>

        <Text style={paragraph}>
          I noticed your Merrithew certification. We are offering <strong>€1,200 in free credits</strong> to help instructors get started with{" "}
          <Link href="https://naayya.com" style={link}>Naayya</Link> for bookings, payments, and client management.
        </Text>

        <Link href="https://www.instagram.com/getnaayya/" style={{ display: "block", margin: "20px 0" }}>
          <Img
            src="https://auth.naayya.com/storage/v1/object/public/naayya/cdn/getnaayya-1.png"
            alt="Naayya Platform"
            width="280"
            style={imageStyle}
          />
        </Link>

        <Text style={paragraph}>
          You can explore the platform at{" "}
          <Link href="https://naayya.com" style={link}>naayya.com</Link> — happy to answer any questions.
        </Text>

        <Hr style={divider} />

        <Text style={signature}>
          Best regards,
          <br />
          <strong>Aman</strong>
          <br />
          <span style={roleText}>Co-founder & CEO</span>
        </Text>

        <Link href="https://naayya.com">
          <Img
            src="https://naayya.com/brand/logos/naayya/primary@2x.png"
            alt="Naayya"
            width="80"
            style={{ marginTop: "12px" }}
          />
        </Link>

        <Text style={websiteLink}>
          <Link href="https://naayya.com" style={link}>naayya.com</Link>
        </Text>
      </Container>
    </Body>
  </Html>
);

export default MerrithewPilatesOutreachV2;

const main = {
  backgroundColor: "#ffffff",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
};

const container = {
  padding: "20px",
  maxWidth: "100%",
};

const paragraph = {
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 14px 0",
  color: "#1a1a1a",
};

const link = {
  color: "#2563eb",
  textDecoration: "none",
};

const imageStyle = {
  borderRadius: "6px",
  border: "1px solid #e5e7eb",
};

const divider = {
  borderColor: "#e5e7eb",
  margin: "24px 0 16px 0",
};

const signature = {
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0",
  color: "#1a1a1a",
};

const roleText = {
  color: "#6b7280",
  fontSize: "13px",
};

const websiteLink = {
  fontSize: "12px",
  margin: "6px 0 0 0",
  color: "#6b7280",
};
