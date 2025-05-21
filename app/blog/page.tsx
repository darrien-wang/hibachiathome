import Link from "next/link"
import Image from "next/image"
import { blogPosts } from "@/config/blog-posts"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"

export const metadata = {
  title: "Blog | Hibachi Catering",
  description: "Read our latest articles about hibachi cooking, catering tips, and Japanese cuisine.",
}

export default function BlogPage() {
  return (
    <div className="container py-24 mx-auto">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">Hibachi Blog</h1>
        <p className="text-xl text-gray-500 max-w-3xl mx-auto">
          Discover tips, recipes, and insights about hibachi cooking and Japanese cuisine
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
    </div>
  )
}
