import { NextResponse } from "next/server"

type WeatherPreviewPayload = {
  destination: string
  event_date: string
  event_time: string
  event_time_label: string
  sunset_time: string
  rain_chance: number
  will_rain: boolean
  temperature_f: number
  source: string
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

function toSeedHash(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

function format12Hour(hour24: number, minute: number): string {
  const normalizedHour = ((hour24 % 24) + 24) % 24
  const normalizedMinute = ((minute % 60) + 60) % 60
  const period = normalizedHour >= 12 ? "PM" : "AM"
  const hour12 = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12
  return `${hour12}:${String(normalizedMinute).padStart(2, "0")} ${period}`
}

function parseEventTime(raw: string): { hour: number; minute: number } | null {
  const normalized = raw.trim()
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const hour = Number.parseInt(match[1], 10)
  const minute = Number.parseInt(match[2], 10)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

function normalizeEventTime(raw: string): string {
  const parsed = parseEventTime(raw)
  if (!parsed) return "18:00"
  return `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`
}

function formatSunsetIsoTo12Hour(sunsetIso: string): string {
  const match = sunsetIso.match(/T(\d{2}):(\d{2})/)
  if (match) {
    const hour = Number.parseInt(match[1], 10)
    const minute = Number.parseInt(match[2], 10)
    if (Number.isFinite(hour) && Number.isFinite(minute)) {
      return format12Hour(hour, minute)
    }
  }

  const parsed = new Date(sunsetIso)
  if (Number.isNaN(parsed.getTime())) {
    return "6:30 PM"
  }

  return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

function fallbackWeather(destination: string, eventDate: string, eventTime: string, source: string): WeatherPreviewPayload {
  const normalizedDestination = destination.trim().toLowerCase()
  const monthIndex = new Date(`${eventDate}T12:00:00`).getMonth()
  const safeMonth = monthIndex >= 0 && monthIndex <= 11 ? monthIndex : 6
  const parsedTime = parseEventTime(eventTime) ?? { hour: 18, minute: 0 }

  const monthlyBaseTemp = [60, 62, 65, 69, 73, 79, 84, 85, 82, 74, 67, 61]
  const monthlySunsetMinutes = [1025, 1060, 1120, 1170, 1205, 1220, 1210, 1175, 1120, 1060, 1020, 1005]

  const seed = toSeedHash(`${eventDate}-${normalizedDestination}`)
  const tempOffset = (seed % 13) - 6
  const hourDeltaFromAfternoon = Math.abs(parsedTime.hour + parsedTime.minute / 60 - 15)
  const timeAdjustedTemp = monthlyBaseTemp[safeMonth] - hourDeltaFromAfternoon * 1.5
  const temperature = clampNumber(timeAdjustedTemp + tempOffset, 45, 102)

  const rainTimeBump = parsedTime.hour >= 17 ? 8 : 0
  const rainChance = clampNumber(10 + (seed % 66) + rainTimeBump, 0, 100)
  const willRain = rainChance >= 45

  const sunsetOffset = ((seed >> 3) % 31) - 15
  const sunsetMinutes = monthlySunsetMinutes[safeMonth] + sunsetOffset
  const sunsetHour = Math.floor(sunsetMinutes / 60)
  const sunsetMinute = sunsetMinutes % 60

  return {
    destination,
    event_date: eventDate,
    event_time: eventTime,
    event_time_label: format12Hour(parsedTime.hour, parsedTime.minute),
    sunset_time: format12Hour(sunsetHour, sunsetMinute),
    rain_chance: Math.round(rainChance),
    will_rain: willRain,
    temperature_f: Math.round(temperature),
    source,
  }
}

async function geocodeDestination(destination: string): Promise<{ latitude: number; longitude: number } | null> {
  const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`
  const geocodeResponse = await fetch(geocodeUrl, { cache: "no-store" })
  if (!geocodeResponse.ok) return null

  const geocodeData = await geocodeResponse.json()
  const firstResult = geocodeData?.results?.[0]
  const latitude = Number(firstResult?.latitude)
  const longitude = Number(firstResult?.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  return { latitude, longitude }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const destinationRaw = searchParams.get("destination") ?? ""
  const eventDateRaw = searchParams.get("eventDate") ?? ""
  const eventTimeRaw = searchParams.get("eventTime") ?? ""
  const destination = destinationRaw.trim()
  const eventDate = eventDateRaw.trim()
  const eventTime = normalizeEventTime(eventTimeRaw)

  if (!destination || !eventDate) {
    return NextResponse.json(
      {
        error: "Missing destination or eventDate",
        destination,
        event_date: eventDate,
      },
      { status: 400 },
    )
  }

  try {
    const geocode = await geocodeDestination(destination)
    if (!geocode) {
      return NextResponse.json(fallbackWeather(destination, eventDate, eventTime, "fallback_geocode_unavailable"))
    }

    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${geocode.latitude}&longitude=${geocode.longitude}` +
      `&daily=sunset,precipitation_probability_max,temperature_2m_max,temperature_2m_min` +
      `&hourly=temperature_2m,precipitation_probability` +
      `&timezone=auto&temperature_unit=fahrenheit&start_date=${encodeURIComponent(eventDate)}&end_date=${encodeURIComponent(eventDate)}`

    const weatherResponse = await fetch(weatherUrl, { cache: "no-store" })
    if (!weatherResponse.ok) {
      return NextResponse.json(fallbackWeather(destination, eventDate, eventTime, "fallback_weather_http_error"))
    }

    const weatherData = await weatherResponse.json()
    const sunsetIso = weatherData?.daily?.sunset?.[0]
    const hourlyTimes = Array.isArray(weatherData?.hourly?.time) ? weatherData.hourly.time : []
    const hourlyTemps = Array.isArray(weatherData?.hourly?.temperature_2m) ? weatherData.hourly.temperature_2m : []
    const hourlyRain = Array.isArray(weatherData?.hourly?.precipitation_probability)
      ? weatherData.hourly.precipitation_probability
      : []

    if (typeof sunsetIso !== "string" || hourlyTimes.length === 0 || hourlyTemps.length === 0 || hourlyRain.length === 0) {
      return NextResponse.json(fallbackWeather(destination, eventDate, eventTime, "fallback_weather_missing_hourly_data"))
    }

    const targetIso = `${eventDate}T${eventTime}`
    let matchedIndex = hourlyTimes.findIndex((timeValue: string) => timeValue === targetIso)
    if (matchedIndex < 0) {
      const targetTimestamp = new Date(targetIso).getTime()
      let bestDiff = Number.POSITIVE_INFINITY
      for (let index = 0; index < hourlyTimes.length; index += 1) {
        const currentTimestamp = new Date(hourlyTimes[index]).getTime()
        if (!Number.isFinite(currentTimestamp) || !Number.isFinite(targetTimestamp)) continue
        const diff = Math.abs(currentTimestamp - targetTimestamp)
        if (diff < bestDiff) {
          bestDiff = diff
          matchedIndex = index
        }
      }
    }

    const matchedTemp = Number(hourlyTemps[matchedIndex])
    const matchedRain = Number(hourlyRain[matchedIndex])
    const parsedEventTime = parseEventTime(eventTime) ?? { hour: 18, minute: 0 }
    const matchedTimeLabel = typeof hourlyTimes[matchedIndex] === "string" ? formatSunsetIsoTo12Hour(hourlyTimes[matchedIndex]) : format12Hour(parsedEventTime.hour, parsedEventTime.minute)

    if (!Number.isFinite(matchedTemp) || !Number.isFinite(matchedRain)) {
      return NextResponse.json(fallbackWeather(destination, eventDate, eventTime, "fallback_weather_missing_event_time_values"))
    }

    const rainChance = clampNumber(Math.round(matchedRain), 0, 100)
    const eventTemperature = Math.round(matchedTemp)

    return NextResponse.json({
      destination,
      event_date: eventDate,
      event_time: eventTime,
      event_time_label: matchedTimeLabel,
      sunset_time: formatSunsetIsoTo12Hour(sunsetIso),
      rain_chance: rainChance,
      will_rain: rainChance >= 45,
      temperature_f: eventTemperature,
      source: "open_meteo_forecast",
    } satisfies WeatherPreviewPayload)
  } catch {
    return NextResponse.json(fallbackWeather(destination, eventDate, eventTime, "fallback_weather_exception"))
  }
}
