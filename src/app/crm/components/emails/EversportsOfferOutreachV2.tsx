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

interface EversportsOfferOutreachProps {
  firstName?: string;
  studioName?: string;
}

export const EversportsOfferOutreachV2 = ({
  firstName = "there",
  studioName = "your studio",
}: EversportsOfferOutreachProps) => (
  <Html>
    <Head />
    <Preview>Quick idea for {studioName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={paragraph}>Hi {firstName},</Text>

        <Text style={paragraph}>
          Are you happy with what you're paying Eversports right now?
        </Text>

        <Text style={paragraph}>
          I'm giving away 1 year of Naayya Pro (worth €1,200) to a few select studios that move over before the end of the year.
        </Text>

        <Text style={paragraph}>
          It's a chance to upgrade your software and save a significant amount of money for 2025.
        </Text>

        <Text style={paragraph}>
          Open to a 5-min chat to see if it's a fit?
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

export default EversportsOfferOutreachV2;

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

