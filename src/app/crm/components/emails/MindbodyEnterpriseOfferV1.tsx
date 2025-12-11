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

interface MindbodyEnterpriseOfferProps {
  firstName?: string;
  studioName?: string;
}

export const MindbodyEnterpriseOfferV1 = ({
  firstName,
  studioName = "your studio",
}: MindbodyEnterpriseOfferProps) => (
  <Html>
    <Head />
    <Preview>Better Mindbody alternative for {studioName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={paragraph}>{firstName ? `Hi ${firstName},` : "Hi,"}</Text>

        <Text style={paragraph}>
          I noticed you're still using Mindbody and wanted to ask if you'd be interested in a better alternative. We built Naayya to be much more modern, helps cut down admin work by 50%, and is a lot cheaper.
        </Text>

        <Text style={paragraph}>
          We're handpicking a few studios to try our Enterprise plan free for 6 months (worth $1,800). No commitments. I came across your studio and thought it would be a great fit.
        </Text>

        <Text style={paragraph}>
          Check us out:{" "}
          <Link href="https://naayya.com" style={link}>
            naayya.com
          </Link>
        </Text>

        <Text style={paragraph}>
          Happy to give you a personal demo if you're curious:{" "}
          <Link href="https://cal.com/naayya/15min" style={link}>
            cal.com/naayya/15min
          </Link>
        </Text>

        <Text style={paragraph}>
          Sally
          <br />
          Co-founder, Naayya
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

export default MindbodyEnterpriseOfferV1;

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
