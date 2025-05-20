export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  coverImage: string
  date: string
  author: {
    name: string
    avatar: string
  }
  category: string
  tags: string[]
  readTime: number
}
