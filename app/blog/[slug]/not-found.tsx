import Link from "next/link"

export default function BlogNotFound() {
  return (
    <div className="container flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-4xl font-bold mb-4">Blog Post Not Found</h1>
      <p className="text-xl text-gray-500 mb-8">The blog post you're looking for doesn't exist or has been moved.</p>
      <Link href="/blog" className="px-6 py-3 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors">
        Return to Blog
      </Link>
    </div>
  )
}
