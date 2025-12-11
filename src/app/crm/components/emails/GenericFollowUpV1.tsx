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

interface GenericFollowUpV1Props {
  firstName?: string;
  studioName?: string;
}

export const GenericFollowUpV1 = ({
  firstName = "there",
  studioName = "your studio",
}: GenericFollowUpV1Props) => (
  <Html>
    <Head />
    <Preview>Following up on {studioName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={paragraph}>Hi {firstName},</Text>

        <Text style={paragraph}>
          I wanted to follow up on my previous email about Naayya.
        </Text>

        <Text style={paragraph}>
          If you have a few minutes, I'd love for you to check out{" "}
          <Link href="https://naayya.com" style={link}>
            naayya.com
          </Link>{" "}
          and see how we're helping studios simplify their operations.
        </Text>

        <Text style={paragraph}>
          Happy to answer any questions or jump on a quick call if you'd like to learn more.
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
            width="60"
            style={{ marginTop: "8px" }}
          />
        </Text>
      </Container>
    </Body>
  </Html>
);

export default GenericFollowUpV1;

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
