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

interface EversportsSallyFollowUpDEProps {
  firstName?: string;
  studioName?: string;
}

export const EversportsSallyFollowUpDE = ({
  firstName,
  studioName = "Ihr Studio",
}: EversportsSallyFollowUpDEProps) => (
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
    <Preview>Kurze Nachfrage zu {studioName}</Preview>
    <Body style={main} className="body">
      <Container style={container}>
        <Text style={paragraph}>Hallo{firstName ? ` ${firstName}` : ""},</Text>

        <Text style={paragraph}>
          ich melde mich nochmal bezüglich der E-Mail von Aman über Naayya.
        </Text>

        <Text style={paragraph}>
          Wir bieten Eversports-Studios <strong>€1.200 Naayya Pro Guthaben (12 Monate kostenlos)</strong> bei einem Wechsel bis zum 31. Dezember.
        </Text>

        <Text style={paragraph}>
          Naayya ist für Studios gemacht, die mehr wollen als nur Buchungen. Sie bekommen automatisiertes Marketing, Kundenanalysen und Tools, die Ihnen helfen, mehr Kunden zu gewinnen und zu halten.
        </Text>

        <Text style={paragraph}>
          Schauen Sie gerne auf{" "}
          <Link href="https://naayya.com" style={link}>
            naayya.com
          </Link>{" "}
          vorbei und lassen Sie mich wissen, ob Sie eine kurze Demo möchten.
        </Text>

        <Text style={paragraph}>
          Beste Grüße,
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

export default EversportsSallyFollowUpDE;

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
