import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface PilatesEducatorOutreachProps {
  firstName?: string;
}

export const PilatesEducatorOutreach = ({
  firstName = "there",
}: PilatesEducatorOutreachProps) => (
  <Html>
    <Head />
    <Preview>Quick question about your Pilates classes</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={section}>
          <Text style={greeting}>Hi {firstName},</Text>

          <Text style={paragraph}>
            I came across your name through the Pilates educator community — do you still teach or run classes?
          </Text>

          <Text style={paragraph}>
            I'm the founder of Naayya, a modern booking and CRM tool made for Pilates studios. It helps reduce admin work (scheduling, payments, member tracking) so you can focus more on teaching.
          </Text>

          <Text style={paragraph}>
            You can take a look here:{" "}
            <Link href="https://naayya.com" style={link}>
              naayya.com
            </Link>{" "}
            — it's free to get started.
          </Text>

          <Text style={paragraph}>
            Or if you prefer a quick chat, you can grab a slot here:{" "}
            <Link href="https://cal.com/naayya/30min" style={link}>
              cal.com/naayya/30min
            </Link>
          </Text>

          <Text style={signature}>
            – Aman
            <br />
            Founder & CEO, Naayya
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default PilatesEducatorOutreach;

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
