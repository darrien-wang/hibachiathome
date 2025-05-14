/**
 * 计算两地址之间的驾车时间（分钟），使用内置 fetch
 * @param fromAddress 起点地址
 * @param toAddress 终点地址
 */
export async function getDriveMinutes(
  fromAddress: string,
  toAddress: string
): Promise<number> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error("Google Maps API key is not configured");
      // 如果 API key 未配置，返回默认值
      return 30; // 默认 30 分钟
    }

    console.log("Calculating drive time from", fromAddress, "to", toAddress);
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(fromAddress)}&destinations=${encodeURIComponent(toAddress)}&key=${apiKey}&units=metric`;
    
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Google Maps API request failed:", res.status, res.statusText);
      // 如果 API 请求失败，返回默认值
      return 30; // 默认 30 分钟
    }

    const data = await res.json();
    console.log("Google Maps API response:", JSON.stringify(data, null, 2));

    if (data.status !== 'OK') {
      console.error("Google Maps API returned error status:", data.status);
      return 30; // 默认 30 分钟
    }

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      console.error("Invalid response format or element status:", element?.status);
      return 30; // 默认 30 分钟
    }

    const durationMinutes = Math.ceil((element.duration.value as number) / 60);
    console.log("Calculated drive time:", durationMinutes, "minutes");
    return durationMinutes;
  } catch (error) {
    console.error("Error in getDriveMinutes:", error);
    // 发生任何错误时返回默认值
    return 30; // 默认 30 分钟
  }
}
