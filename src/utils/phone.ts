import { parsePhoneNumberFromString } from "libphonenumber-js/max"

export function normalizePhoneNumber(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== "string" || value.length > 40)
    throw new Error("Enter a valid phone number.")
  const input = value.trim()
  if (!input) return null
  const phone = parsePhoneNumberFromString(input, {
    defaultCountry: "PH",
    extract: false,
  })
  if (!phone?.isValid() || phone.ext)
    throw new Error("Enter a valid phone number.")
  return phone.number
}
