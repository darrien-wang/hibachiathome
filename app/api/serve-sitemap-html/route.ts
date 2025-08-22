import { NextResponse } from "next/server"
import { siteConfig } from "@/config/site"
import { getBlogPosts } from "@/lib/blog"

export async function GET() {
  try {
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || siteConfig.url
    
    // Fetch blog posts dynamically
    let blogPages: Array<{url: string, title: string, description: string}> = []
    try {
      const blogPosts = await getBlogPosts()
      blogPages = blogPosts.map(post => ({
        url: `/blog/${post.slug}`,
        title: `Blog - ${post.title}`,
        description: post.excerpt || "Read our blog articles"
      }))
      // Add main blog page
      blogPages.unshift({
        url: "/blog",
        title: "Blog - Hibachi Cooking Techniques & Tips",
        description: "Learn about hibachi cooking techniques and tips"
      })
    } catch (error) {
      console.error("Failed to fetch blog posts for HTML sitemap:", error)
      // Add just the main blog page if posts can't be fetched
      blogPages = [{
        url: "/blog",
        title: "Blog - Hibachi Cooking Techniques & Tips",
        description: "Learn about hibachi cooking techniques and tips"
      }]
    }
    
    const pageCategories = {
      "Main Pages": [
        { url: "", title: "Home - Professional Hibachi at Home Service", description: "Professional hibachi at home service covering Los Angeles, Orange County, San Diego, Palm Springs, and Riverside" },
        { url: "/menu", title: "Menu - Package Selection", description: "View our hibachi packages and menu options with pricing" },
        { url: "/book", title: "Online Booking", description: "Book your hibachi experience online with instant confirmation" },
        { url: "/estimation", title: "Price Estimation", description: "Get a detailed price estimate for your hibachi event" },
      ],
      "Service Areas": [
        { url: "/service-area", title: "Service Areas Overview", description: "Overview of all service areas across Southern California" },
        { url: "/service-area/los-angeles", title: "Los Angeles Area Service", description: "Professional hibachi service in Los Angeles and surrounding areas" },
        { url: "/service-area/orange-county", title: "Orange County Area Service", description: "Hibachi at home service for Orange County communities" },
        { url: "/service-area/san-diego", title: "San Diego Area Service", description: "San Diego area hibachi service for coastal communities" },
        { url: "/service-area/palm-springs", title: "Palm Springs Area Service", description: "Desert resort hibachi service for Palm Springs and Coachella Valley" },
        { url: "/service-area/riverside", title: "Riverside Area Service", description: "Riverside and Inland Empire hibachi service" },
      ],
      "Location Information": [
        { url: "/locations", title: "Service Locations", description: "Detailed service locations and coverage areas" },
        { url: "/locations/la-orange-county", title: "Los Angeles - Orange County", description: "Los Angeles and Orange County service coverage details" },
        { url: "/locations/nyc-long-island", title: "New York - Long Island", description: "New York City and Long Island service details" },
      ],
      "Blog & Information": blogPages,
      "Other Pages": [
        { url: "/hibachi-at-home", title: "Hibachi at Home Service Details", description: "Complete guide to our hibachi at home service experience" },
        { url: "/gallery", title: "Photo Gallery", description: "Photos and videos from our hibachi events and parties" },
        { url: "/faq", title: "Frequently Asked Questions", description: "Frequently asked questions about hibachi service and booking" },
        { url: "/rentals", title: "Equipment Rentals", description: "Equipment rental options including tables, chairs, and utensils" },
        { url: "/privacy-policy", title: "Privacy Policy", description: "Privacy policy and terms of service" },
      ]
    }
    
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    
    const totalPages = Object.values(pageCategories).reduce((sum, category) => sum + category.length, 0)

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Real Hibachi Sitemap - Professional Hibachi at Home Service</title>
  <meta name="description" content="Real Hibachi Sitemap - Browse all our service pages, area coverage and features. Serving Los Angeles, Orange County, San Diego, Palm Springs, Riverside and more areas">
  <meta name="keywords" content="hibachi sitemap, hibachi at home service, Los Angeles hibachi, Orange County hibachi, San Diego hibachi, website sitemap">
  <link rel="canonical" href="${BASE_URL}/api/serve-sitemap-html">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      min-height: 100vh;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .header {
      text-align: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 20px;
      border-radius: 20px;
      margin-bottom: 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    
    .header h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
      font-weight: 700;
    }
    
    .header p {
      font-size: 1.1rem;
      opacity: 0.9;
      margin-bottom: 20px;
    }
    
    .stats {
      background: rgba(255,255,255,0.2);
      padding: 15px;
      border-radius: 10px;
      display: inline-block;
    }
    
    .category {
      background: white;
      border-radius: 15px;
      padding: 25px;
      margin-bottom: 25px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.1);
      transition: transform 0.3s ease;
    }
    
    .category:hover {
      transform: translateY(-2px);
    }
    
    .category-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 3px solid #f0f2f5;
    }
    
    .page-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 15px;
    }
    
    .page-item {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 10px;
      padding: 20px;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }
    
    .page-item:hover {
      border-color: #667eea;
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.2);
      transform: translateY(-1px);
    }
    
    .page-item::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      transition: width 0.3s ease;
    }
    
    .page-item:hover::before {
      width: 6px;
    }
    
    .page-link {
      text-decoration: none;
      color: inherit;
      display: block;
    }
    
    .page-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 8px;
    }
    
    .page-url {
      font-size: 0.9rem;
      color: #667eea;
      margin-bottom: 8px;
      word-break: break-all;
    }
    
    .page-description {
      font-size: 0.9rem;
      color: #6c757d;
    }
    
    .footer {
      text-align: center;
      padding: 30px;
      color: #6c757d;
      border-top: 1px solid #e9ecef;
      margin-top: 40px;
      background: white;
      border-radius: 15px;
    }
    
    @media (max-width: 768px) {
      .header h1 {
        font-size: 2rem;
      }
      
      .page-grid {
        grid-template-columns: 1fr;
      }
      
      .container {
        padding: 15px;
      }
    }
    
    .search-container {
      background: white;
      padding: 20px;
      border-radius: 15px;
      margin-bottom: 25px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.1);
    }
    
    .search-input {
      width: 100%;
      padding: 12px 20px;
      border: 2px solid #e9ecef;
      border-radius: 10px;
      font-size: 1rem;
      transition: border-color 0.3s ease;
    }
    
    .search-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    
    .search-results {
      margin-top: 15px;
      font-size: 0.9rem;
      color: #6c757d;
    }
    
    .hidden {
      display: none;
    }
    
    .highlight {
      background-color: yellow;
      padding: 2px 4px;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🍱 Real Hibachi Sitemap</h1>
      <p>Professional Hibachi at Home Service - Serving Los Angeles, Orange County, San Diego, Palm Springs and more areas</p>
      <div class="stats">
        <strong>Last Updated: ${currentDate}</strong> | <strong>Total Pages: ${totalPages}</strong>
      </div>
    </div>
    
    <div class="search-container">
      <input 
        type="text" 
        id="searchInput" 
        class="search-input" 
        placeholder="🔍 Search pages... (e.g: Los Angeles, menu, booking)"
      >
      <div id="searchResults" class="search-results"></div>
    </div>
    
    ${Object.entries(pageCategories).map(([categoryName, pages]) => `
    <div class="category">
      <h2 class="category-title">${categoryName}</h2>
      <div class="page-grid">
        ${pages.map(page => `
        <div class="page-item">
          <a href="${BASE_URL}${page.url}" class="page-link" target="_blank">
            <div class="page-title">${page.title}</div>
            <div class="page-url">${BASE_URL}${page.url}</div>
            <div class="page-description">${page.description}</div>
          </a>
        </div>
        `).join('')}
      </div>
    </div>
    `).join('')}
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} Real Hibachi. Professional Hibachi at Home Service</p>
      <p>Visit <a href="${BASE_URL}" style="color: #667eea;">realhibachi.com</a> for more information or to book online</p>
      <p style="margin-top: 10px; font-size: 0.9rem;">
        📞 Phone: ${siteConfig.contact.phone} | 📧 Email: ${siteConfig.contact.email}
      </p>
    </div>
  </div>
  
  <script>
    // Search functionality
    document.addEventListener('DOMContentLoaded', function() {
      const searchInput = document.getElementById('searchInput');
      const searchResults = document.getElementById('searchResults');
      const categories = document.querySelectorAll('.category');
      const pageItems = document.querySelectorAll('.page-item');
      
      let allPages = [];
      pageItems.forEach(item => {
        const link = item.querySelector('.page-link');
        const title = item.querySelector('.page-title').textContent;
        const url = item.querySelector('.page-url').textContent;
        const description = item.querySelector('.page-description').textContent;
        allPages.push({
          element: item,
          title: title.toLowerCase(),
          url: url.toLowerCase(),
          description: description.toLowerCase(),
          originalTitle: title,
          originalUrl: url,
          originalDescription: description
        });
      });
      
      searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        
        if (query === '') {
          // Show all categories and pages
          categories.forEach(category => category.style.display = 'block');
          pageItems.forEach(item => item.style.display = 'block');
          searchResults.textContent = '';
          return;
        }
        
        let matchCount = 0;
        let visibleCategories = new Set();
        
        allPages.forEach(page => {
          const matches = page.title.includes(query) || 
                         page.url.includes(query) || 
                         page.description.includes(query);
          
          if (matches) {
            page.element.style.display = 'block';
            matchCount++;
            visibleCategories.add(page.element.closest('.category'));
          } else {
            page.element.style.display = 'none';
          }
        });
        
        // Show/hide categories based on whether they have visible pages
        categories.forEach(category => {
          if (visibleCategories.has(category)) {
            category.style.display = 'block';
          } else {
            category.style.display = 'none';
          }
        });
        
        searchResults.textContent = \`Found \${matchCount} matching pages\`;
      });
      
      // Add click tracking
      pageItems.forEach(item => {
        item.addEventListener('click', function() {
          const url = this.querySelector('.page-url').textContent;
          console.log(\`Visiting page: \${url}\`);
        });
      });
    });
  </script>
</body>
</html>`

    return new NextResponse(htmlContent, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    })
  } catch (error) {
    console.error("Error generating sitemap.html:", error)
    return new NextResponse("Error generating sitemap", { status: 500 })
  }
}
