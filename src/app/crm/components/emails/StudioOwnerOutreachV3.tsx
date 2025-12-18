import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface StudioOwnerOutreachProps {
  firstName?: string;
}

export const StudioOwnerOutreachV3 = ({
  firstName = "there",
}: StudioOwnerOutreachProps) => (
  <Html>
    <Head />
    <Preview>Quick question about your studio</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header with Naayya Logo */}
        <Section style={headerSection}>
          <Img
            src="https://naayya.com/brand/logos/naayya/primary@2x.png"
            alt="Naayya"
            style={logo}
            width="160"
            height="40"
          />
        </Section>

        <Section style={section}>
          <Text style={greeting}>Hi {firstName},</Text>

          <Text style={paragraph}>
            I'm Aman, CEO of Naayya. Your name came up when I was looking into the Pilates community.
          </Text>

          <Text style={paragraph}>
            I came across your profile and thought it'd be worth reaching out. We're working with Pilates studio owners and educators who either have studios or are thinking about launching one.
          </Text>

          <Text style={paragraph}>
            Naayya basically handles everything you need to run a studio — booking, payments, customer management, marketing, staff payroll. All in one place instead of juggling different tools.
          </Text>

          <Text style={paragraph}>
            I'm curious if this is something you're dealing with now, or if you're planning to start a studio? Either way, would love to chat and see if we can help.
          </Text>

          <Text style={paragraph}>
            Check out what we do:{" "}
            <Link href="https://naayya.com" style={link}>
              naayya.com
            </Link>
          </Text>

          <Text style={signature}>
            Cheers,
            <br />
            Aman
            <br />
            Co-founder & CEO, Naayya
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);


const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "20px 0 48px",
  maxWidth: "560px",
};

const headerSection = {
  padding: "24px",
  textAlign: "center" as const,
  borderBottom: "solid 1px #e5e7eb",
};

const logo = {
  height: "40px",
  width: "auto",
};

const section = {
  padding: "24px",
  border: "solid 1px #e5e7eb",
  borderRadius: "8px",
  backgroundColor: "#ffffff",
};

const greeting = {
  fontSize: "16px",
  lineHeight: "24px",
  marginBottom: "8px",
  color: "#111827",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
  marginBottom: "16px",
  color: "#374151",
};

const link = {
  color: "#2563eb",
  textDecoration: "underline",
};

const signature = {
  fontSize: "16px",
  lineHeight: "24px",
  marginTop: "24px",
  color: "#111827",
};
