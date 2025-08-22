import Link from "next/link"
import Image from "next/image"
import { blogPosts } from "@/config/blog-posts"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"

export const metadata = {
  title: "Hibachi Blog Los Angeles | Cooking Tips & Japanese Cuisine Guide | Real Hibachi",
  description: "Expert hibachi cooking tips, Japanese cuisine guides, and teppanyaki techniques from professional chefs in Los Angeles. Learn authentic recipes and cooking methods.",
  keywords: "hibachi cooking tips, Japanese cuisine blog, teppanyaki recipes, hibachi techniques Los Angeles, Japanese cooking blog, hibachi recipes, teppanyaki cooking guide",
  openGraph: {
    title: "Hibachi Blog Los Angeles | Cooking Tips & Japanese Cuisine",
    description: "Expert hibachi cooking tips and Japanese cuisine guides from professional chefs in Los Angeles.",
    url: "https://realhibachi.com/blog",
    siteName: "Real Hibachi",
    type: "website",
  },
}

export default function BlogPage() {
  return (
    <div className="blog-page-safe container mx-auto px-4 py-12">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">Hibachi Blog</h1>
        <p className="text-xl text-gray-500 max-w-3xl mx-auto">
          Discover tips, recipes, and insights about hibachi cooking and Japanese cuisine
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
        {blogPosts.map((post) => (
          <Link key={post.id} href={`/blog/${post.slug}`} className="group">
            <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow duration-300">
              <div className="aspect-video relative overflow-hidden">
                <Image
                  src={post.coverImage || "/placeholder.svg"}
                  alt={post.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <CardHeader className="p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                  <span>{post.category}</span>
                  <span>•</span>
                  <span>{post.readTime} min read</span>
                </div>
                <h2 className="text-xl font-bold line-clamp-2 group-hover:text-primary transition-colors">
                  {post.title}
                </h2>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-gray-600 line-clamp-3">{post.excerpt}</p>
              </CardContent>
              <CardFooter className="p-4 pt-0 flex items-center gap-3">
                <div className="relative w-8 h-8 rounded-full overflow-hidden">
                  <Image
                    src={post.author.avatar || "/placeholder.svg"}
                    alt={post.author.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{post.author.name}</span>
                  <span className="text-xs text-gray-500">{post.date}</span>
                </div>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>

      {/* Related Services Section */}
      <div className="bg-gray-50 rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-center mb-8">Explore Our Hibachi Services</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/menu" className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow text-center group">
            <h3 className="font-semibold text-gray-800 group-hover:text-orange-600">Hibachi Menu</h3>
            <p className="text-sm text-gray-600">View our packages</p>
          </Link>
          <Link href="/service-area" className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow text-center group">
            <h3 className="font-semibold text-gray-800 group-hover:text-orange-600">Service Areas</h3>
            <p className="text-sm text-gray-600">Where we serve</p>
          </Link>
          <Link href="/gallery" className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow text-center group">
            <h3 className="font-semibold text-gray-800 group-hover:text-orange-600">Gallery</h3>
            <p className="text-sm text-gray-600">See our work</p>
          </Link>
          <Link href="/book" className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow text-center group">
            <h3 className="font-semibold text-gray-800 group-hover:text-orange-600">Book Now</h3>
            <p className="text-sm text-gray-600">Reserve your chef</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
