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

interface GenericFollowUpV2Props {
  firstName?: string;
  studioName?: string;
}

export const GenericFollowUpV2 = ({
  firstName = "there",
  studioName = "your studio",
}: GenericFollowUpV2Props) => (
  <Html>
    <Head />
    <Preview>Quick thought for {studioName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={paragraph}>Hi {firstName},</Text>

        <Text style={paragraph}>
          I wanted to follow up on my previous email.
        </Text>

        <Text style={paragraph}>
          If you get a chance, check out{" "}
          <Link href="https://naayya.com" style={link}>
            naayya.com
          </Link>{" "}
          to see how we can help streamline {studioName}'s operations.
        </Text>

        <Text style={paragraph}>
          Let me know if you'd like to chat.
        </Text>

        <Text style={paragraph}>
          Aman
          <br />
          Co-founder & CEO
          <br />
          <Img
            src="https://naayya.com/brand/logos/naayya/primary@2x.png"
            alt="Naayya"
            width="60"
            style={{ marginTop: "8px" }}
          />
        </Text>
      </Container>
    </Body>
  </Html>
);

export default GenericFollowUpV2;

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

const link = {
  color: "#1155cc",
  textDecoration: "none",
};
