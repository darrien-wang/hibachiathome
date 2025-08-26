# iOS Safari 视频兼容性修复脚本
# 
# 问题: Duration: Unknown + Error Code: 4 (SRC_NOT_SUPPORTED)
# 原因: moov atom 位置 + 可能的编码格式不兼容

$inputVideo = "public/video/00ebf7a19327d6f30078329b3e163952.mp4"
$outputVideo = "public/video/00ebf7a19327d6f30078329b3e163952_ios_fixed.mp4"

Write-Host "=== 检查视频信息 ===" -ForegroundColor Green
ffmpeg -i $inputVideo

Write-Host "`n=== 修复方案 1: 只修复 moov atom 位置 (快速) ===" -ForegroundColor Yellow
Write-Host "如果视频已经是 H.264/AAC，只需要移动 moov atom 到文件头："
Write-Host "ffmpeg -i $inputVideo -c copy -movflags +faststart $($outputVideo.Replace('.mp4', '_faststart.mp4'))"

Write-Host "`n=== 修复方案 2: 完整转码 (兼容性最佳) ===" -ForegroundColor Yellow  
Write-Host "转换为 iOS Safari 最兼容的格式："
Write-Host "ffmpeg -i $inputVideo -c:v libx264 -profile:v high -level 4.0 -c:a aac -movflags +faststart $outputVideo"

Write-Host "`n=== 建议执行顺序 ===" -ForegroundColor Cyan
Write-Host "1. 先试方案1 (快速，不重编码)"
Write-Host "2. 如果还有问题，再用方案2 (完整转码)"
Write-Host "3. 更新代码中的视频文件名"

