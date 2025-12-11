import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

interface YogaMindbodyOutreachProps {
  firstName?: string;
  studioName?: string;
}

export const YogaMindbodyOutreachV2 = ({
  firstName = "there",
  studioName = "your studio",
}: YogaMindbodyOutreachProps) => (
  <Html>
    <Head />
    <Preview>Mindbody alternative for {studioName}?</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={paragraph}>Hi {firstName},</Text>

        <Text style={paragraph}>
          I noticed {studioName} is running on Mindbody.
        </Text>

        <Text style={paragraph}>
          We've been helping yoga studios switch to Naayya—it's cleaner, faster, and built to save you admin time (and money).
        </Text>

        <Text style={paragraph}>
          Open to a quick chat to see the difference?
        </Text>

        <Text style={paragraph}>
          Best,
          <br />
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

export default YogaMindbodyOutreachV2;

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
