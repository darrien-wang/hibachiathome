import { Body, Container, Head, Heading, Html, Img, Link, Preview, Section, Text } from "@react-email/components"
import { format } from "date-fns"

interface RefundConfirmationEmailProps {
  customerName: string
  bookingId: string
  eventDate: string
  eventTime: string
  depositAmount: number
  paymentMethod: string
  transactionId: string
  refundDate: string
}

export const RefundConfirmationEmail = ({
  customerName,
  bookingId,
  eventDate,
  eventTime,
  depositAmount,
  paymentMethod,
  transactionId,
  refundDate,
}: RefundConfirmationEmailProps) => {
  const formattedEventDate = eventDate ? format(new Date(eventDate), "MMMM d, yyyy") : "N/A"
  const formattedRefundDate = refundDate ? format(new Date(refundDate), "MMMM d, yyyy") : "N/A"

  // Format payment method for display
  const formatPaymentMethod = (method: string) => {
    switch (method) {
      case "stripe":
        return "Credit Card (Stripe)"
      case "square":
        return "Square"
      case "venmo":
        return "Venmo"
      case "zelle":
        return "Zelle"
      default:
        return method
    }
  }

  return (
    <Html>
      <Head />
      <Preview>Your Hibachi Catering Deposit Refund Confirmation</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src={`${process.env.NEXT_PUBLIC_APP_URL}/logo.png`}
            width="170"
            height="50"
            alt="Hibachi Catering Logo"
            style={logo}
          />
          <Heading style={heading}>Deposit Refund Confirmation</Heading>

          <Section style={section}>
            <Text style={text}>Dear {customerName},</Text>
            <Text style={text}>
              We are writing to confirm that your deposit for your hibachi catering event has been refunded. The details
              of the refund are provided below.
            </Text>

            <Text style={subheading}>Refund Details:</Text>
            <Text style={detailText}>
              <strong>Booking ID:</strong> {bookingId}
            </Text>
            <Text style={detailText}>
              <strong>Event Date:</strong> {formattedEventDate}
            </Text>
            <Text style={detailText}>
              <strong>Event Time:</strong> {eventTime}
            </Text>
            <Text style={detailText}>
              <strong>Refund Amount:</strong> ${depositAmount.toFixed(2)}
            </Text>
            <Text style={detailText}>
              <strong>Original Payment Method:</strong> {formatPaymentMethod(paymentMethod)}
            </Text>
            <Text style={detailText}>
              <strong>Transaction ID:</strong> {transactionId}
            </Text>
            <Text style={detailText}>
              <strong>Refund Date:</strong> {formattedRefundDate}
            </Text>

            <Text style={text}>
              Please note that depending on your payment method, it may take 3-5 business days for the refund to appear
              in your account.
            </Text>

            <Text style={text}>
              If you have any questions about this refund or would like to reschedule your event, please contact us at:
            </Text>

            <Text style={contactText}>
              Email: info@hibachicatering.com
              <br />
              Phone: (555) 123-4567
            </Text>

            <Text style={text}>We hope to have the opportunity to serve you in the future.</Text>

            <Text style={text}>
              Sincerely,
              <br />
              The Hibachi Catering Team
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>© {new Date().getFullYear()} Hibachi Catering. All rights reserved.</Text>
            <Text style={footerText}>
              <Link href={`${process.env.NEXT_PUBLIC_APP_URL}/terms`} style={link}>
                Terms of Service
              </Link>{" "}
              •
              <Link href={`${process.env.NEXT_PUBLIC_APP_URL}/privacy`} style={link}>
                Privacy Policy
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
}

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "600px",
  borderRadius: "5px",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
}

const logo = {
  margin: "0 auto",
  marginBottom: "32px",
  display: "block",
}

const heading = {
  fontSize: "32px",
  lineHeight: "1.3",
  fontWeight: "700",
  color: "#484848",
  textAlign: "center" as const,
  marginBottom: "30px",
}

const section = {
  padding: "0 48px",
}

const text = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#484848",
  marginBottom: "24px",
}

const subheading = {
  fontSize: "20px",
  lineHeight: "26px",
  fontWeight: "700",
  color: "#484848",
  marginBottom: "16px",
  marginTop: "32px",
}

const detailText = {
  fontSize: "16px",
  lineHeight: "24px",
  color: "#484848",
  marginBottom: "12px",
}

const contactText = {
  fontSize: "16px",
  lineHeight: "24px",
  color: "#484848",
  marginBottom: "24px",
  marginTop: "24px",
}

const footer = {
  padding: "0 48px",
  marginTop: "48px",
  borderTop: "1px solid #e6ebf1",
  paddingTop: "24px",
}

const footerText = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#9eb0c9",
  textAlign: "center" as const,
  marginBottom: "12px",
}

const link = {
  color: "#9eb0c9",
  textDecoration: "underline",
  margin: "0 4px",
}

export default RefundConfirmationEmail
