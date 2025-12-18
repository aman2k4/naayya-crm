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

interface EversportsMigrationOutreachProps {
  firstName?: string;
}

export const EversportsMigrationOutreach = ({
  firstName = "Sara",
}: EversportsMigrationOutreachProps) => (
  <Html>
    <Head />
    <Preview>Switch from Eversports - Save 57% + Free Migration</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={paragraph}>Hi {firstName},</Text>

        <Text style={paragraph}>
          I'm Aman, founder of{" "}
          <Link href="https://naayya.com" style={link}>
            Naayya
          </Link>
          .
        </Text>

        <Text style={paragraph}>
          I'm writing because we've helped several studios switch from Eversports to Naayya, and the results were strong:
        </Text>

        <Text style={list}>
          <strong>• Up to 57% lower monthly costs</strong>
          <br />
          <strong>• Beautiful iPhone app</strong> that customers love → more bookings
          <br />
          <strong>• Automated teacher payout calculation</strong>
          <br />
          <strong>• Fast onboarding</strong> (we migrate your classes/memberships for free)
        </Text>

        <Text style={paragraph}>
          If <em>reducing costs</em> and <em>simplifying operations</em> is a priority for your studio, I'd be happy to share more.
        </Text>

        <Text style={paragraph}>
          Would you like a short demo?
        </Text>

        <Text style={paragraph}>
          Feel free to reply to this email or check us out at{" "}
          <Link href="https://naayya.com" style={link}>
            naayya.com
          </Link>
        </Text>

        <Text style={paragraph}>
          Best,
          <br />
          Aman
          <br />
          Co-founder & CEO, Naayya
        </Text>
      </Container>
    </Body>
  </Html>
);


// Plain Gmail-style formatting - minimal styling
const main = {
  backgroundColor: "#ffffff",
  fontFamily: "Arial, sans-serif",
};

const container = {
  padding: "20px",
  maxWidth: "100%",
};

const paragraph = {
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0 0 10px 0",
  color: "#000000",
};

const list = {
  fontSize: "14px",
  lineHeight: "1.8",
  margin: "0 0 10px 0",
  color: "#000000",
};

const link = {
  color: "#1155cc",
  textDecoration: "none",
};
