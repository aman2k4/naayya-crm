import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

interface YogaMindbodyOutreachProps {
  firstName?: string;
  studioName?: string;
}

export const YogaMindbodyOutreachV3 = ({
  firstName = "there",
  studioName = "your studio",
}: YogaMindbodyOutreachProps) => (
  <Html>
    <Head />
    <Preview>Simpler booking for {studioName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={paragraph}>Hi {firstName},</Text>

        <Text style={paragraph}>
          Love what you're doing with {studioName}!
        </Text>

        <Text style={paragraph}>
          I'm building Naayya, a modern alternative to Mindbody that yoga owners actually enjoy using. It’s just simpler.
        </Text>

        <Text style={paragraph}>
          Check it out here:{" "}
          <Link href="https://naayya.com" style={link}>
            naayya.com
          </Link>
        </Text>

        <Text style={paragraph}>
          Let me know if you'd like a peek.
        </Text>

        <Text style={paragraph}>
          Aman
          <br />
          Co-founder & CEO
          <br />
          <Img
            src="https://naayya.com/brand/logos/naayya/primary@2x.png"
            alt="Naayya"
            width="100"
            style={{ marginTop: "10px" }}
          />
        </Text>
      </Container>
    </Body>
  </Html>
);

export default YogaMindbodyOutreachV3;

// Plain Gmail-style formatting - minimal styling
const main = {
  backgroundColor: "#ffffff",
  fontFamily: 'Arial, sans-serif',
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
