import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET() {
  try {
    // Read the HTML file from the public directory
    const filePath = path.join(process.cwd(), "public", "sitemap.html")
    const htmlContent = fs.readFileSync(filePath, "utf8")

    // Return the HTML content with the appropriate content type
    return new NextResponse(htmlContent, {
      headers: {
        "Content-Type": "text/html",
      },
    })
  } catch (error) {
    console.error("Error serving sitemap.html:", error)
    return new NextResponse("Error loading sitemap", { status: 500 })
  }
}
