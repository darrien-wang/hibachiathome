import { NextResponse } from "next/server"
import { Resend } from "resend"

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json()
    const { name, email, phone, reason, message } = body

    console.log("Received form submission:", { name, email, reason })

    // Validate required fields
    if (!name || !email || !message) {
      console.log("Validation failed: Missing required fields")
      return NextResponse.json({ error: "Name, email, and message are required" }, { status: 400 })
    }

    // Prepare email content
    const emailHtml = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
      <p><strong>Reason:</strong> ${reason || "Not specified"}</p>
      <h3>Message:</h3>
      <p>${message.replace(/\n/g, "<br>")}</p>
    `

    // In development/preview, just log the email data
    if (process.env.NODE_ENV === "development" || !process.env.RESEND_API_KEY) {
      console.log("Email would be sent with the following data:", {
        from: process.env.EMAIL_FROM || "Hibachi at Home <onboarding@resend.dev>",
        to: process.env.EMAIL_TO || "darrien.wang+hibachi@gmail.com",
        subject: `Contact Form: ${reason || "General Inquiry"}`,
        html: emailHtml,
      })

      return NextResponse.json({
        success: true,
        message: "Your message has been received. In the preview environment, emails are logged but not sent.",
      })
    }

    console.log("Attempting to send email with Resend...")
    console.log("Using API key:", process.env.RESEND_API_KEY ? "API key exists" : "API key missing")
    console.log("From:", process.env.EMAIL_FROM || "Hibachi at Home <onboarding@resend.dev>")
    console.log("To:", process.env.EMAIL_TO || "darrien.wang+hibachi@gmail.com")

    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      // Send the email
      const { data, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || "Hibachi at Home <onboarding@resend.dev>",
        to: [process.env.EMAIL_TO || "darrien.wang+hibachi@gmail.com"],
        reply_to: email,
        subject: `Contact Form: ${reason || "General Inquiry"}`,
        html: emailHtml,
      })

      if (error) {
        console.error("Error sending email with Resend:", error)
        return NextResponse.json({ error: "Failed to send email", details: error }, { status: 500 })
      }

      console.log("Email sent successfully:", data)
      // Return success response
      return NextResponse.json({ success: true, data })
    } catch (resendError) {
      console.error("Resend API error:", resendError)
      return NextResponse.json(
        {
          error: "Failed to send email",
          details: resendError instanceof Error ? resendError.message : String(resendError),
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Error processing contact form:", error)
    return NextResponse.json(
      {
        error: "Failed to process contact form",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
