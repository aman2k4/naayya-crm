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

export const EversportsOfferOutreachV1 = ({
  firstName = "there",
  studioName = "your studio",
}: EversportsOfferOutreachProps) => (
  <Html>
    <Head />
    <Preview>Offer for {studioName} (Save €1,200)</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={paragraph}>Hi {firstName},</Text>

        <Text style={paragraph}>
          I noticed you're using Eversports for {studioName}.
        </Text>

        <Text style={paragraph}>
          We're offering a full year of Naayya Pro (worth €1,200) for free to studios that switch before Dec 31st.
        </Text>

        <Text style={paragraph}>
          It's a much simpler, modern platform that handles everything Eversports does—just without the clunkiness.
        </Text>

        <Text style={paragraph}>
          Any interest in seeing how it compares?
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

