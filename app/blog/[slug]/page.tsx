import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { blogPosts } from "@/config/blog-posts"
import { ArrowLeft, Calendar, Clock, Tag } from "lucide-react"

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = blogPosts.find((post) => post.slug === params.slug)

  if (!post) {
    return {
      title: "Post Not Found",
      description: "The blog post you're looking for doesn't exist",
    }
  }

  return {
    title: `${post.title} | Hibachi Catering Blog`,
    description: post.excerpt,
  }
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }))
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = blogPosts.find((post) => post.slug === params.slug)

  if (!post) {
    notFound()
  }

  // Convert markdown content to HTML (simple version)
  const contentHtml = post.content
    .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>')
    .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold mt-6 mb-3">$1</h2>')
    .replace(/^### (.*$)/gm, '<h3 class="text-xl font-bold mt-5 mb-2">$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/- (.*$)/gm, '<li class="ml-6 list-disc mb-1">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-4">')

  return (
    <div className="container py-24 mx-auto">
      <Link href="/blog" className="inline-flex items-center text-gray-600 hover:text-primary mb-8 transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to all posts
      </Link>

      <article className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-6">{post.title}</h1>

          <div className="flex flex-wrap items-center gap-4 text-gray-500 mb-8">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              <span>{post.date}</span>
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>{post.readTime} min read</span>
            </div>
            <div className="flex items-center">
              <Tag className="h-4 w-4 mr-1" />
              <span>{post.category}</span>
            </div>
          </div>

          <div className="relative aspect-[2/1] w-full mb-8 rounded-lg overflow-hidden">
            <Image
              src={post.coverImage || "/placeholder.svg?height=600&width=1200&query=hibachi cooking"}
              alt={post.title}
              fill
              className="object-cover"
              priority
              unoptimized
            />
          </div>

          <div className="flex items-center gap-4 mb-8 p-4 border-y border-gray-100">
            <div className="relative w-12 h-12 rounded-full overflow-hidden">
              <Image
                src={post.author.avatar || "/placeholder.svg?height=100&width=100&query=chef portrait"}
                alt={post.author.name}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div>
              <div className="font-medium">{post.author.name}</div>
              <div className="text-sm text-gray-500">Author</div>
            </div>
          </div>
        </div>

        <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: contentHtml }} />

        <div className="mt-12 pt-6 border-t border-gray-100">
          <h3 className="text-lg font-medium mb-4">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </article>
    </div>
  )
}
