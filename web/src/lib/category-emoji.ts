// Derives a sensible emoji from a category name by keyword. Used to auto-suggest
// an emoji when adding/editing a category, and as the display fallback when a
// category has no stored `icon`. Ported from the old lucide keyword mapping.

const DEFAULT_EMOJI = "🏷️";

export function resolveCategoryEmoji(name: string): string {
  const n = name.toLowerCase();

  if (
    n.includes("food") ||
    n.includes("dining") ||
    n.includes("restaurant") ||
    n.includes("eat")
  )
    return "🍽️";
  if (n.includes("coffee") || n.includes("cafe")) return "☕";
  if (
    n.includes("house") ||
    n.includes("housing") ||
    n.includes("rent") ||
    n.includes("mortgage")
  )
    return "🏠";
  if (n.includes("flight") || n.includes("plane")) return "✈️";
  if (
    n.includes("transport") ||
    n.includes("car") ||
    n.includes("auto") ||
    n.includes("gas") ||
    n.includes("fuel") ||
    n.includes("travel") ||
    n.includes("vacation") ||
    n.includes("trip") ||
    n.includes("hotel")
  )
    return "🚗";
  if (
    n.includes("shop") ||
    n.includes("store") ||
    n.includes("grocer") ||
    n.includes("supermarket")
  )
    return "🛒";
  if (n.includes("clothes") || n.includes("apparel") || n.includes("clothing"))
    return "👕";
  if (
    n.includes("entertain") ||
    n.includes("movie") ||
    n.includes("film") ||
    n.includes("cinema") ||
    n.includes("subscrip")
  )
    return "🎬";
  if (
    n.includes("health") ||
    n.includes("medical") ||
    n.includes("doctor") ||
    n.includes("pharm") ||
    n.includes("medicine")
  )
    return "💊";
  if (n.includes("fitness") || n.includes("gym") || n.includes("workout"))
    return "🏋️";
  if (
    n.includes("education") ||
    n.includes("school") ||
    n.includes("tuition") ||
    n.includes("book") ||
    n.includes("course")
  )
    return "📚";
  if (
    n.includes("utilit") ||
    n.includes("electric") ||
    n.includes("water") ||
    n.includes("bill")
  )
    return "💡";
  if (n.includes("internet") || n.includes("wifi") || n.includes("broadband"))
    return "📶";
  if (n.includes("phone") || n.includes("mobile") || n.includes("cell"))
    return "📱";
  if (n.includes("baby") || n.includes("kids") || n.includes("child"))
    return "👶";
  if (
    n.includes("pet") ||
    n.includes("dog") ||
    n.includes("cat") ||
    n.includes("vet")
  )
    return "🐶";
  if (n.includes("game") || n.includes("gaming") || n.includes("hobby"))
    return "🎮";
  if (n.includes("gift") || n.includes("present") || n.includes("donation"))
    return "🎁";
  if (n.includes("charity") || n.includes("give")) return "🤝";
  if (n.includes("save") || n.includes("saving") || n.includes("invest"))
    return "💰";

  return DEFAULT_EMOJI;
}
