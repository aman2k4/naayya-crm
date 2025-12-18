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

export const YogaMindbodyOutreachV1 = ({
  firstName = "there",
  studioName = "your studio",
}: YogaMindbodyOutreachProps) => (
  <Html>
    <Head />
    <Preview>Quick question about {studioName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={paragraph}>Hi {firstName},</Text>

        <Text style={paragraph}>
          Saw you're using Mindbody for {studioName}.
        </Text>

        <Text style={paragraph}>
          We built Naayya specifically for yoga studios to be simpler and more modern (and less expensive).
        </Text>

        <Text style={paragraph}>
          Would love to show you how much easier it can be.
        </Text>

        <Text style={paragraph}>
          <Link href="https://naayya.com" style={link}>
            naayya.com
          </Link>
        </Text>

        <Text style={paragraph}>
          Cheers,
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

const link = {
  color: "#1155cc",
  textDecoration: "none",
};
