import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// 导出 createClient 以满足导入需求
export { createClient } from "@supabase/supabase-js"

// 创建服务器端 Supabase 客户端
export const createServerSupabaseClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    console.error("Missing SUPABASE_URL environment variable")
    // Instead of throwing an error, return null or a mock client
    return null
  }

  if (!supabaseServiceKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
    // Instead of throwing an error, return null or a mock client
    return null
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey)
}

// 创建客户端 Supabase 客户端
let clientSupabaseClient: ReturnType<typeof createSupabaseClient> | null = null

export const createClientSupabaseClient = () => {
  if (clientSupabaseClient) return clientSupabaseClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables")
    // Instead of throwing an error, return null or a mock client
    return null
  }

  clientSupabaseClient = createSupabaseClient(supabaseUrl, supabaseAnonKey)
  return clientSupabaseClient
}

// 创建客户端组件 Supabase 客户端
export const createClientComponentClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables")
    // Instead of throwing an error, return null or a mock client
    return null
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey)
}
