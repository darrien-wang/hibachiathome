import { blogPosts } from "@/config/blog-posts"
import type { BlogPost } from "@/types/blog"

export function getBlogPosts(): BlogPost[] {
  return blogPosts
}

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug)
}

export function getRelatedPosts(currentSlug: string, limit = 3): BlogPost[] {
  return blogPosts.filter((post) => post.slug !== currentSlug).slice(0, limit)
}

export function getBlogPostsByCategory(category: string): BlogPost[] {
  return blogPosts.filter((post) => post.category === category)
}

export function getAllCategories(): string[] {
  const categories = blogPosts.map((post) => post.category)
  return [...new Set(categories)]
}
