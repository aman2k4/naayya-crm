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

export const YogaMindbodyOutreachV4 = ({
  firstName = "there",
  studioName = "your studio",
}: YogaMindbodyOutreachProps) => (
  <Html>
    <Head />
    <Preview>Quick idea for {studioName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={paragraph}>Hi {firstName},</Text>

        <Text style={paragraph}>
          Are you happy with Mindbody right now?
        </Text>

        <Text style={paragraph}>
          I'm building a modern platform for yoga studios called Naayya that fixes the clunkiness you're probably used to.
        </Text>

        <Text style={paragraph}>
          Would love to get your take on it if you're open to a 5-min chat.
        </Text>

        <Text style={paragraph}>
          Thanks,
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
