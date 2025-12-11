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

interface StudioOwnerOutreachProps {
  firstName?: string;
}

export const StudioOwnerOutreachV4 = ({
  firstName = "there",
}: StudioOwnerOutreachProps) => (
  <Html>
    <Head />
    <Preview>Quick question about your studio</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={paragraph}>Hi {firstName},</Text>

        <Text style={paragraph}>
          I'm Aman, CEO of Naayya. Your name was recommended to me by folks in
          the Merrithew Pilates community, and I thought it'd be worth reaching
          out.
        </Text>

        <Text style={paragraph}>
          We're working with Pilates studio owners and educators who either have
          studios or are thinking about launching one.
        </Text>

        <Text style={paragraph}>
          Naayya basically handles everything you need to run a studio —
          booking, payments, customer management, marketing, staff payroll. All
          in one place instead of juggling different tools.
        </Text>

        <Text style={paragraph}>
          I'm curious if this is something you're dealing with now, or if you're
          planning to start a studio? Either way, would love to chat and see if
          we can help.
        </Text>

        <Text style={paragraph}>
          Check out what we do:{" "}
          <Link href="https://naayya.com" style={link}>
            naayya.com
          </Link>
        </Text>

        <Text style={paragraph}>
          Cheers,
          <br />
          Aman
          <br />
          Co-founder & CEO, Naayya
        </Text>
      </Container>
    </Body>
  </Html>
);

export default StudioOwnerOutreachV4;

// Plain Gmail-style formatting - minimal styling
const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    'Arial, sans-serif',
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

const link = {
  color: "#1155cc",
  textDecoration: "none",
};
