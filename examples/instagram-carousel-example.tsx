// 轮播模式示例 - 如果你想要使用轮播而不是网格布局
// 在 app/page.tsx 中替换现有的 InstagramVideosSection

/*
      <InstagramVideosSection
        displayMode="carousel"
        maxVisible={3}
        showViewAll={false}
        title="Latest Hibachi Experiences"
        subtitle="Swipe through our most recent events and celebrations"
      />
*/

// 或者你可以创建两个区域：

/*
      {/* 最新视频轮播 */}
      <InstagramVideosSection
        displayMode="carousel"
        maxVisible={3}
        showViewAll={false}
        title="Latest Events"
        subtitle="Our most recent hibachi experiences"
      />

      {/* 全部视频网格 */}
      <InstagramVideosSection
        displayMode="grid"
        maxVisible={6}
        showViewAll={true}
        title="All Our Events"
        subtitle="Browse all our hibachi events and celebrations"
      />
*/

// 其他配置选项：
/*
interface InstagramVideosSectionProps {
  displayMode?: "grid" | "carousel"      // 显示模式
  maxVisible?: number                    // 最大显示数量
  showViewAll?: boolean                  // 是否显示"查看全部"按钮
  title?: string                         // 区域标题
  subtitle?: string                      // 区域副标题
}
*/

