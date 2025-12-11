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

interface EversportsSallyFollowUpV2Props {
  firstName?: string;
  studioName?: string;
}

export const EversportsSallyFollowUpV2 = ({
  firstName = "there",
  studioName = "your studio",
}: EversportsSallyFollowUpV2Props) => (
  <Html>
    <Head>
      <meta name="color-scheme" content="light" />
      <meta name="supported-color-schemes" content="light" />
      <style>
        {`
          :root { color-scheme: light; }
          @media (prefers-color-scheme: dark) {
            body, .body { background-color: #ffffff !important; color: #000000 !important; }
          }
        `}
      </style>
    </Head>
    <Preview>Quick follow-up for {studioName}</Preview>
    <Body style={main} className="body">
      <Container style={container}>
        <Text style={paragraph}>Hi {firstName},</Text>

        <Text style={paragraph}>
          Following up on Aman's email about Naayya.
        </Text>

        <Text style={paragraph}>
          We're offering Eversports studios <strong>€1,200 in Naayya Pro credits (12 months free)</strong> if you switch before Dec 31st.
        </Text>

        <Text style={paragraph}>
          Naayya is built for studios that want more than just booking. You get automated marketing, client insights, and tools to actually grow your business.
        </Text>

        <Text style={paragraph}>
          Have a look at{" "}
          <Link href="https://naayya.com" style={link}>
            naayya.com
          </Link>{" "}
          and let me know if you'd like a quick demo.
        </Text>

        <Text style={paragraph}>
          Best,
          <br />
          <Img
            src="https://auth.naayya.com/storage/v1/object/public/naayya/cdn/sally-naayya.png"
            alt="Sally"
            width="50"
            height="50"
            style={{ marginTop: "8px", borderRadius: "50%" }}
          />
          <br />
          Sally
          <br />
          Co-founder
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

export default EversportsSallyFollowUpV2;

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
