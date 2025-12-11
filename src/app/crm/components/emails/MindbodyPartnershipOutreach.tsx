import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

interface MindbodyPartnershipOutreachProps {
  firstName?: string;
  studioName?: string;
}

export const MindbodyPartnershipOutreach = ({
  firstName = "",
  studioName = "your studio",
}: MindbodyPartnershipOutreachProps) => (
  <Html>
    <Head />
    <Preview>Partnership opportunity for {studioName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={paragraph}>Hi{firstName ? ` ${firstName}` : ""},</Text>

        <Text style={spacedParagraph}>
          I'm Aman, founder at Naayya. We're building AI software for yoga
          studios that goes far beyond what Mindbody offers.
        </Text>

        <Text style={spacedParagraph}>
          I've been looking at mid-size studios doing interesting work, and{" "}
          {studioName} caught my attention. I'd love to explore partnering with
          you.
        </Text>

        <Text style={spacedParagraph}>
          <strong>What this means:</strong>
        </Text>

        <Text style={bulletPoint}>
          • $2,500/year off our Enterprise plan
        </Text>
        <Text style={bulletPoint}>
          • Complete onboarding and support
        </Text>
        <Text style={bulletPoint}>
          • Studios on Naayya are seeing 30% revenue increases within 2 months
        </Text>

        <Text style={spacedParagraph}>
          If you're curious about what Naayya can do for {studioName}, I'd be
          happy to show you.
        </Text>

        <Text style={spacedParagraph}>
          Check us out:{" "}
          <Link href="https://naayya.com" style={link}>
            naayya.com
          </Link>
        </Text>

        <Text style={signature}>
          Looking forward to connecting,
          <br />
          <br />
          Aman
          <br />
          Co-founder & CEO, Naayya
        </Text>
      </Container>
    </Body>
  </Html>
);

export default MindbodyPartnershipOutreach;

// Clean, spacious formatting
const main = {
  backgroundColor: "#ffffff",
  fontFamily: "Arial, sans-serif",
};

const container = {
  padding: "30px 20px",
  maxWidth: "100%",
};

const paragraph = {
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 10px 0",
  color: "#000000",
};

const spacedParagraph = {
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 20px 0",
  color: "#000000",
};

const bulletPoint = {
  fontSize: "15px",
  lineHeight: "1.7",
  margin: "0 0 8px 0",
  color: "#000000",
};

const signature = {
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "24px 0 0 0",
  color: "#000000",
};

const link = {
  color: "#1155cc",
  textDecoration: "none",
};
